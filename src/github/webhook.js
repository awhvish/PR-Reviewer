export async function handlePullRequestEvent(context) {
  const { owner, repo, number } = context.issue();
  const pullRequest = context.payload.pull_request;

  const prTitle = pullRequest.title;

  context.log.info(
    `Received pull request #${number} in ${owner}/${repo} with title: ${prTitle}`
  );

  return context.octokit.issues.createComment({
    owner,
    repo,
    issue_number: number,
    body: "Analyzing Pull Request. ",
  });
}
