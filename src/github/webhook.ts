import { Context } from "probot";
import { openaiProvider } from "../llm/openai.js";
import { diffParser } from "../review/diffParser.js";
import { ReviewGenerator } from "../review/generator.js";
import { githubCommentsHandler } from "./comments.js";
import { repoCloner } from "../git/cloner.js";
import { RepositoryParser } from "../parsing/parser.js";
import { CodeChunk } from "../parsing/codeChunker.js";
import { storeDocuments } from "../rag/vectorStore.js";
import { buildKeywordIndex } from "../rag/bm25.js";
import { getHybridRagContext } from "../rag/hybridRetriever.js";
import { checkPRLimits, getOversizedPRMessage, shouldSkipReview } from "../review/limits.js";
import { prepareInputsWithBudget } from "../llm/tokenBudget.js";
import { costTracker } from "../llm/costTracker.js";
import { loggers } from "../utils/logger.js";

const log = loggers.webhook;


export async function handlePullRequestEvent(
  context: Context<"pull_request.opened" | "pull_request.synchronize">
): Promise<string> {
  const { owner: repoOwner, repo: repoName } = context.repo();
  const number = context.payload.pull_request.number;
  const prTitle = context.payload.pull_request.title;
  const parser = new RepositoryParser();
  const reviewGenerator = new ReviewGenerator(openaiProvider);

  log.info({
    pr: number,
    repo: `${repoOwner}/${repoName}`,
    title: prTitle,
  }, 'Processing PR');

  try {
    // Check cost budget before proceeding
    if (costTracker.isOverBudget(1.0)) {
      log.warn({ pr: number }, 'Hourly cost budget exceeded, skipping review');
      await context.octokit.rest.issues.createComment({
        owner: repoOwner,
        repo: repoName,
        issue_number: number,
        body: "⚠️ Hourly API budget exceeded. Review will resume when budget resets.",
      });
      return "Skipped: cost budget exceeded";
    }

    const installationToken = await context.octokit.auth({
      type: "installation",
    });

    // Clone into the repository
    const repoPath = await repoCloner.cloneRepository(repoOwner, repoName, installationToken as string);

    if (!repoPath) {
      throw new Error("Failed to clone repository");
    }

    // parse the repository
    const parsedFeatures: CodeChunk[] = await parser.parse(repoPath);

    //store in vector db
    await storeDocuments(parsedFeatures);
    buildKeywordIndex(parsedFeatures.map(c => ({
      id: c.id,
      text: c.text,
      filePath: c.filePath,
      functionName: c.metadata.functionName,
      startLine: c.startLine,
      endLine: c.endLine
    })));

    log.info({ chunksIndexed: parsedFeatures.length }, 'Repository indexed');

    // Parse the difference
    const rawDiff = await diffParser.parsePRDiff(context, repoOwner, repoName, number);
    const diff = diffParser.filterSignificantChanges(rawDiff);

    // Check PR size limits
    const limitCheck = checkPRLimits(diff);
    if (!limitCheck.passed) {
      log.warn({
        pr: number,
        reason: limitCheck.reason,
        details: limitCheck.details,
      }, 'PR exceeds size limits');

      // Skip entirely if extremely large
      if (shouldSkipReview(diff)) {
        await githubCommentsHandler.postReview(
          context,
          {
            summary: getOversizedPRMessage(limitCheck),
            comments: [],
            overallRating: 'comment'
          },
          repoOwner,
          repoName,
          number
        );
        return "Skipped: PR too large";
      }
    }

    // Handle no significant changes
    if (diff.files.length === 0) {
      log.info({ pr: number }, 'No significant changes detected');
      await githubCommentsHandler.postReview(
        context,
        {
          summary: "No significant changes detected.",
          comments: [],
          overallRating: 'approve'
        },
        repoOwner,
        repoName,
        number
      );
      return "No significant changes to review.";
    }

    // Retrieve relevant code snippets
    const rawRagContext = await getHybridRagContext(diff.content, 10, 10);

    // Apply token budget
    const { diff: truncatedDiff, rag: truncatedRag, budget } = prepareInputsWithBudget(
      diff.content,
      rawRagContext
    );

    // Update diff content with truncated version for review
    const processedDiff = { ...diff, content: truncatedDiff };

    // Generate review
    const review = await reviewGenerator.generateReview(processedDiff, prTitle, truncatedRag);

    // Post comment
    await githubCommentsHandler.postReview(context, review, repoOwner, repoName, number);

    const costSummary = costTracker.getSummary();
    log.info({
      pr: number,
      commentsCount: review.comments.length,
      rating: review.overallRating,
      tokenBudget: budget,
      sessionCost: `$${costSummary.sessionTotal.toFixed(4)}`,
    }, 'Review posted successfully');

    return review.summary;

  } catch (error) {
    const err = error as Error;
    // Log synchronously to ensure we see the error before any crash
    console.error('PR Review Error:', err.message);
    console.error('Stack:', err.stack);
    
    log.error({ 
      err, 
      pr: number,
      errorMessage: err.message,
      errorStack: err.stack,
    }, 'Error in PR review');
    
    await context.octokit.rest.issues.createComment({
      owner: repoOwner,
      repo: repoName,
      issue_number: number,
      body: "Sorry, I encountered an error while reviewing this PR. Please try again.",
    });
    
    throw error;
  }
}