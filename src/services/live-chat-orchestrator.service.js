/**
 * Live-chat turn orchestrator — wires understanding, workflows, tools,
 * pending confirmations, response plans, and handoff into one path.
 */

const {
  understandCustomerMessage,
} = require('./live-chat-understanding.service');
const {
  applyExtractedToWorkflow,
  ensureWorkflowState,
  ensureHandoffState,
  offerHandoff,
  buildHandoffWidgetPayload,
  HANDOFF_STATUSES,
} = require('./live-chat-workflow.service');
const {
  setWorkflowStep,
  getMissingForStep,
  isReturnEligible,
} = require('./live-chat-workflow-engine.service');
const {
  verifyOrderForSession,
  appendSessionMessage,
} = require('./live-chat-session.service');
const {
  formatOrderCard,
  formatProductCards,
  searchProducts,
  buildOrderLookupForm,
  buildShippingAddressForm,
} = require('./live-chat-tools.service');
const { defaultPermissions, canPerform } = require('./live-chat-permissions.service');
const {
  createPendingAction,
  confirmAndExecute,
  buildConfirmationCard,
} = require('./live-chat-pending-action.service');
const { planResponse, renderFromPlan } = require('./live-chat-response-plan.service');
const { maybeSummarizeSession, buildHistoryWithSummary } = require('./live-chat-summary.service');
const {
  getSupportAvailability,
  formatNextOpeningForCustomer,
} = require('./live-chat-hours.service');
const { groqChat, isGroqConfigured } = require('./groq.service');
const { retrieveKnowledge } = require('./live-chat-knowledge.service');
const ContactRequest = require('../models/ContactRequest');
const crypto = require('crypto');
const {
  ORCHESTRATOR_BUILD,
  matchDeterministicIntent,
  resolveTurnRoute,
  switchWorkflow,
  buildTurnDebug,
  logTurnDebug,
} = require('./live-chat-turn-route.service');

function baseResult(session, messages, extra = {}) {
  return {
    messages,
    handoff: false,
    handoffState: buildHandoffWidgetPayload(session),
    ...extra,
  };
}

async function emitPlan(session, config, plan) {
  const rendered = await renderFromPlan(plan, {
    groqChat,
    isGroqConfigured: isGroqConfigured(),
    agentName: config.content.agentName,
  });

  let contentType = 'text';
  let payload;
  const component = (plan.components || [])[0];
  if (component?.type === 'order_card') {
    contentType = 'order_card';
    payload = component.order;
  } else if (component?.type === 'product_cards') {
    contentType = 'product_cards';
    payload = { products: component.products };
  } else if (component?.type === 'input_form' || component?.type === 'confirmation_card') {
    contentType = 'input_form';
    payload = component.form || component;
  } else if (component?.type === 'item_selector') {
    contentType = 'input_form';
    payload = {
      formId: 'select_return_item',
      title: component.title || 'Select an item',
      fields: [
        {
          name: 'selectedLineItemId',
          type: 'text',
          label: 'Item (enter number or title)',
          placeholder: (component.items || []).map((i, idx) => `${idx + 1}. ${i.title}`).join(' · '),
          required: true,
        },
      ],
      submitLabel: 'Continue',
      items: component.items,
    };
  }

  const msg = await appendSessionMessage(session, {
    role: 'bot',
    body: rendered.text,
    contentType,
    payload,
    senderName: config.content.agentName,
  });

  // Attach quick replies into payload for widget if present
  if (rendered.quickReplies?.length) {
    msg._quickReplies = rendered.quickReplies;
  }
  return msg;
}

async function ensureIdentity(session, company, config, understanding, workflowName) {
  const collected = ensureWorkflowState(session).collectedFields || {};
  applyExtractedToWorkflow(
    session,
    {
      orderNumber: understanding.entities.orderNumber,
      email: understanding.entities.email,
      phone: understanding.entities.phone,
      returnReason: understanding.entities.returnReason,
      productQuery: understanding.entities.productQuery || understanding.entities.productName,
      size: understanding.entities.size,
      color: understanding.entities.color,
    },
    { intent: understanding.intent, workflow: workflowName, step: 'collect_identity' },
  );
  await session.save();

  const missing = getMissingForStep(workflowName, 'collect_identity', session.workflowState.collectedFields);
  if (missing.length) {
    setWorkflowStep(session, workflowName, 'collect_identity');
    await session.save();
    const hasOrder = Boolean(session.workflowState.collectedFields.orderNumber);
    const hasEmail = Boolean(session.workflowState.collectedFields.email);
    const form = buildOrderLookupForm(hasOrder, hasEmail);
    const plan = planResponse({
      responseType: 'collect_identity',
      messageGoal: 'Ask only for missing order identity fields',
      allowedFacts: { missing },
      suggestedText: !hasOrder && !hasEmail
        ? 'Sure — please share your order number and the email used at checkout.'
        : !hasOrder
          ? "Thanks — what's your order number?"
          : "Thanks — what's the email used on that order?",
      components: [{ type: 'input_form', form }],
      workflow: workflowName,
      step: 'collect_identity',
    });
    const msg = await emitPlan(session, config, plan);
    return baseResult(session, [msg], { handled: true });
  }
  return null;
}

async function verifyIdentity(session, company, config, workflowName) {
  setWorkflowStep(session, workflowName, 'verify_order');
  const fields = session.workflowState.collectedFields;
  const verification = await verifyOrderForSession(
    session,
    company,
    fields.orderNumber,
    fields.email,
  );

  if (!verification.verified) {
    const attempts = (session.workflowState.attemptCounts ||= {});
    attempts.orderVerify = (attempts.orderVerify || 0) + 1;
    session.markModified('workflowState');
    await session.save();

    if (attempts.orderVerify >= 3) {
      setWorkflowStep(session, workflowName, 'handoff');
      const copy = offerHandoff(session, 'verification_failed');
      await session.save();
      const msg = await appendSessionMessage(session, {
        role: 'bot',
        body: copy,
        contentType: 'text',
        senderName: config.content.agentName,
      });
      return baseResult(session, [msg], { handled: true });
    }

    setWorkflowStep(session, workflowName, 'collect_identity');
    const form = buildOrderLookupForm(false, false);
    const plan = planResponse({
      responseType: 'order_lookup_failed',
      messageGoal: 'Tell customer identity did not match without leaking which field',
      allowedFacts: {},
      forbiddenClaims: ['Order exists', 'Email is wrong'],
      suggestedText:
        "I couldn't find an order matching that number and email. Please check the details and try again.",
      components: [{ type: 'input_form', form }],
      quickReplies: [
        { id: 'retry', label: 'Try again', action: 'retry_identity' },
        { id: 'handoff', label: 'Talk to support', action: 'handoff' },
      ],
      workflow: workflowName,
      step: 'collect_identity',
    });
    const msg = await emitPlan(session, config, plan);
    return baseResult(session, [msg], { handled: true });
  }

  session.workflowState.verifiedFields = {
    ...(session.workflowState.verifiedFields || {}),
    order: true,
    emailOwnership: true,
  };
  session.workflowState.lastSuccessfulAction = 'verify_order';
  session.markModified('workflowState');
  await session.save();
  return { verification };
}

async function handleReturnWorkflow(company, session, config, channelAi, understanding, text) {
  const permissions = defaultPermissions(channelAi);
  if (!canPerform(permissions, 'startReturns')) {
    const copy = offerHandoff(session, 'action_not_permitted');
    await session.save();
    const msg = await appendSessionMessage(session, {
      role: 'bot',
      body: copy,
      contentType: 'text',
      senderName: config.content.agentName,
    });
    return baseResult(session, [msg], { handled: true });
  }

  const workflowName = 'return_request';
  if (!session.workflowState?.activeWorkflow) {
    setWorkflowStep(session, workflowName, 'collect_identity');
  }

  // Confirmation submit
  if (/action_confirm|confirmationToken|Yes,\s*create the return/i.test(text) || understanding.entities.selectedLineItemId === 'confirm') {
    const tokenMatch = text.match(/confirmationToken[:=]\s*([^\s,]+)/i);
    const actionMatch = text.match(/actionId[:=]\s*([^\s,]+)/i);
    if (tokenMatch && actionMatch) {
      const exec = await confirmAndExecute(actionMatch[1], tokenMatch[1], async (args) => {
        if (!canPerform(permissions, 'createReturns')) {
          const err = new Error('ACTION_NOT_PERMITTED');
          err.code = 'ACTION_NOT_PERMITTED';
          err.safeMessage =
            'Your return request has been saved for our team to complete. Would you like me to connect you?';
          throw err;
        }
        return {
          status: 'return_requested',
          orderNumber: args.orderNumber,
          lineItemId: args.lineItemId,
          reason: args.reason,
        };
      });
      if (exec.ok) {
        setWorkflowStep(session, workflowName, 'completed');
        await session.save();
        const msg = await appendSessionMessage(session, {
          role: 'bot',
          body: exec.alreadyExecuted
            ? 'That return was already submitted.'
            : `Your return request for order #${session.workflowState.collectedFields.orderNumber} is in. Our team will email next steps.`,
          contentType: 'text',
          senderName: config.content.agentName,
        });
        return baseResult(session, [msg], { handled: true });
      }
      if (exec.code === 'ACTION_NOT_PERMITTED') {
        const copy = offerHandoff(session, 'action_not_permitted');
        await session.save();
        const msg = await appendSessionMessage(session, {
          role: 'bot',
          body: exec.message || copy,
          contentType: 'text',
          senderName: config.content.agentName,
        });
        return baseResult(session, [msg], { handled: true });
      }
      const msg = await appendSessionMessage(session, {
        role: 'bot',
        body: 'That confirmation is no longer valid. I can start the return review again if you like.',
        contentType: 'text',
        senderName: config.content.agentName,
      });
      return baseResult(session, [msg], { handled: true });
    }
  }

  const idBlock = await ensureIdentity(session, company, config, understanding, workflowName);
  if (idBlock) return idBlock;

  const step = session.workflowState.workflowStep || 'collect_identity';
  if (step === 'collect_identity' || step === 'verify_order') {
    const verified = await verifyIdentity(session, company, config, workflowName);
    if (verified.handled) return verified;
    const order = verified.verification.order;
    const card = formatOrderCard(order);
    const items = (order.lineItems || []).map((li, idx) => ({
      lineItemId: li.externalId || li.id || `line_${idx + 1}`,
      title: li.title || `Item ${idx + 1}`,
      quantity: li.quantity || 1,
      returnable: li.returnable !== false,
    }));

    setWorkflowStep(session, workflowName, 'choose_item');
    await session.save();

    const plan = planResponse({
      responseType: 'order_lookup_success',
      messageGoal: 'Confirm order found and ask which item to return',
      allowedFacts: { orderNumber: card.orderNumber, itemCount: items.length },
      suggestedText: `I found order ${card.orderNumber || '#' + session.workflowState.collectedFields.orderNumber}. Which item would you like to return?`,
      components: [
        { type: 'order_card', order: card },
        { type: 'item_selector', items, title: 'Choose an item to return' },
      ],
      workflow: workflowName,
      step: 'choose_item',
    });
    const msg = await emitPlan(session, config, plan);
    return baseResult(session, [msg], { handled: true });
  }

  if (step === 'choose_item') {
    const orderRef = session.verifiedOrders?.[session.verifiedOrders.length - 1];
    const StoreOrder = require('../models/StoreOrder');
    const order = await StoreOrder.findOne({
      company: company._id,
      externalId: orderRef?.externalId,
    }).lean();
    const items = order?.lineItems || [];
    let selected =
      understanding.entities.selectedLineItemId ||
      session.workflowState.collectedFields.selectedLineItemId;
    if (!selected && text) {
      const asNum = Number(String(text).trim());
      if (Number.isFinite(asNum) && asNum >= 1 && asNum <= items.length) {
        selected = items[asNum - 1].externalId || items[asNum - 1].id || `line_${asNum}`;
      } else {
        const match = items.find((li) =>
          String(li.title || '')
            .toLowerCase()
            .includes(String(text).toLowerCase().slice(0, 40)),
        );
        if (match) selected = match.externalId || match.id || match.title;
      }
    }
    if (!selected) {
      const plan = planResponse({
        responseType: 'choose_item',
        messageGoal: 'Ask customer to pick a line item',
        suggestedText: 'Please choose which item you want to return.',
        components: [
          {
            type: 'item_selector',
            items: items.map((li, idx) => ({
              lineItemId: li.externalId || li.id || `line_${idx + 1}`,
              title: li.title,
              quantity: li.quantity,
            })),
          },
        ],
      });
      const msg = await emitPlan(session, config, plan);
      return baseResult(session, [msg], { handled: true });
    }

    session.workflowState.collectedFields.selectedLineItemId = selected;
    const line = items.find(
      (li, idx) =>
        String(li.externalId || li.id || `line_${idx + 1}`) === String(selected) ||
        li.title === selected,
    );
    const eligibility = isReturnEligible(order, line);
    setWorkflowStep(session, workflowName, 'check_eligibility');
    if (!eligibility.eligible) {
      setWorkflowStep(session, workflowName, 'failed');
      await session.save();
      const msg = await appendSessionMessage(session, {
        role: 'bot',
        body: eligibility.reason + ' I can connect you with support if you want a manual review.',
        contentType: 'text',
        senderName: config.content.agentName,
      });
      offerHandoff(session, 'action_not_permitted');
      await session.save();
      return baseResult(session, [msg], { handled: true });
    }

    setWorkflowStep(session, workflowName, 'collect_reason');
    await session.save();
    if (!session.workflowState.collectedFields.returnReason && !understanding.entities.returnReason) {
      const plan = planResponse({
        responseType: 'collect_reason',
        messageGoal: 'Ask for return reason',
        suggestedText: "Got it — what's the reason for the return?",
        components: [
          {
            type: 'input_form',
            form: {
              formId: 'return_reason',
              title: 'Return reason',
              fields: [
                {
                  name: 'returnReason',
                  type: 'text',
                  label: 'Reason',
                  placeholder: 'Too small / changed mind / damaged…',
                  required: true,
                },
              ],
              submitLabel: 'Continue',
            },
          },
        ],
      });
      const msg = await emitPlan(session, config, plan);
      return baseResult(session, [msg], { handled: true });
    }
  }

  if (understanding.entities.returnReason || /return_reason|returnReason/i.test(text)) {
    const reason =
      understanding.entities.returnReason ||
      text.replace(/^returnReason:\s*/i, '').trim();
    session.workflowState.collectedFields.returnReason = reason;
  }

  if (
    session.workflowState.workflowStep === 'collect_reason' &&
    session.workflowState.collectedFields.returnReason
  ) {
    if (!session.workflowState.collectedFields.refundMethod) {
      setWorkflowStep(session, workflowName, 'choose_refund_method');
      await session.save();
      const plan = planResponse({
        responseType: 'choose_refund_method',
        suggestedText: 'How would you like the refund?',
        components: [
          {
            type: 'input_form',
            form: {
              formId: 'refund_method',
              title: 'Refund method',
              fields: [
                {
                  name: 'refundMethod',
                  type: 'text',
                  label: 'Method',
                  placeholder: 'original_payment or store_credit',
                  required: true,
                },
              ],
              submitLabel: 'Continue',
            },
          },
        ],
      });
      const msg = await emitPlan(session, config, plan);
      return baseResult(session, [msg], { handled: true });
    }
  }

  if (/refundMethod|original_payment|store_credit/i.test(text)) {
    const m = text.match(/store_credit|original_payment/i);
    session.workflowState.collectedFields.refundMethod = (
      m?.[0] ||
      understanding.entities.refundMethod ||
      'original_payment'
    ).toLowerCase();
    session.workflowState.collectedFields.returnMethod =
      session.workflowState.collectedFields.returnMethod || 'mail';
  }

  const fields = session.workflowState.collectedFields || {};
  if (
    fields.selectedLineItemId &&
    fields.returnReason &&
    fields.refundMethod &&
    ['choose_refund_method', 'choose_return_method', 'review', 'collect_reason'].includes(
      session.workflowState.workflowStep,
    )
  ) {
    setWorkflowStep(session, workflowName, 'review');
    const { action, token } = await createPendingAction({
      companyId: company._id,
      sessionId: session._id,
      type: 'create_return',
      args: {
        orderNumber: fields.orderNumber,
        email: fields.email,
        lineItemId: fields.selectedLineItemId,
        reason: fields.returnReason,
        refundMethod: fields.refundMethod,
        returnMethod: fields.returnMethod || 'mail',
      },
    });
    setWorkflowStep(session, workflowName, 'awaiting_confirmation');
    await session.save();

    const form = buildConfirmationCard(action, token || 'reused', {
      title: 'Confirm return',
      summaryLines: [
        `Order #${fields.orderNumber}`,
        `Item: ${fields.selectedLineItemId}`,
        `Reason: ${fields.returnReason}`,
        `Refund: ${fields.refundMethod}`,
      ],
      confirmLabel: 'Yes, create the return',
    });
    form.formId = 'action_confirm';
    form.fields = [
      {
        name: 'confirmPayload',
        type: 'text',
        label: 'Type YES to confirm',
        placeholder: 'YES',
        required: true,
      },
    ];
    form._actionId = action.actionId;
    form._confirmationToken = token;
    form.submitLabel = 'Confirm return';
    form.summaryLines = form.summaryLines || [
      `Order #${fields.orderNumber}`,
      `Item: ${fields.selectedLineItemId}`,
      `Reason: ${fields.returnReason}`,
      `Refund: ${fields.refundMethod}`,
    ];

    const plan = planResponse({
      responseType: 'awaiting_confirmation',
      suggestedText: 'Please confirm your return request.',
      allowedFacts: {
        orderNumber: fields.orderNumber,
        reason: fields.returnReason,
      },
      components: [{ type: 'confirmation_card', form }],
      workflow: workflowName,
      step: 'awaiting_confirmation',
    });
    const msg = await emitPlan(session, config, plan);
    // Store token on session for YES shortcut
    session.workflowState.pendingActionId = action.actionId;
    session.workflowState.pendingActionToken = token;
    session.markModified('workflowState');
    await session.save();
    return baseResult(session, [msg], { handled: true });
  }

  if (
    session.workflowState.workflowStep === 'awaiting_confirmation' &&
    /^\s*(yes|confirm|yes,\s*create the return)\s*$/i.test(text)
  ) {
    const actionId = session.workflowState.pendingActionId;
    const token = session.workflowState.pendingActionToken;
    if (actionId && token) {
      const exec = await confirmAndExecute(actionId, token, async (args) => ({
        status: canPerform(permissions, 'createReturns') ? 'created' : 'queued_for_team',
        ...args,
      }));
      setWorkflowStep(session, workflowName, exec.ok ? 'completed' : 'failed');
      await session.save();
      const msg = await appendSessionMessage(session, {
        role: 'bot',
        body: exec.ok
          ? canPerform(permissions, 'createReturns')
            ? 'Your return is confirmed. Watch your email for the return label and next steps.'
            : 'Thanks — your return request is confirmed and queued for our team to finish setup.'
          : 'I could not confirm that return. Please try again or ask for a human.',
        contentType: 'text',
        senderName: config.content.agentName,
      });
      return baseResult(session, [msg], { handled: true });
    }
  }

  return { handled: false };
}

async function handleExchangeWorkflow(company, session, config, channelAi, understanding, text) {
  const permissions = defaultPermissions(channelAi);
  if (!canPerform(permissions, 'exchangeItems') && !canPerform(permissions, 'startReturns')) {
    // Allow starting exchange intake even if create is disabled — then handoff
  }
  const workflowName = 'exchange_item';
  setWorkflowStep(session, workflowName, session.workflowState?.workflowStep || 'collect_identity');

  const idBlock = await ensureIdentity(session, company, config, understanding, workflowName);
  if (idBlock) return idBlock;

  if (
    session.workflowState.workflowStep === 'collect_identity' ||
    session.workflowState.workflowStep === 'verify_order'
  ) {
    const verified = await verifyIdentity(session, company, config, workflowName);
    if (verified.handled) return verified;
    setWorkflowStep(session, workflowName, 'choose_item');
    await session.save();
    const card = formatOrderCard(verified.verification.order);
    const plan = planResponse({
      responseType: 'exchange_choose_item',
      suggestedText: `I found order ${card.orderNumber}. Which item do you want to exchange, and what size/color do you need?`,
      components: [{ type: 'order_card', order: card }],
      allowedFacts: { orderNumber: card.orderNumber },
    });
    const msg = await emitPlan(session, config, plan);
    return baseResult(session, [msg], { handled: true });
  }

  applyExtractedToWorkflow(session, understanding.entities, {
    intent: 'exchange_item',
    workflow: workflowName,
    step: session.workflowState.workflowStep,
  });

  const fields = session.workflowState.collectedFields;
  if (fields.size || fields.color || fields.selectedLineItemId) {
    if (!canPerform(permissions, 'exchangeItems')) {
      const copy = offerHandoff(session, 'action_not_permitted');
      setWorkflowStep(session, workflowName, 'handoff');
      await session.save();
      const msg = await appendSessionMessage(session, {
        role: 'bot',
        body:
          "I've noted the exchange details. Creating exchanges needs a specialist on this store. " +
          copy,
        contentType: 'text',
        senderName: config.content.agentName,
      });
      return baseResult(session, [msg], { handled: true });
    }
    setWorkflowStep(session, workflowName, 'check_inventory');
    await session.save();
    const msg = await appendSessionMessage(session, {
      role: 'bot',
      body: `I'll check availability for ${[fields.size && `size ${fields.size}`, fields.color && `${fields.color}`]
        .filter(Boolean)
        .join(', ') || 'that variant'}. A teammate may need to confirm stock before we finalize.`,
      contentType: 'text',
      senderName: config.content.agentName,
    });
    return baseResult(session, [msg], { handled: true });
  }

  return { handled: false };
}

async function handleProductWorkflow(company, session, config, channelAi, understanding, text) {
  const permissions = defaultPermissions(channelAi);
  if (!canPerform(permissions, 'recommendProducts')) {
    const msg = await appendSessionMessage(session, {
      role: 'bot',
      body: 'Product recommendations are not enabled for this chat. I can still help with orders or policies.',
      contentType: 'text',
      senderName: config.content.agentName,
    });
    return baseResult(session, [msg], { handled: true });
  }

  const workflowName = 'product_search';
  const productBits = [
    understanding.entities.color,
    understanding.entities.category,
    understanding.entities.productName,
    understanding.entities.occasion,
    understanding.entities.productQuery,
    understanding.entities.size,
  ].filter(Boolean);

  // Never use an unrelated support sentence as the catalog query
  const looksLikeProductQuery =
    productBits.length > 0 ||
    /\b(dress|gown|shoes|veil|recommend|looking for|show me|wedding|prom|size|color|budget)\b/i.test(
      text,
    );

  if (!looksLikeProductQuery) {
    setWorkflowStep(session, workflowName, 'collect_missing_preferences');
    await session.save();
    const plan = planResponse({
      responseType: 'product_need_prefs',
      suggestedText:
        'Tell me the occasion, size, color, or budget and I will search the catalog for you.',
      workflow: workflowName,
      step: 'collect_missing_preferences',
    });
    const msg = await emitPlan(session, config, plan);
    return baseResult(session, [msg], { handled: true, responsePlanType: 'product_need_prefs' });
  }

  setWorkflowStep(session, workflowName, 'understand_request');
  applyExtractedToWorkflow(
    session,
    {
      productQuery:
        understanding.entities.productQuery ||
        understanding.entities.productName ||
        productBits.join(' ') ||
        text,
      size: understanding.entities.size,
      color: understanding.entities.color,
    },
    { intent: understanding.intent, workflow: workflowName, step: 'search_catalog' },
  );

  const q = (productBits.length ? productBits.join(' ') : text).slice(0, 120);

  setWorkflowStep(session, workflowName, 'search_catalog');
  const products = await searchProducts(company._id, q, 4);
  if (!products.length) {
    setWorkflowStep(session, workflowName, 'collect_missing_preferences');
    await session.save();
    const plan = planResponse({
      responseType: 'product_no_results',
      suggestedText:
        "I couldn't find a match yet. Tell me the occasion, size, color, or budget and I'll search again.",
      workflow: workflowName,
      step: 'collect_missing_preferences',
    });
    const msg = await emitPlan(session, config, plan);
    return baseResult(session, [msg], { handled: true, responsePlanType: 'product_no_results' });
  }

  const cards = formatProductCards(products);
  setWorkflowStep(session, workflowName, 'present_results');
  await session.save();
  const plan = planResponse({
    responseType: 'product_results',
    messageGoal: 'Present matching products without inventing stock claims',
    allowedFacts: {
      count: cards.length,
      query: q,
      size: understanding.entities.size,
      color: understanding.entities.color,
      budgetMax: understanding.entities.budgetMax,
    },
    forbiddenClaims: ['In stock forever', 'Arrives tomorrow'],
    suggestedText: 'Here are a few options that may fit. Tell me if you want a different size, color, or budget.',
    components: [{ type: 'product_cards', products: cards }],
    workflow: workflowName,
    step: 'present_results',
  });
  const msg = await emitPlan(session, config, plan);
  return baseResult(session, [msg], { handled: true, responsePlanType: 'product_results' });
}

async function handleContactRequest(company, session, config, understanding, text) {
  const workflowName = 'contact_request';
  const lower = String(text || '').toLowerCase();
  const collected = ensureWorkflowState(session).collectedFields || {};

  // Never treat session.visitorEmail as an already-submitted contact request
  const emailFromTurn =
    understanding.entities.email ||
    (collected.contactEmailExplicit ? collected.email : null) ||
    null;
  const phoneFromTurn =
    understanding.entities.phone ||
    (collected.contactPhoneExplicit ? collected.phone : null) ||
    null;

  const choosesEmail = /\b(use )?email\b|email address/i.test(lower);
  const choosesPhone = /\b(use )?phone\b|phone number|call me\b/i.test(lower);
  const confirms =
    /^(yes|confirm|submit|send it|looks good|that'?s correct)\b/i.test(lower.trim()) ||
    understanding.entities.confirmPayload;

  const step = session.workflowState?.workflowStep;

  // Entry / "where can I leave contact details"
  if (
    !step ||
    step === 'offer_contact_request' ||
    step === 'collect_contact_method' ||
    /where can i leave|leave (my )?contact|contact details/i.test(lower)
  ) {
    if (!choosesEmail && !choosesPhone && !emailFromTurn && !phoneFromTurn) {
      setWorkflowStep(session, workflowName, 'collect_contact_method');
      applyExtractedToWorkflow(session, {}, {
        intent: 'start_contact_request',
        workflow: workflowName,
        step: 'collect_contact_method',
      });
      await session.save();
      const plan = planResponse({
        responseType: 'collect_contact_method',
        suggestedText:
          'You can leave an email address or phone number here, and the support team can follow up.',
        quickReplies: [
          { id: 'use_email', label: 'Use email', action: 'use_email' },
          { id: 'use_phone', label: 'Use phone', action: 'use_phone' },
          { id: 'ai', label: 'Keep chatting with AI', action: 'cancel_handoff_and_continue_ai' },
        ],
        components: [{ type: 'offline_contact_options' }],
      });
      const msg = await emitPlan(session, config, plan);
      return baseResult(session, [msg], {
        handled: true,
        contactRequestCreated: false,
        responsePlanType: 'collect_contact_method',
      });
    }
  }

  if (choosesEmail || step === 'collect_email') {
    if (!emailFromTurn) {
      setWorkflowStep(session, workflowName, 'collect_email');
      await session.save();
      const plan = planResponse({
        responseType: 'collect_contact',
        suggestedText: 'Enter the email address the support team should use.',
        components: [
          {
            type: 'input_form',
            form: {
              formId: 'contact_request_email',
              title: 'Contact email',
              fields: [
                {
                  name: 'email',
                  type: 'email',
                  label: 'Email',
                  placeholder: 'you@example.com',
                  required: true,
                },
              ],
              submitLabel: 'Continue',
            },
          },
        ],
      });
      const msg = await emitPlan(session, config, plan);
      return baseResult(session, [msg], { handled: true, contactRequestCreated: false });
    }
    applyExtractedToWorkflow(
      session,
      { email: emailFromTurn },
      { intent: 'start_contact_request', workflow: workflowName, step: 'review_contact_request' },
    );
    session.workflowState.collectedFields.contactEmailExplicit = true;
    session.workflowState.collectedFields.contactMethod = 'email';
    setWorkflowStep(session, workflowName, 'review_contact_request');
    await session.save();
    const plan = planResponse({
      responseType: 'review_contact_request',
      suggestedText: `Please confirm: we should contact you at ${emailFromTurn} about your request.`,
      quickReplies: [
        { id: 'confirm', label: 'Yes, submit', action: 'confirm_contact' },
        { id: 'edit', label: 'Change email', action: 'use_email' },
      ],
    });
    const msg = await emitPlan(session, config, plan);
    return baseResult(session, [msg], { handled: true, contactRequestCreated: false });
  }

  if (choosesPhone || step === 'collect_phone') {
    if (!phoneFromTurn) {
      setWorkflowStep(session, workflowName, 'collect_phone');
      await session.save();
      const plan = planResponse({
        responseType: 'collect_contact',
        suggestedText: 'Enter the phone number the support team should use.',
        components: [
          {
            type: 'input_form',
            form: {
              formId: 'contact_request_phone',
              title: 'Contact phone',
              fields: [
                {
                  name: 'phone',
                  type: 'tel',
                  label: 'Phone',
                  placeholder: '+1…',
                  required: true,
                },
              ],
              submitLabel: 'Continue',
            },
          },
        ],
      });
      const msg = await emitPlan(session, config, plan);
      return baseResult(session, [msg], { handled: true, contactRequestCreated: false });
    }
    applyExtractedToWorkflow(
      session,
      { phone: phoneFromTurn },
      { intent: 'start_contact_request', workflow: workflowName, step: 'review_contact_request' },
    );
    session.workflowState.collectedFields.contactPhoneExplicit = true;
    session.workflowState.collectedFields.contactMethod = 'phone';
    setWorkflowStep(session, workflowName, 'review_contact_request');
    await session.save();
    const plan = planResponse({
      responseType: 'review_contact_request',
      suggestedText: `Please confirm: we should contact you at ${phoneFromTurn} about your request.`,
      quickReplies: [
        { id: 'confirm', label: 'Yes, submit', action: 'confirm_contact' },
        { id: 'edit', label: 'Change phone', action: 'use_phone' },
      ],
    });
    const msg = await emitPlan(session, config, plan);
    return baseResult(session, [msg], { handled: true, contactRequestCreated: false });
  }

  // Explicit email/phone typed without choosing method first
  if (emailFromTurn || phoneFromTurn) {
    const method = emailFromTurn ? 'email' : 'phone';
    const value = emailFromTurn || phoneFromTurn;
    applyExtractedToWorkflow(
      session,
      emailFromTurn ? { email: emailFromTurn } : { phone: phoneFromTurn },
      { intent: 'start_contact_request', workflow: workflowName, step: 'review_contact_request' },
    );
    if (emailFromTurn) session.workflowState.collectedFields.contactEmailExplicit = true;
    if (phoneFromTurn) session.workflowState.collectedFields.contactPhoneExplicit = true;
    session.workflowState.collectedFields.contactMethod = method;
    setWorkflowStep(session, workflowName, 'review_contact_request');
    await session.save();
    const plan = planResponse({
      responseType: 'review_contact_request',
      suggestedText: `Please confirm: we should contact you at ${value} about your request.`,
      quickReplies: [
        { id: 'confirm', label: 'Yes, submit', action: 'confirm_contact' },
        { id: 'edit', label: 'Change details', action: 'start_contact_request' },
      ],
    });
    const msg = await emitPlan(session, config, plan);
    return baseResult(session, [msg], { handled: true, contactRequestCreated: false });
  }

  if (step === 'review_contact_request' || step === 'awaiting_confirmation') {
    const method = collected.contactMethod;
    const email = collected.contactEmailExplicit ? collected.email : null;
    const phone = collected.contactPhoneExplicit ? collected.phone : null;
    if (!confirms) {
      const plan = planResponse({
        responseType: 'review_contact_request',
        suggestedText: 'Reply “Yes, submit” to send this contact request to the support team.',
        quickReplies: [{ id: 'confirm', label: 'Yes, submit', action: 'confirm_contact' }],
      });
      const msg = await emitPlan(session, config, plan);
      return baseResult(session, [msg], { handled: true, contactRequestCreated: false });
    }
    if (!method || (!email && !phone)) {
      const msg = await appendSessionMessage(session, {
        role: 'bot',
        body: 'CONTACT_DETAILS_REQUIRED: please share an email or phone number before I can submit a contact request.',
        contentType: 'text',
        senderName: config.content.agentName,
      });
      return baseResult(session, [msg], {
        handled: true,
        contactRequestCreated: false,
        error: 'CONTACT_DETAILS_REQUIRED',
      });
    }

    const requestId = `contact_${crypto.randomBytes(8).toString('hex')}`;
    const idempotencyKey = `contact:${session._id}:${email || ''}:${phone || ''}`;
    const existing = await ContactRequest.findOne({ idempotencyKey, status: 'submitted' });
    if (existing) {
      const msg = await appendSessionMessage(session, {
        role: 'bot',
        body: 'Your contact request is already with the team. They’ll follow up during the next business day.',
        contentType: 'text',
        senderName: config.content.agentName,
      });
      return baseResult(session, [msg], { handled: true, contactRequestCreated: false });
    }

    await ContactRequest.create({
      company: company._id,
      session: session._id,
      requestId,
      status: 'submitted',
      email,
      phone,
      preferredMethod: method,
      issueSummary: String(session.workflowState?.activeIntent || 'support'),
      consentToContact: true,
      idempotencyKey,
      submittedAt: new Date(),
    });

    setWorkflowStep(session, workflowName, 'submitted');
    await session.save();
    const next = formatNextOpeningForCustomer(company);
    const msg = await appendSessionMessage(session, {
      role: 'bot',
      body: `Thanks — your request has been sent to the support team.${next ? ` ${next}` : ' They’ll follow up during the next business day.'}`,
      contentType: 'text',
      senderName: config.content.agentName,
    });
    return baseResult(session, [msg], { handled: true, contactRequestCreated: true });
  }

  // Fallback: ask for method again — never invent success
  setWorkflowStep(session, workflowName, 'collect_contact_method');
  await session.save();
  const plan = planResponse({
    responseType: 'collect_contact_method',
    suggestedText:
      'You can leave an email address or phone number here, and the support team can follow up.',
    quickReplies: [
      { id: 'use_email', label: 'Use email', action: 'use_email' },
      { id: 'use_phone', label: 'Use phone', action: 'use_phone' },
      { id: 'ai', label: 'Keep chatting with AI', action: 'cancel_handoff_and_continue_ai' },
    ],
  });
  const msg = await emitPlan(session, config, plan);
  return baseResult(session, [msg], { handled: true, contactRequestCreated: false });
}

async function handleRefundNotReceived(company, session, config, understanding) {
  const workflowName = 'refund_investigation';
  setWorkflowStep(session, workflowName, 'explain_refund_timeline');
  applyExtractedToWorkflow(session, understanding.entities, {
    intent: 'refund_not_received',
    workflow: workflowName,
    step: 'explain_refund_timeline',
  });

  let orderFacts = null;
  if (session.verifiedOrders?.length || session.workflowState?.verifiedFields?.order) {
    const verified = await verifyIdentity(session, company, config, workflowName);
    if (verified.verification?.order) {
      orderFacts = formatOrderCard(verified.verification.order);
    }
  }

  const fin = String(orderFacts?.financialStatus || '').toLowerCase();
  const markedRefunded = /refund/.test(fin);
  const body = markedRefunded
    ? `The store has marked order ${orderFacts.orderNumber || ''} as refunded, but that status alone does not confirm when the money will appear in your account. Refunds are submitted to the payment processor and then posted by your bank or card issuer — that can take several business days after the store marks it refunded. I do not have confirmation that the funds have already reached you.`.replace(
        /\s+/g,
        ' ',
      ).trim()
    : 'I can look into a missing payment, but I need to confirm the order first. Share the order number and checkout email if you have not already.';

  await session.save();
  const plan = planResponse({
    responseType: 'refund_not_received',
    suggestedText: body,
    allowedFacts: orderFacts
      ? {
          orderNumber: orderFacts.orderNumber,
          financialStatus: orderFacts.financialStatus,
          storeMarkedRefunded: markedRefunded,
        }
      : {},
    forbiddenClaims: [
      'Refund completed',
      'Payment was returned',
      'The refund has reached your bank',
      'Money is in your account',
    ],
    // Do NOT re-attach the order card for this follow-up
    components: [],
    quickReplies: [
      { id: 'handoff', label: 'Talk to support', action: 'handoff' },
      { id: 'contact', label: 'Leave contact details', action: 'start_contact_request' },
    ],
  });
  const msg = await emitPlan(session, config, plan);
  return baseResult(session, [msg], { handled: true, responsePlanType: 'refund_not_received' });
}

async function handleRefundRequest(company, session, config, channelAi, understanding, text) {
  const workflowName = 'refund';
  setWorkflowStep(session, workflowName, 'collect_identity');
  applyExtractedToWorkflow(session, understanding.entities, {
    intent: 'refund_request',
    workflow: workflowName,
    step: 'collect_identity',
  });

  const idBlock = await ensureIdentity(session, company, config, understanding, workflowName);
  if (idBlock) return idBlock;
  const verified = await verifyIdentity(session, company, config, workflowName);
  if (verified.handled) return verified;

  const order = verified.verification?.order;
  const fin = String(order?.financialStatus || '').toLowerCase();
  if (/refund/.test(fin)) {
    // Already refunded on store — treat as timeline question, not another order card dump
    return handleRefundNotReceived(company, session, config, understanding);
  }

  // Start return/refund path rather than inventing a completed refund
  return handleReturnWorkflow(company, session, config, channelAi, understanding, text);
}

async function handlePolicy(company, session, config, text) {
  const knowledge = await retrieveKnowledge(company._id, text, 4);
  if (!knowledge.length) {
    const msg = await appendSessionMessage(session, {
      role: 'bot',
      body: "I don't have a published policy article for that yet. I can connect you with support, or help start a return if you already have an order.",
      contentType: 'text',
      senderName: config.content.agentName,
    });
    return baseResult(session, [msg], { handled: true });
  }
  const facts = knowledge.map((k) => ({ title: k.title, content: k.content.slice(0, 500) }));
  const plan = planResponse({
    responseType: 'policy_answer',
    messageGoal: 'Answer only from retrieved knowledge',
    allowedFacts: { sources: facts },
    forbiddenClaims: ['Invented return window', 'Guaranteed exception'],
    suggestedText: facts[0].content.slice(0, 400),
    quickReplies: [
      { id: 'start_return', label: 'Start a return', action: 'start_return' },
      { id: 'handoff', label: 'Talk to support', action: 'handoff' },
    ],
  });
  const msg = await emitPlan(session, config, plan);
  return baseResult(session, [msg], { handled: true });
}

/**
 * Main orchestrated turn. Returns { handled:false } to fall back to legacy AI path.
 */
async function orchestrateTurn(company, session, text, config, channelAi, { onStatus } = {}) {
  const requestId = crypto.randomBytes(8).toString('hex');
  ensureWorkflowState(session);
  ensureHandoffState(session);
  await maybeSummarizeSession(session, company);

  const previousWorkflow = session.workflowState?.activeWorkflow || null;
  const previousStep = session.workflowState?.workflowStep || null;
  const expectedFields = getMissingForStep(
    session.workflowState?.activeWorkflow,
    session.workflowState?.workflowStep || 'collect_identity',
    session.workflowState?.collectedFields,
  );
  // Product search asks for preferences without formal requiredByStep — treat as soft expected fields
  const softExpected =
    previousWorkflow === 'product_search' &&
    ['collect_missing_preferences', 'understand_request', 'present_results', 'refine_results'].includes(
      previousStep,
    )
      ? ['occasion', 'size', 'color', 'budget']
      : expectedFields;

  const understanding = await understandCustomerMessage(text, {
    activeWorkflow: session.workflowState?.activeWorkflow,
    workflowStep: session.workflowState?.workflowStep,
    expectedFields: softExpected,
    collectedFields: session.workflowState?.collectedFields || {},
    verifiedFields: {
      orderNumber: session.workflowState?.verifiedFields?.order
        ? session.workflowState?.collectedFields?.orderNumber
        : null,
      email: session.workflowState?.verifiedFields?.emailOwnership
        ? session.workflowState?.collectedFields?.email
        : null,
    },
  });

  const det = matchDeterministicIntent(text);
  const route = resolveTurnRoute({
    latestMessage: text,
    detectedIntent: understanding.intent,
    confidence: understanding.confidence,
    activeWorkflow: previousWorkflow,
    expectedFields: softExpected,
    pendingAction: session.workflowState?.pendingActionId || null,
  });

  const servicePath = [
    'widget.controller.sendMessage',
    'live-chat-ai.processCustomerMessage',
    'live-chat-orchestrator.orchestrateTurn',
  ];

  const debugBase = {
    requestId,
    conversationId: session.ticket ? String(session.ticket) : null,
    sessionId: String(session._id),
    workspaceId: String(company._id),
    rawMessage: text,
    normalizedMessage: String(text || '').trim(),
    servicePath,
    orchestratorCalled: true,
    understandingResult: {
      intent: understanding.intent,
      confidence: understanding.confidence,
      source: understanding.source,
    },
    deterministicIntent: det?.intent || understanding.deterministicIntent || null,
    llmIntent: understanding.llmIntent || null,
    resolvedIntent: route.intent,
    previousWorkflow,
    previousStep,
    routeType: route.routeType,
    routeReason: route.reason,
  };

  // Persist entities without locking the previous workflow when switching
  if (route.routeType === 'switch_workflow' || route.routeType === 'start_workflow') {
    switchWorkflow(session, {
      workflow: route.workflow,
      intent: route.intent,
      reason: route.reason,
    });
  }

  applyExtractedToWorkflow(session, understanding.entities, {
    intent: route.intent || understanding.intent,
    workflow: session.workflowState?.activeWorkflow || route.workflow || null,
    step: session.workflowState?.workflowStep,
  });
  await session.save();

  const finish = (result, extras = {}) => {
    const debug = buildTurnDebug({
      ...debugBase,
      newWorkflow: session.workflowState?.activeWorkflow || null,
      newStep: session.workflowState?.workflowStep || null,
      handled: Boolean(result?.handled),
      legacyGroqCalled: false,
      responsePlanType: result?.responsePlanType || extras.responsePlanType || null,
      componentsReturned: extras.componentsReturned || [],
      handoffState: result?.handoffState || buildHandoffWidgetPayload(session),
      contactRequestCreated: Boolean(result?.contactRequestCreated),
    });
    logTurnDebug(debug);
    return {
      ...result,
      turnDebug: debug,
      orchestratorBuild: ORCHESTRATOR_BUILD,
    };
  };

  // ── Handoff (always beats active workflow) ──
  if (route.intent === 'speak_to_human' || route.workflow === 'handoff') {
    setWorkflowStep(session, 'handoff', 'checking_availability');
    const availability = await getSupportAvailability(company);
    if (!availability.queueOpen) {
      const next = formatNextOpeningForCustomer(company);
      const body = !availability.liveSupportEnabled
        ? 'Live support is not available on this channel right now.'
        : availability.reason === 'outside_business_hours'
          ? `Our support team is currently offline.${next ? ` ${next}` : ''}`
          : 'No support agents are available right now.';
      ensureHandoffState(session).status =
        availability.reason === 'outside_business_hours'
          ? HANDOFF_STATUSES.OUTSIDE_BUSINESS_HOURS
          : HANDOFF_STATUSES.UNAVAILABLE;
      session.markModified('handoffState');
      await session.save();
      const plan = planResponse({
        responseType: 'agents_unavailable',
        suggestedText: body,
        quickReplies: [
          { id: 'contact', label: 'Leave contact details', action: 'start_contact_request' },
          { id: 'ai', label: 'Keep chatting with AI', action: 'cancel_handoff_and_continue_ai' },
        ],
        components: [{ type: 'offline_contact_options' }],
      });
      const msg = await emitPlan(session, config, plan);
      return finish(baseResult(session, [msg], {
        handled: true,
        responsePlanType: 'agents_unavailable',
        handoffState: {
          ...buildHandoffWidgetPayload(session),
          status:
            availability.reason === 'outside_business_hours'
              ? 'outside_business_hours'
              : 'unavailable',
        },
      }));
    }
    // Agents available — force legacy handoff queue path (avoid circular import)
    const debug = buildTurnDebug({
      ...debugBase,
      newWorkflow: 'handoff',
      newStep: 'checking_availability',
      handled: false,
      legacyGroqCalled: false,
      responsePlanType: 'force_handoff',
    });
    logTurnDebug(debug);
    return {
      handled: false,
      forceHandoff: true,
      turnDebug: debug,
      orchestratorBuild: ORCHESTRATOR_BUILD,
      understanding,
    };
  }

  // ── Contact request ──
  if (
    route.intent === 'start_contact_request' ||
    route.workflow === 'contact_request' ||
    /leave (my )?contact|leave (your|my) details|where can i leave contact|use email|use phone|confirm_contact/i.test(
      text,
    )
  ) {
    const result = await handleContactRequest(company, session, config, understanding, text);
    return finish(result);
  }

  // ── Refund not received ──
  if (route.intent === 'refund_not_received' || route.workflow === 'refund_investigation') {
    if (onStatus) onStatus('checking_order');
    const result = await handleRefundNotReceived(company, session, config, understanding);
    return finish(result);
  }

  // ── Refund request ──
  if (route.intent === 'refund_request' || route.workflow === 'refund') {
    if (onStatus) onStatus('checking_order');
    const result = await handleRefundRequest(
      company,
      session,
      config,
      channelAi,
      understanding,
      text,
    );
    return finish(result);
  }

  const active = session.workflowState?.activeWorkflow;

  if (
    active === 'return_request' ||
    route.intent === 'start_return' ||
    ['damaged_item', 'wrong_item', 'missing_item'].includes(route.intent)
  ) {
    if (onStatus) onStatus('checking_order');
    const result = await handleReturnWorkflow(
      company,
      session,
      config,
      channelAi,
      understanding,
      text,
    );
    if (result.handled) return finish(result);
  }

  if (active === 'exchange_item' || route.intent === 'exchange_item') {
    if (onStatus) onStatus('checking_order');
    const result = await handleExchangeWorkflow(
      company,
      session,
      config,
      channelAi,
      understanding,
      text,
    );
    if (result.handled) return finish(result);
  }

  if (
    active === 'product_search' ||
    ['product_recommendation', 'product_search', 'product_comparison', 'product_availability', 'size_help'].includes(
      route.intent,
    )
  ) {
    if (onStatus) onStatus('searching_products');
    const result = await handleProductWorkflow(
      company,
      session,
      config,
      channelAi,
      understanding,
      text,
    );
    if (result.handled) return finish(result);
  }

  if (route.intent === 'return_policy' || route.intent === 'shipping_question') {
    if (onStatus) onStatus('retrieving');
    return finish(await handlePolicy(company, session, config, text));
  }

  if (active === 'track_order' || route.intent === 'track_order') {
    if (onStatus) onStatus('checking_order');
    const idBlock = await ensureIdentity(session, company, config, understanding, 'track_order');
    if (idBlock) return finish(idBlock);
    const verified = await verifyIdentity(session, company, config, 'track_order');
    if (verified.handled) return finish(verified);
    if (verified.verification?.order) {
      setWorkflowStep(session, 'track_order', 'present_tracking');
      await session.save();
      const card = formatOrderCard(verified.verification.order);
      const plan = planResponse({
        responseType: 'tracking',
        suggestedText: `Here’s the latest on order ${card.orderNumber}.`,
        allowedFacts: {
          orderNumber: card.orderNumber,
          financialStatus: card.financialStatus,
          fulfillmentStatus: card.fulfillmentStatus,
        },
        components: [{ type: 'order_card', order: card }],
      });
      const msg = await emitPlan(session, config, plan);
      return finish(baseResult(session, [msg], { handled: true, responsePlanType: 'tracking' }), {
        componentsReturned: ['order_card'],
      });
    }
  }

  if (route.intent === 'change_delivery_address') {
    const idBlock = await ensureIdentity(
      session,
      company,
      config,
      understanding,
      'track_order',
    );
    if (idBlock) return finish(idBlock);
    if (!session.verifiedOrders?.length) {
      const verified = await verifyIdentity(session, company, config, 'track_order');
      if (verified.handled) return finish(verified);
    }
    const permissions = defaultPermissions(channelAi);
    if (!canPerform(permissions, 'changeDeliveryAddress')) {
      const copy = offerHandoff(session, 'action_not_permitted');
      await session.save();
      const msg = await appendSessionMessage(session, {
        role: 'bot',
        body: copy,
        contentType: 'text',
        senderName: config.content.agentName,
      });
      return finish(baseResult(session, [msg], { handled: true }));
    }
    const msg = await appendSessionMessage(session, {
      role: 'bot',
      body: 'Enter the new shipping address below and I’ll update your order.',
      contentType: 'input_form',
      payload: buildShippingAddressForm(),
      senderName: config.content.agentName,
    });
    return finish(baseResult(session, [msg], { handled: true }));
  }

  const unhandled = {
    handled: false,
    understanding,
    historyWithSummary: buildHistoryWithSummary(
      session,
      await require('../models/ConversationSummary').findOne({ session: session._id }),
    ),
  };
  return finish(unhandled);
}

module.exports = {
  orchestrateTurn,
  handleReturnWorkflow,
  handleExchangeWorkflow,
  handleProductWorkflow,
  handleContactRequest,
  handleRefundNotReceived,
  handleRefundRequest,
  ORCHESTRATOR_BUILD,
};
