import { Router } from "express";
import {
  getConversation,
  getMessages,
  makeMessage,
  appendMessages,
  saveConversation,
} from "../../storage/store.js";
import { agentTakeover } from "../../handoff/service.js";
import { publish } from "../../realtime/hub.js";
import { env } from "../../config/env.js";

export const agentRouter = Router();

/** Human agent takeover — freezes AI replies. */
agentRouter.post("/takeover", async (req, res) => {
  try {
    const { conversationId, agentId, agentName } = req.body || {};
    const conversation = await getConversation(String(conversationId));
    if (!conversation) {
      res.status(404).json({ success: false, message: "Conversation not found" });
      return;
    }
    await agentTakeover(conversation, String(agentId || "agent-1"));
    const msg = makeMessage({
      role: "system",
      contentType: "system_event",
      body: `${agentName || "An agent"} joined the conversation`,
      systemEvent: {
        type: "agent_joined",
        text: `${agentName || "An agent"} joined the conversation`,
      },
    });
    await appendMessages(conversation.id, [msg]);
    publish(conversation.id, { type: "agent_joined", message: msg });
    res.json({ success: true, data: { handoffState: conversation.handoffState } });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : "Takeover failed",
    });
  }
});

/** Agent sends a message while in takeover. */
agentRouter.post("/message", async (req, res) => {
  try {
    const { conversationId, text, agentName, attachments } = req.body || {};
    const conversation = await getConversation(String(conversationId));
    if (!conversation) {
      res.status(404).json({ success: false, message: "Conversation not found" });
      return;
    }
    if (!conversation.humanTakeover) {
      res.status(400).json({
        success: false,
        message: "Conversation is not in human takeover mode",
      });
      return;
    }
    const list = Array.isArray(attachments) ? attachments : [];
    const bodyText = String(text || "").trim();
    if (!bodyText && !list.length) {
      res.status(400).json({ success: false, message: "text or attachments required" });
      return;
    }
    const safeList = list
      .filter(
        (a) =>
          a &&
          typeof a === "object" &&
          typeof (a as { url?: string }).url === "string" &&
          String((a as { url?: string }).url).includes("/v1/uploads/files/"),
      )
      .slice(0, 3) as typeof list;
    const msg = makeMessage({
      role: "agent",
      contentType: safeList.length ? "attachments" : "text",
      body: bodyText || (safeList.length ? "Sent an attachment" : ""),
      senderName: agentName || "Agent",
      attachments: safeList.length ? safeList : undefined,
    });
    await appendMessages(conversation.id, [msg]);
    publish(conversation.id, { type: "agent_message", message: msg });
    res.json({ success: true, data: { message: msg } });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : "Message failed",
    });
  }
});
agentRouter.post("/release", async (req, res) => {
  const conversation = await getConversation(String(req.body?.conversationId || ""));
  if (!conversation) {
    res.status(404).json({ success: false, message: "Conversation not found" });
    return;
  }
  conversation.humanTakeover = false;
  conversation.state.humanTakeover = false;
  conversation.handoffState = "not_requested";
  conversation.state.handoffState = "not_requested";
  await saveConversation(conversation);
  const msg = makeMessage({
    role: "system",
    contentType: "system_event",
    body: "AI assistant is available again",
    systemEvent: { type: "ai_resumed", text: "AI assistant is available again" },
  });
  await appendMessages(conversation.id, [msg]);
  publish(conversation.id, { type: "ai_resumed" });
  res.json({ success: true });
});

void env;
