/**
 * Response planner — deterministic plan before NL generation.
 */

function planResponse({
  responseType,
  messageGoal,
  allowedFacts = {},
  forbiddenClaims = [],
  components = [],
  quickReplies = [],
  suggestedText = '',
  workflow = null,
  step = null,
}) {
  return {
    responseType,
    messageGoal,
    workflow,
    step,
    allowedFacts,
    forbiddenClaims: [
      ...forbiddenClaims,
      'An agent has joined',
      'Your refund has been issued',
      'It will arrive tomorrow',
      'The item is returnable',
    ].filter((v, i, a) => a.indexOf(v) === i),
    components,
    quickReplies,
    suggestedText,
  };
}

async function renderFromPlan(plan, { groqChat, isGroqConfigured, agentName }) {
  if (!plan) {
    return { text: 'How can I help you today?', components: [], quickReplies: [] };
  }
  if (plan.suggestedText && (!isGroqConfigured || !groqChat)) {
    return {
      text: plan.suggestedText,
      components: plan.components || [],
      quickReplies: plan.quickReplies || [],
    };
  }

  if (plan.suggestedText && process.env.AI_SKIP_RESPONSE_LLM === '1') {
    return {
      text: plan.suggestedText,
      components: plan.components || [],
      quickReplies: plan.quickReplies || [],
    };
  }

  if (!isGroqConfigured || !groqChat) {
    return {
      text: plan.suggestedText || plan.messageGoal || 'How can I help?',
      components: plan.components || [],
      quickReplies: plan.quickReplies || [],
    };
  }

  try {
    const model = process.env.GROQ_RESPONSE_MODEL || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
    const text = await groqChat({
      model,
      temperature: 0.25,
      maxTokens: 220,
      messages: [
        {
          role: 'system',
          content: `You write a brief customer-facing chat reply for ${agentName || 'support'}.
Use ONLY these allowed facts: ${JSON.stringify(plan.allowedFacts || {})}.
Never claim: ${(plan.forbiddenClaims || []).join('; ')}.
Goal: ${plan.messageGoal}
Prefer the suggested phrasing if provided. 1-3 short sentences. No markdown fences.
Never use em dashes, en dashes, or double hyphens (--). Use commas or periods instead.`,
        },
        {
          role: 'user',
          content: plan.suggestedText || plan.messageGoal || 'Help the customer.',
        },
      ],
    });
    return {
      text: String(text || plan.suggestedText || '').trim(),
      components: plan.components || [],
      quickReplies: plan.quickReplies || [],
    };
  } catch {
    return {
      text: plan.suggestedText || plan.messageGoal || 'How can I help?',
      components: plan.components || [],
      quickReplies: plan.quickReplies || [],
    };
  }
}

module.exports = {
  planResponse,
  renderFromPlan,
};
