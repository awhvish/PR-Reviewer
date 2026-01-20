import { Context } from "probot";
import { openaiProvider } from "../llm/openai";
import { diffParser } from "../review/diffParser";
import { ReviewGenerator } from "../review/generator";
import { githubCommentsHandler } from "./comments";

const reviewGenerator = new ReviewGenerator(openaiProvider);

export async function handlePullRequestEvent(
  context: Context<"pull_request.opened" | "pull_request.synchronize">
): Promise<string> {
  const { owner, repo } = context.repo();
  const number = context.payload.pull_request.number;
  const prTitle = context.payload.pull_request.title;

  context.log.info(`Processing PR #${number}: ${prTitle}`);

  try {
    // Parse the diff
    const rawDiff = await diffParser.parsePRDiff(context, owner, repo, number);
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
        owner,
        repo,
        number
      );
      return "No significant changes to review.";
    }

    // Generate review
    const review = await reviewGenerator.generateReview(diff, prTitle);

    // Post comment
    await githubCommentsHandler.postReview(context, review, owner, repo, number);

    context.log.info(`Posted review for PR #${number}`);
    return review.summary;

  } catch (error) {
    context.log.error({ error }, "Error in PR review");
    
    await context.octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: number,
      body: "Sorry, I encountered an error while reviewing this PR. Please try again.",
    });
    
    throw error;
  }
}