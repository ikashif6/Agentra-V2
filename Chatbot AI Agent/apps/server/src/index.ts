import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { healthRouter } from "./http/routes/health.js";
import { chatRouter } from "./http/routes/chat.js";
import { agentRouter } from "./http/routes/agent.js";
import { shopifyRouter } from "./http/routes/shopify.js";
import { uploadRouter } from "./http/routes/uploads.js";
import { maybeConnectAgentraWorkspaceProvider } from "./workspace/index.js";

if (maybeConnectAgentraWorkspaceProvider()) {
  console.log("[chatbot] workspace config provider: agentra");
}

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "1mb" }));

app.use(healthRouter);
app.use("/v1/chat", chatRouter);
app.use("/v1/agent", agentRouter);
app.use("/v1/uploads", uploadRouter);
app.use("/shopify", shopifyRouter);
app.use("/v1/shopify", shopifyRouter);

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(err);
    res.status(500).json({ success: false, message: "Internal error" });
  },
);

app.listen(env.port, env.host, () => {
  console.log(
    `[chatbot] listening on http://${env.host}:${env.port} (commerce=${env.commerceProvider}, ai=${env.aiProvider})`,
  );
});
