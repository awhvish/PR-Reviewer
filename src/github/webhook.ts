import { Context } from "probot";
import { openaiProvider } from "../llm/openai";
import { diffParser } from "../review/diffParser";
import { ReviewGenerator } from "../review/generator";
import { githubCommentsHandler } from "./comments";
import { repoCloner } from "../git/cloner";

const reviewGenerator = new ReviewGenerator(openaiProvider);

export async function handlePullRequestEvent(
  context: Context<"pull_request.opened" | "pull_request.synchronize">
): Promise<string> {
  const { owner: repoOwner, repo: repoName } = context.repo();
  const number = context.payload.pull_request.number;
  const prTitle = context.payload.pull_request.title;

  context.log.info(`Processing PR #${number}: ${prTitle}`);

  try {
    const installationToken = await context.octokit.auth({
      type: "installation",
    });

    // Clone into the repository
    const repoPath = await repoCloner.cloneRepository(repoOwner, repoName, installationToken as string);

    // Parse using tree-sitter
    //store in vector db
    //get the PR diff

    // Parse the diff
    const rawDiff = await diffParser.parsePRDiff(context, repoOwner, repoName, number);
    const diff = diffParser.filterSignificantChanges(rawDiff);

    
    if (diff.files.length === 0) {
      context.log.info(`PR #${number} has no significant changes`);
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

    // Generate review
    const review = await reviewGenerator.generateReview(diff, prTitle);

    // Post comment
    await githubCommentsHandler.postReview(context, review, repoOwner, repoName, number);

    context.log.info(`Posted review for PR #${number}`);
    return review.summary;

  } catch (error) {
    context.log.error({ error }, "Error in PR review");
    
    await context.octokit.rest.issues.createComment({
      owner: repoOwner,
      repo: repoName,
      issue_number: number,
      body: "Sorry, I encountered an error while reviewing this PR. Please try again.",
    });
    
    throw error;
  }
}