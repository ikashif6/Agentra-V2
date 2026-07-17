/**
 * Semantic understanding wrapper — capabilities are context only, never rewrite intent.
 */

const {
  understandCustomerMessage,
} = require('../live-chat-understanding.service');

async function understandTurn({
  message,
  turnContext,
  runtimeConfig,
} = {}) {
  const understanding = await understandCustomerMessage(String(message || ''), {
    activeWorkflow: turnContext?.activeWorkflow,
    workflowStep: turnContext?.workflowStep,
    expectedFields: turnContext?.expectedFields,
    currentGoal: turnContext?.currentGoal,
    verifiedContext: turnContext?.verified,
    collectedContext: turnContext?.collected,
    lastAssistantMessage: [...(turnContext?.recentMessages || [])]
      .reverse()
      .find((m) => m.role === 'assistant')?.body,
    lastResponsePlan: turnContext?.lastResponsePlan,
    recentTurns: turnContext?.recentMessages || [],
    // Capability availability is informational only for the model
    availableCapabilities: runtimeConfig?.capabilities || {},
  });

  return {
    ...understanding,
    // Preserve semantic intent even when a capability is disabled
    capabilityContext: runtimeConfig?.capabilities || {},
  };
}

module.exports = {
  understandTurn,
};
