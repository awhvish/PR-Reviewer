export async function handlePullRequestEvent(context) {
  const { owner, repo, number } = context.issue();
  const prTitle = context.payload.pull_request.title;

  context.log.info(`Processing PR #${number}: ${prTitle}`);

  return context.octokit.issues.createComment({
    owner,
    repo,
    issue_number: number,
    body: "🤖 Analyzing Pull Request...",
  });
}
