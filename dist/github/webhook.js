export async function handlePullRequestEvent(context) {
    const { owner, repo } = context.repo();
    const number = context.payload.pull_request.number;
    const prTitle = context.payload.pull_request.title;
    context.log.info(`Processing PR #${number}: ${prTitle}`);
    return context.octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: number,
        body: "🤖 Analyzing Pull Request...",
    });
}
