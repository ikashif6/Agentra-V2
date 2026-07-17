/**
 * Grounded response plan after authority resolution.
 */

const { planResponse } = require('../live-chat-response-plan.service');
const { buildForbiddenClaims } = require('./assistant-authority.service');

function buildGroundedPlan({
  responseType,
  customerGoal,
  authority,
  verifiedFacts = {},
  knowledgeFacts = [],
  uncertainties = [],
  allowedActions = [],
  nextQuestion = null,
  components = [],
  quickReplies = [],
  suggestedText = '',
  workflow = null,
  step = null,
} = {}) {
  const forbiddenClaims = buildForbiddenClaims(authority, [
    ...(uncertainties || []).map((u) => `Claimed certainty about: ${u}`),
  ]);

  const plan = planResponse({
    responseType,
    messageGoal: customerGoal || '',
    allowedFacts: {
      verified: verifiedFacts,
      knowledge: knowledgeFacts,
      uncertainties,
      allowedActions,
    },
    forbiddenClaims,
    components,
    quickReplies,
    suggestedText,
    workflow,
    step,
  });

  return {
    ...plan,
    ownerInstructions: authority?.ownerStyleGuidance || '',
    customerGoal: customerGoal || '',
    verifiedFacts,
    knowledgeFacts,
    uncertainties,
    allowedActions,
    forbiddenClaims,
    nextQuestion,
  };
}

function buildPermissionDeniedPlan({ permission, authority, customerGoal }) {
  return buildGroundedPlan({
    responseType: 'capability_unavailable',
    customerGoal: customerGoal || 'Customer goal retained; capability unavailable',
    authority,
    verifiedFacts: {},
    knowledgeFacts: [],
    uncertainties: ['Requested action is not enabled for this channel'],
    allowedActions: [],
    suggestedText: permission?.safeMessage || 'That action is not available right now.',
    quickReplies: [
      { id: 'handoff', label: 'Talk to support', action: 'handoff' },
      { id: 'other', label: 'Something else', action: 'continue_with_ai' },
    ],
  });
}

module.exports = {
  buildGroundedPlan,
  buildPermissionDeniedPlan,
};
