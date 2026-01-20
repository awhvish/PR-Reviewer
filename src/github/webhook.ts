import { Context } from "probot";
import client from "../llm/openai";

export async function handlePullRequestEvent(context: Context<"pull_request.opened" | "pull_request.synchronize">): Promise<string> {
  const { owner, repo } = context.repo();
  const number = context.payload.pull_request.number;
  const prTitle = context.payload.pull_request.title;

  context.log.info(`Processing PR #${number}: ${prTitle}`);

  try {
    const { data: diffText } = await context.octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: number,
      headers: {
        accept: "application/vnd.github.v3.diff", 
      },
    }) as unknown as { data: string }; 

    if (typeof diffText !== 'string' || diffText.length === 0) {
      context.log.info("No diff data returned.");
      return "No changes found.";
    }

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert code reviewer. Focus on bugs, security issues, and significant improvements. Be concise and actionable.",
        },
        {
          role: "user",
          content: `Please review this code diff and suggest improvements:\n\n${diffText}`,
        },
      ],
      max_tokens: 500,
      temperature: 0.1, 
    });

    const reviewComments = response.choices[0].message?.content || "No comments generated.";
    
    await context.octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: number,
      body: `🤖 **AI Code Review**\n\n${reviewComments}`,
    });

    context.log.info(`Posted review for PR #${number}`);
    return reviewComments;

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