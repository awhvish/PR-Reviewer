import { Probot } from "probot";
import { handlePullRequestEvent } from "./github/webhook";

const app = (app: Probot): void => {
  app.log.info("🤖 PR Reviewer App is loaded!");

  app.on(
    ["pull_request.opened", "pull_request.synchronize"],
    async (context) => {
      try {
        await handlePullRequestEvent(context);
      } catch (error) {
        app.log.error({ error }, "Error handling PR event");
      }
    }
  );
};

export default app;