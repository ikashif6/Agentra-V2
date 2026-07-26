import { Router } from "express";
import { runTurn } from "../../engine/pipeline.js";
import { env } from "../../config/env.js";
import {
  createConversation,
  findConversationBySession,
  getMessages,
  getConversation,
} from "../../storage/store.js";
import { getHandoffQueueStatus } from "../../handoff/queue.js";
import { subscribe } from "../../realtime/hub.js";
import { makeMessage, appendMessages, saveConversation } from "../../storage/store.js";
import { getWorkspaceConfig } from "../../workspace/index.js";

export const chatRouter = Router();

chatRouter.get("/config", (_req, res) => {
  const config = getWorkspaceConfig(env.workspaceId);
  res.json({
    success: true,
    data: {
      storeName: config.branding.storeName,
      agentName: config.branding.agentName,
      widgetColor: config.branding.widgetColor,
      workspaceId: config.workspaceId,
      commerceProvider: env.commerceProvider,
      welcomeMessage: config.branding.welcomeMessage,
      contactEmail: config.branding.contactEmail,
      features: config.features,
      agentsAvailable: config.businessHours.agentsAvailable,
      /** Agentra not connected — source is local_env or local_file */
      configSource: config.source,
    },
  });
});

chatRouter.post("/session", async (req, res) => {
  try {
    const workspaceId = String(req.body.workspaceId || env.workspaceId);
    const sessionToken =
      String(req.body.sessionToken || "") ||
      `sess_${Math.random().toString(36).slice(2, 12)}`;
    const resumeOnly = Boolean(req.body.resumeOnly);
    let conversation = await findConversationBySession(workspaceId, sessionToken);
    if (!conversation) {
      if (resumeOnly) {
        res.status(404).json({
          success: false,
          message: "Conversation not found for that session",
        });
        return;
      }
      conversation = await createConversation({
        workspaceId,
        sessionToken,
        channel: req.body.channel || "web",
        visitorEmail: req.body.visitorEmail,
      });
      const welcomeText =
        getWorkspaceConfig(workspaceId).branding.welcomeMessage ||
        `Hi! I can help with orders, products, returns, and store questions.`;
      const welcome = makeMessage({
        role: "assistant",
        contentType: "text",
        body: welcomeText,
        senderName: getWorkspaceConfig(workspaceId).branding.agentName,
      });
      await appendMessages(conversation.id, [welcome]);
    }
    const messages = await getMessages(conversation.id);
    res.json({
      success: true,
      data: {
        conversationId: conversation.id,
        sessionToken: conversation.sessionToken,
        visitorEmail: conversation.visitorEmail,
        messages,
        conversationState: conversation.state,
        handoffState: conversation.handoffState,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : "Session error",
    });
  }
});

chatRouter.post("/turn", async (req, res) => {
  try {
    const body = req.body || {};
    const attachments = Array.isArray(body.attachments) ? body.attachments : [];
    if (
      !body.sessionToken ||
      (!body.message && !body.formSubmission && attachments.length === 0)
    ) {
      res.status(400).json({
        success: false,
        message: "sessionToken and message are required",
      });
      return;
    }
    const result = await runTurn({
      workspaceId: body.workspaceId || env.workspaceId,
      conversationId: body.conversationId,
      sessionToken: body.sessionToken,
      message: body.message || "",
      visitorEmail: body.visitorEmail,
      formSubmission: body.formSubmission,
      choiceId: body.choiceId,
      channel: body.channel || "web",
      attachments,
    });

    // Attach live queue position while waiting for an agent
    if (result.handoffState === "connecting" || result.handoffState === "assigned") {
      const conv = await getConversation(result.conversationId);
      if (conv) {
        const queue = await getHandoffQueueStatus(conv);
        result.queuePosition = queue.position;
        result.estimatedWaitMinutes = queue.estimatedWaitMinutes;
        result.queueLabel = queue.label;
      }
    }

    res.json({ success: true, data: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : "Turn failed",
    });
  }
});

chatRouter.get("/events", (req, res) => {
  const conversationId = String(req.query.conversationId || "");
  if (!conversationId) {
    res.status(400).end("conversationId required");
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  res.write(`event: connected\ndata: ${JSON.stringify({ conversationId })}\n\n`);

  const unsubscribe = subscribe(conversationId, (event) => {
    res.write(`event: message\ndata: ${JSON.stringify(event)}\n\n`);
  });

  const keepAlive = setInterval(() => {
    res.write(`: ping\n\n`);
  }, 25000);

  req.on("close", () => {
    clearInterval(keepAlive);
    unsubscribe();
  });
});

chatRouter.get("/history/:conversationId", async (req, res) => {
  const conversation = await getConversation(req.params.conversationId);
  if (!conversation) {
    res.status(404).json({ success: false, message: "Not found" });
    return;
  }
  const messages = await getMessages(conversation.id);
  res.json({
    success: true,
    data: { conversation, messages },
  });
});

// unused import guard
void saveConversation;
