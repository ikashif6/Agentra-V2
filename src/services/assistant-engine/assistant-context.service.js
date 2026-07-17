/**
 * Assemble turn context without mixing configuration into message history.
 */

function recentMessages(session, limit = 12) {
  const msgs = Array.isArray(session?.messages) ? session.messages : [];
  return msgs.slice(-limit).map((m) => ({
    role: m.role === 'bot' ? 'assistant' : m.role,
    body: String(m.body || '').slice(0, 500),
    contentType: m.contentType || 'text',
  }));
}

function assembleTurnContext({ session, conversationState = null, summary = null } = {}) {
  const state = conversationState || session?.workflowState || {};
  return {
    recentMessages: recentMessages(session, 12),
    verified: { ...(state.verifiedContext || {}) },
    collected: { ...(state.collectedContext || {}) },
    currentGoal: state.currentGoal || null,
    previousGoal: state.previousGoal || null,
    corrections: state.corrections || [],
    pendingConfirmation: state.pendingConfirmation || null,
    activeWorkflow: state.activeWorkflow || null,
    workflowStep: state.workflowStep || null,
    expectedFields: state.expectedFields || [],
    lastResponsePlan: state.lastResponsePlan || null,
    lastToolResults: state.lastToolResults || {},
    summary: summary || state.conversationSummary || null,
  };
}

module.exports = {
  assembleTurnContext,
  recentMessages,
};
