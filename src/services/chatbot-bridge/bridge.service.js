/**
 * Live-chat bridge: Agentra sessions → standalone Chatbot AI Agent turns.
 * Does not rewrite chatbot logic — only supplies config/data via bridge APIs
 * and maps responses into Agentra sessions/tickets.
 */

const { mergeLiveChatConfig } = require('../live-chat-config.service');
const { resolveChannelAiConfig } = require('../ai-agent-config.service');
const { appendSessionMessage } = require('../live-chat-session.service');
const {
  HANDOFF_STATUSES,
  ACTIVE_RESPONDERS,
  setHandoffStatus,
  buildHandoffWidgetPayload,
  ensureHandoffState,
} = require('../live-chat-workflow.service');
const { workspaceIdForCompany } = require('./workspace-config.service');
const { createOrResumeSession, runTurn } = require('./client');

function isChatbotEngineEnabled(company) {
  const flag = String(process.env.CHATBOT_ENGINE_ENABLED || '').toLowerCase();
  if (flag === '1' || flag === 'true' || flag === 'yes') return true;
  const pipeline = String(process.env.AI_CONVERSATION_PIPELINE || '').toLowerCase();
  if (pipeline === 'chatbot' || pipeline === 'clean') return true;
  const companyMode = String(company?.aiAgent?.assistantEngine || company?.liveChat?.ai?.engine || '')
    .toLowerCase();
  return companyMode === 'chatbot' || companyMode === 'clean';
}

function ensureBridgeState(session) {
  if (!session.chatbotBridge || typeof session.chatbotBridge !== 'object') {
    session.chatbotBridge = {};
  }
  return session.chatbotBridge;
}

function mapEngineMessage(msg, agentName) {
  const role = msg.role === 'user' || msg.role === 'customer' ? 'customer' : msg.role === 'agent' ? 'agent' : 'bot';
  const contentType =
    msg.contentType === 'product_cards' ||
    msg.contentType === 'order_card' ||
    msg.contentType === 'input_form' ||
    msg.contentType === 'system_event' ||
    msg.contentType === 'attachments'
      ? msg.contentType === 'attachments'
        ? 'text'
        : msg.contentType
      : 'text';

  return {
    role: role === 'customer' ? 'bot' : role, // only assistant/agent/system should be appended as replies
    body: String(msg.body || msg.content || msg.text || ''),
    contentType: contentType === 'system_event' ? 'system_event' : contentType,
    payload: msg.payload || msg.meta || undefined,
    senderName: msg.senderName || agentName,
  };
}

async function ensureEngineConversation(company, session) {
  const bridge = ensureBridgeState(session);
  const workspaceId = workspaceIdForCompany(company);
  if (bridge.conversationId && bridge.sessionToken) {
    return bridge;
  }

  const data = await createOrResumeSession({
    workspaceId,
    sessionToken: session.sessionToken,
    visitorEmail: session.visitorEmail,
    channel: 'web',
  });

  bridge.conversationId = data.conversationId;
  bridge.sessionToken = data.sessionToken || session.sessionToken;
  bridge.workspaceId = workspaceId;
  session.markModified('chatbotBridge');
  await session.save();
  return bridge;
}

async function processChatbotEngineTurn(company, session, text, { onStatus, widgetAction = null } = {}) {
  const config = mergeLiveChatConfig(company);
  const channelAi = resolveChannelAiConfig(company, 'liveChat');
  const agentName = config.content.agentName || 'Support Assistant';

  if (onStatus) onStatus('retrieving');

  const bridge = await ensureEngineConversation(company, session);

  const formSubmission =
    widgetAction?.type === 'form_submit' || widgetAction?.formSubmission
      ? widgetAction.formSubmission || widgetAction.payload || widgetAction
      : undefined;
  const choiceId = widgetAction?.choiceId || widgetAction?.id || undefined;

  const result = await runTurn({
    workspaceId: bridge.workspaceId || workspaceIdForCompany(company),
    conversationId: bridge.conversationId,
    sessionToken: bridge.sessionToken || session.sessionToken,
    message: text,
    visitorEmail: session.visitorEmail,
    channel: 'web',
    formSubmission,
    choiceId,
    attachments: widgetAction?.attachments,
  });

  if (result?.conversationId) {
    bridge.conversationId = result.conversationId;
    session.markModified('chatbotBridge');
  }

  const replyMessages = [];
  const engineMessages = Array.isArray(result?.messages)
    ? result.messages
    : result?.assistantMessage
      ? [result.assistantMessage]
      : [];

  // Prefer newly generated assistant/agent messages; fall back to reply text.
  const fresh = engineMessages.filter((m) => m && m.role !== 'user' && m.role !== 'customer');
  if (fresh.length) {
    for (const msg of fresh) {
      if (msg.role === 'system' || msg.contentType === 'system_event') {
        const mapped = mapEngineMessage(msg, agentName);
        const saved = await appendSessionMessage(session, {
          role: 'system',
          body: mapped.body,
          contentType: 'system_event',
          payload: mapped.payload,
          senderName: 'System',
        });
        replyMessages.push(saved);
        continue;
      }
      const mapped = mapEngineMessage(msg, agentName);
      if (!mapped.body && !mapped.payload) continue;
      const saved = await appendSessionMessage(session, {
        role: mapped.role === 'agent' ? 'agent' : 'bot',
        body: mapped.body,
        contentType: mapped.contentType || 'text',
        payload: mapped.payload,
        senderName: mapped.senderName,
      });
      replyMessages.push(saved);
    }
  } else if (result?.reply || result?.message || result?.text) {
    const saved = await appendSessionMessage(session, {
      role: 'bot',
      body: String(result.reply || result.message || result.text),
      contentType: 'text',
      senderName: agentName,
    });
    replyMessages.push(saved);
  }

  const handoffState = String(result?.handoffState || '').toLowerCase();
  const wantsHandoff =
    Boolean(result?.handoff) ||
    ['connecting', 'assigned', 'waiting', 'queued', 'requested'].includes(handoffState);

  if (wantsHandoff) {
    ensureHandoffState(session);
    session.status = 'waiting_human';
    session.handoffRequestedAt = session.handoffRequestedAt || new Date();
    setHandoffStatus(session, HANDOFF_STATUSES.WAITING_FOR_AGENT, {
      requestedAt: new Date().toISOString(),
      activeResponder: ACTIVE_RESPONDERS.QUEUED,
      reason: result?.handoffReason || 'chatbot_engine_handoff',
      customerFacingReason: result?.message || 'Connecting you with a teammate',
      queuePosition: result?.queuePosition,
      estimatedWaitMinutes: result?.estimatedWaitMinutes,
    });
    await session.save();

    return {
      messages: replyMessages,
      handoff: true,
      handoffState: buildHandoffWidgetPayload(session),
      activeResponder: ACTIVE_RESPONDERS.QUEUED,
      turnDebug: {
        engine: 'chatbot',
        handoffState,
        handled: true,
        legacyGroqCalled: false,
      },
      orchestratorBuild: 'chatbot-bridge-2026-07-23',
    };
  }

  await session.save();
  return {
    messages: replyMessages,
    handoff: false,
    handoffState: buildHandoffWidgetPayload(session),
    turnDebug: {
      engine: 'chatbot',
      handled: true,
      legacyGroqCalled: false,
      configSource: 'agentra',
    },
    orchestratorBuild: 'chatbot-bridge-2026-07-23',
  };
}

module.exports = {
  isChatbotEngineEnabled,
  processChatbotEngineTurn,
};
