import { Probot } from "probot";
import { handlePullRequestEvent } from "./github/webhook.js";

const app = (app) => {
  app.log.info("🤖 PR Reviewer App is loaded!");

  app.on(
    ["pull_request.opened", "pull_request.synchronize"],
    async (context) => {
      try {
        await handlePullRequestEvent(context);
      } catch (error) {
        app.log.error("Error handling PR event:", error);
      }
    }
  );
};

export default app;
