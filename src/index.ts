import "dotenv/config";
import { Probot } from "probot";
import { IncomingMessage, ServerResponse } from "node:http";
import { handlePullRequestEvent } from "./github/webhook.js";
import { runHealthChecks } from "./health/checks.js";
import { costTracker } from "./llm/costTracker.js";
import { logger, loggers } from "./utils/logger.js";
import { initVectorStore } from "./rag/vectorStore.js";

const log = loggers.webhook;

interface ApplicationFunctionOptions {
  addHandler: (handler: (req: IncomingMessage, res: ServerResponse) => boolean | void | Promise<boolean | void>) => void;
  [key: string]: unknown;
}

const app = async (probotApp: Probot, options: ApplicationFunctionOptions): Promise<void> => {
  logger.info("🤖 PR Reviewer App is loaded!");

  // Initialize vector store connection
  try {
    await initVectorStore();
    logger.info("📦 Vector store connected successfully");
  } catch (error) {
    logger.warn({ error: (error as Error).message }, "⚠️ Vector store connection failed - will retry on first use");
  }

  // Register custom HTTP handlers using Probot's addHandler
  const { addHandler } = options;

  // Health check endpoint
  addHandler((req: IncomingMessage, res: ServerResponse) => {
    if (req.url === "/health" && req.method === "GET") {
      runHealthChecks()
        .then((health) => {
          const statusCode = health.status === "healthy" ? 200 : health.status === "degraded" ? 200 : 503;
          res.writeHead(statusCode, { "Content-Type": "application/json" });
          res.end(JSON.stringify(health));
        })
        .catch((error) => {
          res.writeHead(503, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              status: "unhealthy",
              error: (error as Error).message,
              timestamp: new Date().toISOString(),
            })
          );
        });
      return true; // Request handled
    }
    return false; // Not handled, pass to next handler
  });

  // Cost summary endpoint
  addHandler((req: IncomingMessage, res: ServerResponse) => {
    if (req.url === "/costs" && req.method === "GET") {
      try {
        const summary = costTracker.getSummary();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            ...summary,
            sessionTotal: `$${summary.sessionTotal.toFixed(4)}`,
            averageCostPerCall: `$${summary.averageCostPerCall.toFixed(6)}`,
            sessionDurationMinutes: Math.round(summary.sessionDuration / 60000),
          })
        );
      } catch (error) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: (error as Error).message }));
      }
      return true;
    }
    return false;
  });

  logger.info("📊 Health endpoints registered: /health, /costs");

  // PR event handler
  probotApp.on(["pull_request.opened", "pull_request.synchronize"], async (context) => {
    console.log('>>> PR event received');
    try {
      await handlePullRequestEvent(context);
      console.log('>>> PR event handled successfully');
    } catch (error) {
      const err = error as Error;
      console.error('>>> ERROR in index.ts catch:', err.message);
      console.error('>>> Stack:', err.stack);
      log.error({ err: error }, "Error handling PR event");
    }
  });
};

export default app;