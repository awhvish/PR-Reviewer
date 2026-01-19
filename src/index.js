// probot

import { Probot } from "probot";
import { handlePullRequestEvent } from "./github/webhook";

export default (app) => {
  app.log.info("App is loaded!");

  app.on(
    ["pull_request.opened", "pull_request.synchronize"],
    async (context) => {
      await handlePullRequestEvent(context);
    }
  );
};
