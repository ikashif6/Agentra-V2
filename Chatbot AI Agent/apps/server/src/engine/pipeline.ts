import type { TurnRequest, TurnResponse, ChatMessage, ChatAttachment } from "@chatbot/shared";
import { createAiProvider } from "../ai/openai.js";
import { buildSystemPrompt, buildResponsePrompt, storeBrand } from "../ai/prompts.js";
import { getBusinessHoursStatus } from "../handoff/hours.js";
import {
  appendMessages,
  createConversation,
  findConversationBySession,
  getConversation,
  getMessages,
  makeMessage,
  saveConversation,
} from "../storage/store.js";
import { executeTool, toolDefinitions } from "../tools/executor.js";
import {
  understandMessage,
  looksLikeOrderToolAction,
  offTopicReply,
  crossCustomerOrderReply,
  extractIssueDescription,
  isDamageRelatedGoal,
  detectProductAttributeAsk,
  detectProductAvailabilityClaim,
  isProductFollowUp,
  resolveProductIndex,
} from "./understand.js";
import { buildAssistantMessages, humanFallbackReply, paraphrasePolicy } from "./respond.js";
import { clearFlowIfSwitched, recentContext } from "./context.js";
import {
  explainOrderFromSnapshot,
  replyContradictsOrderSnapshot,
} from "./orderExplain.js";
import { missingSlotsForFlow, suggestedFlowForGoal } from "./flows/index.js";
import { formForMissing, introForForm } from "./forms.js";
import { isEndChatIntent, parseRatingChoice, ratingPayload } from "./rating.js";
import {
  detectLanguage,
  detectUrgency,
  languageInstruction,
  type DetectedLanguage,
} from "./featureHelpers.js";
import { containsSensitiveRequest, looksLikeDeferredAction, hasProductPreferences, wantsProductBrowse, shouldClearProductPreferences, clearProductPreferenceSlots } from "../security/sanitize.js";
import { publish } from "../realtime/hub.js";
import { env } from "../config/env.js";
import type { LastTurnOutcome, VerifiedOrderSnapshot } from "@chatbot/shared";

function sanitizeAttachments(raw: unknown): ChatAttachment[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatAttachment[] = [];
  for (const item of raw.slice(0, 3)) {
    if (!item || typeof item !== "object") continue;
    const a = item as Record<string, unknown>;
    let url = String(a.url || "");
    // Only accept uploads hosted by this API (relative or absolute)
    if (!url.includes("/v1/uploads/files/")) continue;
    // Store relative path so serving works regardless of host
    const marker = "/v1/uploads/files/";
    const idx = url.indexOf(marker);
    if (idx >= 0) url = url.slice(idx);
    const filename = String(a.filename || "file").slice(0, 120);
    const mimeType = String(a.mimeType || "application/octet-stream").slice(0, 120);
    const size = Math.min(Math.max(Number(a.size) || 0, 0), 5 * 1024 * 1024);
    const kind = a.kind === "image" || mimeType.startsWith("image/") ? "image" : "file";
    const id = String(a.id || "").slice(0, 64) || cryptoRandomId();
    out.push({ id, url, filename, mimeType, size, kind });
  }
  return out;
}

function cryptoRandomId(): string {
  return `att_${Math.random().toString(36).slice(2, 12)}`;
}
function hasAiKey(): boolean {
  if (env.aiProvider === "openai") return Boolean(env.openaiApiKey);
  if (env.aiProvider === "anthropic") return Boolean(env.anthropicApiKey);
  return Boolean(env.groqApiKey);
}

async function heuristicToolPlan(input: {
  goal: string;
  slots: Record<string, string | undefined>;
  message: string;
  verifiedOrderId?: string | null;
  includeOrderUi?: boolean;
  skipOrderStatusRefresh?: boolean;
}): Promise<Array<{ name: string; arguments: Record<string, unknown> }>> {
  const {
    goal,
    slots,
    message,
    verifiedOrderId,
    includeOrderUi = true,
    skipOrderStatusRefresh = false,
  } = input;
  const calls: Array<{ name: string; arguments: Record<string, unknown> }> = [];

  if (goal === "policy" || goal === "store_info" || goal === "size_fit") {
    calls.push({ name: "searchKnowledgeBase", arguments: { query: message } });
  }
  const attributeAsk = detectProductAttributeAsk(message);
  const availabilityClaim = detectProductAvailabilityClaim(message);
  // Attribute follow-ups (material/colors/sizes) must never trigger a fresh recommend
  if ((goal === "product_recommend" || goal === "product_search") && !attributeAsk) {
    const clearPrefs = shouldClearProductPreferences(message);
    const budgetMax =
      clearPrefs || !slots.budget ? undefined : Number(slots.budget);
    // Only free-text in query — color/size/type/etc. are structured filters
    const preferenceQuery = clearPrefs
      ? undefined
      : [slots.productQuery].filter(Boolean).join(" ");
    const wantsAnything = wantsProductBrowse(message) || clearPrefs;
    // Search when we have prefs (incl. budget/size alone), or customer asked to just show something
    if (
      preferenceQuery ||
      wantsAnything ||
      goal === "product_search" ||
      (!clearPrefs && hasProductPreferences(slots))
    ) {
      calls.push({
        name: "recommendProducts",
        arguments: clearPrefs
          ? {}
          : {
              query: preferenceQuery || undefined,
              productType: slots.productType,
              size: slots.size,
              color: slots.color,
              style: slots.style,
              material: slots.material,
              budgetMax,
              occasion: slots.occasion,
            },
      });
    }
  }
  // Attribute follow-ups (material/colors/sizes) — never for general sizing guidance
  if (
    (goal === "product_availability" ||
      attributeAsk ||
      /\b(what|which)\s+colors?\b|\bcolors?\s+available\b|\bavailable\s+colors?\b/i.test(
        message,
      )) &&
    goal !== "size_fit"
  ) {
    const ids = String(slots.lastRecommendedProductIds || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const idx = resolveProductIndex(message);
    let productId: string | undefined;
    if (ids.length && idx != null) {
      productId = idx < 0 ? ids[ids.length - 1] : ids[Math.min(idx, ids.length - 1)];
    } else if (ids.length && isProductFollowUp(message)) {
      productId = ids[0];
    } else if (slots.lastProductId && isProductFollowUp(message)) {
      productId = slots.lastProductId;
    }

    const namedProductAsk =
      Boolean(attributeAsk) ||
      /\bin stock\b|\bavailability\b|\bout of stock\b/i.test(message);

    if (productId) {
      const args: Record<string, unknown> = {
        productId,
        ask: attributeAsk || (availabilityClaim ? (availabilityClaim.facet === "size" ? "sizes" : "colors") : "details"),
      };
      if (availabilityClaim?.facet === "color") args.checkColor = availabilityClaim.value;
      if (availabilityClaim?.facet === "size") args.checkSize = availabilityClaim.value;
      if (/\bin stock\b|\bout of stock\b|\bavailability\b/i.test(message) && !attributeAsk) {
        calls.push({
          name: "checkProductAvailability",
          arguments: { productId, query: message },
        });
      } else {
        calls.push({ name: "getProductDetails", arguments: args });
      }
    } else if (namedProductAsk) {
      // Resolve by product name in the message (e.g. Maya Crepe / Emilia Lace)
      if (/\bin stock\b|\bout of stock\b|\bavailability\b/i.test(message) && !attributeAsk) {
        calls.push({
          name: "checkProductAvailability",
          arguments: { query: message },
        });
      } else {
        calls.push({
          name: "getProductDetails",
          arguments: {
            query: message,
            ask: attributeAsk || "details",
            ...(availabilityClaim?.facet === "color"
              ? { checkColor: availabilityClaim.value }
              : {}),
            ...(availabilityClaim?.facet === "size"
              ? { checkSize: availabilityClaim.value }
              : {}),
          },
        });
      }
    } else if (attributeAsk === "sizes") {
      calls.push({ name: "listCatalogOptions", arguments: { facet: "sizes" } });
    } else if (attributeAsk === "colors" || !attributeAsk) {
      calls.push({ name: "listCatalogOptions", arguments: { facet: "colors" } });
    }
  }
  if (goal === "product_availability" && slots.productQuery && !calls.some((c) => c.name === "checkProductAvailability" || c.name === "getProductDetails")) {
    calls.push({
      name: "searchProducts",
      arguments: {
        query: slots.productQuery,
        color: slots.color,
        size: slots.size,
        // Include OOS items for stock questions
        availableOnly: false,
      },
    });
  }
  if (
    [
      "order_lookup",
      "order_status",
      "tracking",
      "return_request",
      "refund_status",
      "cancellation",
      "address_change",
    ].includes(goal)
  ) {
    if (!verifiedOrderId && slots.orderNumber) {
      calls.push({
        name: "findOrder",
        arguments: {
          orderNumber: slots.orderNumber,
          email: slots.email,
          phone: slots.phone,
          includeUi: includeOrderUi,
        },
      });
      // Same turn: once findOrder verifies, also answer refund status
      if (goal === "refund_status") {
        calls.push({
          name: "checkRefundStatus",
          arguments: { orderId: "pending-verify" },
        });
      }
    } else if (verifiedOrderId) {
      if (goal === "tracking")
        calls.push({
          name: "getTrackingDetails",
          arguments: { orderId: verifiedOrderId, includeUi: includeOrderUi },
        });
      else if (goal === "refund_status")
        calls.push({ name: "checkRefundStatus", arguments: { orderId: verifiedOrderId } });
      else if (goal === "return_request") {
        if (slots.returnRequestId) {
          // Return already started this conversation
        } else if (slots.returnReason) {
          // Form submit → confirm step; "Yes, create the return" is handled via pendingAction
          const confirming =
            /^(yes|yeah|yep|confirm)\b/i.test(message.trim()) ||
            /create the return|start the return/i.test(message);
          const fromReasonForm = /returnReason\s*[:=]/i.test(message);
          calls.push({
            name: "createReturnRequest",
            arguments: {
              orderId: verifiedOrderId,
              reason: slots.returnReason,
              confirmed: confirming && !fromReasonForm,
            },
          });
        } else {
          calls.push({
            name: "checkReturnEligibility",
            arguments: { orderId: verifiedOrderId },
          });
        }
      }
      else if (goal === "cancellation" && /yes|confirm|cancel my order/i.test(message))
        calls.push({
          name: "requestCancellation",
          arguments: { orderId: verifiedOrderId, confirmed: true },
        });
      else if (goal === "cancellation")
        calls.push({
          name: "requestCancellation",
          arguments: { orderId: verifiedOrderId, confirmed: false },
        });
      else if (goal === "address_change") {
        const hasAddress =
          slots.addressLine1 && slots.city && slots.zip && slots.country;
        if (hasAddress) {
          const confirmed =
            /yes|confirm|update address/i.test(message) ||
            /New shipping address:|Address\s*:/i.test(message);
          calls.push({
            name: "requestAddressChange",
            arguments: {
              orderId: verifiedOrderId,
              line1: slots.addressLine1,
              line2: slots.addressLine2,
              city: slots.city,
              state: slots.state,
              zip: slots.zip,
              country: slots.country,
              confirmed,
            },
          });
        }
      } else if (!skipOrderStatusRefresh) {
        calls.push({
          name: "getOrderStatus",
          arguments: { orderId: verifiedOrderId, includeUi: includeOrderUi },
        });
      }
    }
  }
  if (goal === "initiate_refund") {
    calls.push({
      name: "requestRefund",
      arguments: { reason: message },
    });
  }
  // Checkout links are disabled — do not call createCheckoutLink
  if (goal === "handoff") {
    calls.push({
      name: "requestHumanHandoff",
      arguments: { reason: message, email: slots.email, phone: slots.phone },
    });
  }
  if (
    (goal === "damaged_item" || goal === "incorrect_item" || goal === "missing_item") &&
    !slots.issueReportTicketId
  ) {
    calls.push({
      name: "reportDamagedItem",
      arguments: {
        orderId: verifiedOrderId || undefined,
        issueType:
          goal === "incorrect_item" ? "incorrect" : goal === "missing_item" ? "missing" : "damaged",
        description: slots.issueDescription || message,
        email: slots.email,
      },
    });
  }
  if (goal === "contact" || goal === "ticket") {
    if (slots.email || slots.phone) {
      calls.push({
        name: "createSupportTicket",
        arguments: {
          subject: "Customer contact request",
          body: message,
          email: slots.email,
          phone: slots.phone,
        },
      });
    } else {
      calls.push({ name: "collectCustomerContact", arguments: {} });
    }
  }
  if (goal === "back_in_stock") {
    const productId =
      slots.lastProductId ||
      slots.productId ||
      String(slots.lastRecommendedProductIds || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)[0];
    if (slots.email || slots.phone) {
      calls.push({
        name: "subscribeBackInStock",
        arguments: {
          productId,
          query: message,
          variantId: slots.lastVariantId,
          email: slots.email,
          phone: slots.phone,
          size: slots.size,
          color: slots.color,
        },
      });
    } else {
      calls.push({
        name: "subscribeBackInStock",
        arguments: { productId, query: message },
      });
    }
  }
  if (goal === "product_compare") {
    const ids = String(slots.lastRecommendedProductIds || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 4);
    calls.push({
      name: "compareProducts",
      arguments: {
        productIds: ids.length >= 2 ? ids : undefined,
        message,
        query: message,
      },
    });
  }
  if (goal === "similar_products") {
    calls.push({
      name: "suggestSimilarProducts",
      arguments: {
        productId: slots.lastProductId || slots.productId,
        limit: 4,
      },
    });
  }
  if (goal === "exchange_request" && verifiedOrderId) {
    const reason = slots.exchangeReason || slots.returnReason || message;
    const confirming =
      /^(yes|yeah|yep|confirm)\b/i.test(message.trim()) ||
      /start the exchange|create the exchange/i.test(message);
    const fromForm = /exchangeReason\s*[:=]/i.test(message);
    if (slots.exchangeReason || slots.returnReason || fromForm) {
      calls.push({
        name: "createExchangeRequest",
        arguments: {
          orderId: verifiedOrderId,
          reason,
          desiredSize: slots.desiredSize || slots.size,
          desiredColor: slots.desiredColor || slots.color,
          confirmed: confirming && !fromForm,
        },
      });
    }
  }
  if (goal === "partial_return" && verifiedOrderId) {
    const items = String(slots.partialReturnItems || "")
      .split(/[,;|]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const reason = slots.partialReturnReason || slots.returnReason || message;
    const confirming =
      /^(yes|yeah|yep|confirm)\b/i.test(message.trim()) ||
      /return these items|create the (partial )?return/i.test(message);
    const fromForm = /partialReturnItems\s*[:=]/i.test(message);
    if (items.length) {
      calls.push({
        name: "createPartialReturn",
        arguments: {
          orderId: verifiedOrderId,
          reason,
          itemTitles: items,
          confirmed: confirming && !fromForm,
        },
      });
    } else {
      calls.push({
        name: "createPartialReturn",
        arguments: {
          orderId: verifiedOrderId,
          reason: reason || "Partial return",
          itemTitles: [],
          confirmed: false,
        },
      });
    }
  }
  if (goal === "late_delivery" || goal === "lost_delivery") {
    if (verifiedOrderId) {
      calls.push({
        name: "reportLateOrLostDelivery",
        arguments: {
          orderId: verifiedOrderId,
          issueType: goal === "lost_delivery" ? "lost" : "late",
          description: slots.issueDescription || message,
        },
      });
    } else if (slots.orderNumber) {
      calls.push({
        name: "findOrder",
        arguments: {
          orderNumber: slots.orderNumber,
          email: slots.email,
          phone: slots.phone,
          includeUi: includeOrderUi,
        },
      });
    }
  }
  if (goal === "delivery_estimate") {
    const speed = /express/i.test(message)
      ? "express"
      : /international/i.test(message)
        ? "international"
        : "standard";
    calls.push({
      name: "estimateDeliveryDate",
      arguments: {
        orderId: verifiedOrderId || undefined,
        speed,
      },
    });
  }
  if (goal === "shipping_cost") {
    const country =
      slots.country ||
      (/\b(uk|united kingdom|gb)\b/i.test(message)
        ? "GB"
        : /\b(canada|ca)\b/i.test(message)
          ? "CA"
          : "US");
    const speed = /express/i.test(message)
      ? "express"
      : /international/i.test(message) || (country !== "US" && country !== "USA")
        ? "international"
        : "standard";
    calls.push({
      name: "estimateShippingCost",
      arguments: {
        destinationCountry: country,
        speed,
        orderTotal: slots.budget ? Number(slots.budget) : undefined,
      },
    });
  }
  if (goal === "discount_help") {
    const codeMatch = message.match(/\b([A-Z]{3,}\d{0,4})\b/);
    calls.push({
      name: "lookupDiscountOrCoupon",
      arguments: {
        code: codeMatch?.[1],
        query: message,
      },
    });
  }
  if (goal === "payment_issue") {
    if (!verifiedOrderId && slots.orderNumber) {
      calls.push({
        name: "findOrder",
        arguments: {
          orderNumber: slots.orderNumber,
          email: slots.email,
          phone: slots.phone,
          includeUi: includeOrderUi,
        },
      });
    } else {
      calls.push({
        name: "helpPaymentIssue",
        arguments: {
          orderId: verifiedOrderId || undefined,
          issue: slots.issueDescription || message,
        },
      });
    }
  }
  if (goal === "reorder") {
    if (verifiedOrderId) {
      calls.push({
        name: "reorderPreviousProducts",
        arguments: { orderId: verifiedOrderId },
      });
    } else if (slots.orderNumber) {
      calls.push({
        name: "findOrder",
        arguments: {
          orderNumber: slots.orderNumber,
          email: slots.email,
          phone: slots.phone,
          includeUi: includeOrderUi,
        },
      });
    }
  }
  if (goal === "custom_product_request") {
    calls.push({
      name: "submitCustomProductRequest",
      arguments: {
        description:
          slots.customRequestDescription ||
          slots.issueDescription ||
          message,
        email: slots.email,
        phone: slots.phone,
        budget: slots.budget,
        size: slots.size,
        color: slots.color,
      },
    });
  }
  if (goal === "abandoned_cart") {
    calls.push({
      name: "assistAbandonedCart",
      arguments: { email: slots.email },
    });
  }
  return calls;
}

export async function runTurn(req: TurnRequest): Promise<TurnResponse> {
  const workspaceId = req.workspaceId || env.workspaceId;
  let conversation =
    (req.conversationId ? await getConversation(req.conversationId) : null) ||
    (await findConversationBySession(workspaceId, req.sessionToken));

  if (!conversation) {
    conversation = await createConversation({
      workspaceId,
      sessionToken: req.sessionToken,
      channel: req.channel || "web",
      visitorEmail: req.visitorEmail,
    });
  }

  if (req.visitorEmail) {
    conversation.visitorEmail = req.visitorEmail;
    // Don't stomp an email already captured in slots; message extraction may refine it.
    if (!conversation.state.slots.email) {
      conversation.state.slots.email = req.visitorEmail;
    }
  }

  // Human takeover: AI must not reply — customer text/attachments go to the agent
  if (conversation.humanTakeover || conversation.state.humanTakeover) {
    const attachments = sanitizeAttachments(req.attachments);
    const hasAttachments = attachments.length > 0;
    const bodyText = String(req.message || "").trim();
    if (!bodyText && !hasAttachments) {
      return {
        conversationId: conversation.id,
        sessionToken: conversation.sessionToken,
        messages: [],
        conversationState: conversation.state,
        handoffState: conversation.handoffState,
      };
    }
    const customerMsg = makeMessage({
      role: "customer",
      contentType: hasAttachments ? "attachments" : "text",
      body: bodyText || (hasAttachments ? "Sent an attachment" : ""),
      attachments: hasAttachments ? attachments : undefined,
    });
    await appendMessages(conversation.id, [customerMsg]);
    publish(conversation.id, { type: "customer_message", message: customerMsg });
    return {
      conversationId: conversation.id,
      sessionToken: conversation.sessionToken,
      messages: [],
      conversationState: conversation.state,
      handoffState: conversation.handoffState,
    };
  }

  let inboundText = req.message;

  // Form / choice submissions
  if (req.formSubmission) {
    const values = req.formSubmission.values || {};
    Object.assign(conversation.state.slots, values);
    if (values.email) conversation.visitorEmail = values.email;
    if (values.phone) conversation.visitorPhone = values.phone;
    inboundText =
      req.message ||
      Object.entries(values)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ");

    const pending = conversation.state.pendingAction;
    if (
      pending &&
      req.formSubmission.confirmToken &&
      req.formSubmission.confirmToken === pending.confirmToken
    ) {
      const toolResult = await executeTool(pending.tool, pending.args, {
        workspaceId,
        conversation,
      });
      const assistant = buildAssistantMessages(
        toolResult.ok
          ? typeof toolResult.data === "object" &&
            toolResult.data &&
            "message" in (toolResult.data as object)
            ? String((toolResult.data as { message?: string }).message)
            : "All set — that’s confirmed."
          : toolResult.error,
        [toolResult],
      );
      const customerMsg = makeMessage({
        role: "customer",
        contentType: "text",
        body: inboundText,
      });
      await appendMessages(conversation.id, [customerMsg, ...assistant]);
      conversation.state.pendingAction = null;
      await saveConversation(conversation);
      publish(conversation.id, { type: "assistant_messages", messages: assistant });
      return {
        conversationId: conversation.id,
        sessionToken: conversation.sessionToken,
        messages: assistant,
        conversationState: conversation.state,
        handoffState: conversation.handoffState,
      };
    }
  }

  if (req.choiceId === "confirm_cancel" || /yes, cancel my order/i.test(inboundText)) {
    if (conversation.state.pendingAction?.tool === "requestCancellation") {
      const pending = conversation.state.pendingAction;
      const toolResult = await executeTool(pending.tool, { ...pending.args, confirmed: true }, {
        workspaceId,
        conversation,
      });
      const assistant = buildAssistantMessages(undefined, [toolResult]);
      const customerMsg = makeMessage({
        role: "customer",
        contentType: "text",
        body: inboundText,
      });
      await appendMessages(conversation.id, [customerMsg, ...assistant]);
      await saveConversation(conversation);
      return {
        conversationId: conversation.id,
        sessionToken: conversation.sessionToken,
        messages: assistant,
        conversationState: conversation.state,
        handoffState: conversation.handoffState,
      };
    }
  }

  const pendingHandoffTicket =
    conversation.state.pendingAction?.actionId === "confirm_handoff_ticket";
  if (
    pendingHandoffTicket &&
    (req.choiceId === "confirm_handoff_ticket" ||
      /^(yes[,!.]?|yes[, ].*ticket|create (a )?ticket|please (create|do)|sure|ok(ay)?)\b/i.test(
        inboundText.trim(),
      ))
  ) {
    const pending = conversation.state.pendingAction!;
    const toolResult = await executeTool(
      pending.tool,
      { ...pending.args, confirmed: true },
      { workspaceId, conversation },
    );
    conversation.state.pendingAction = null;
    const assistant = buildAssistantMessages(undefined, [toolResult]);
    const customerMsg = makeMessage({
      role: "customer",
      contentType: "text",
      body: inboundText,
    });
    await appendMessages(conversation.id, [customerMsg, ...assistant]);
    await saveConversation(conversation);
    publish(conversation.id, { type: "typing", value: false });
    return {
      conversationId: conversation.id,
      sessionToken: conversation.sessionToken,
      messages: assistant,
      conversationState: conversation.state,
      handoffState: conversation.handoffState,
    };
  }

  if (
    pendingHandoffTicket &&
    (req.choiceId === "decline_handoff_ticket" ||
      /^(no[,!.]?|no thanks|no thank you|nah|not now|don'?t)\b/i.test(inboundText.trim()))
  ) {
    conversation.state.pendingAction = null;
    const assistant = [
      makeMessage({
        role: "assistant",
        contentType: "text",
        body: "No problem — I won’t create a ticket. I’m still here if you need help with an order, a product, or anything else.",
        senderName: env.agentName,
      }),
    ];
    const customerMsg = makeMessage({
      role: "customer",
      contentType: "text",
      body: inboundText,
    });
    await appendMessages(conversation.id, [customerMsg, ...assistant]);
    await saveConversation(conversation);
    publish(conversation.id, { type: "typing", value: false });
    return {
      conversationId: conversation.id,
      sessionToken: conversation.sessionToken,
      messages: assistant,
      conversationState: conversation.state,
      handoffState: conversation.handoffState,
    };
  }

  // Checkout links are disabled — drop any stale confirm action
  if (conversation.state.pendingAction?.actionId === "confirm_checkout_link") {
    conversation.state.pendingAction = null;
  }

  // Refund → connect with agent (chat cannot process refunds)
  if (
    req.choiceId === "connect_agent_refund" ||
    req.choiceId === "connect_agent_return" ||
    /^connect with (an )?agent\b/i.test(inboundText.trim()) ||
    /^please connect me with an agent about a return/i.test(inboundText.trim())
  ) {
    const toolResult = await executeTool(
      "requestHumanHandoff",
      {
        reason:
          req.choiceId === "connect_agent_return" || /return/i.test(inboundText)
            ? "Customer needs help with a return that isn’t eligible in chat"
            : "Customer needs help with a refund",
        email: conversation.visitorEmail || conversation.state.slots.email,
        phone: conversation.visitorPhone || conversation.state.slots.phone,
      },
      { workspaceId, conversation },
    );
    const assistant = buildAssistantMessages(undefined, [toolResult]);
    const customerMsg = makeMessage({
      role: "customer",
      contentType: "text",
      body: inboundText,
    });
    await appendMessages(conversation.id, [customerMsg, ...assistant]);
    await saveConversation(conversation);
    publish(conversation.id, { type: "typing", value: false });
    return {
      conversationId: conversation.id,
      sessionToken: conversation.sessionToken,
      messages: assistant,
      conversationState: conversation.state,
      handoffState: conversation.handoffState,
    };
  }
  if (req.choiceId === "decline_refund_agent") {
    const assistant = [
      makeMessage({
        role: "assistant",
        contentType: "text",
        body: "No problem — I’m still here if you need help with an order, a product, or anything else.",
        senderName: env.agentName,
      }),
    ];
    const customerMsg = makeMessage({
      role: "customer",
      contentType: "text",
      body: inboundText,
    });
    await appendMessages(conversation.id, [customerMsg, ...assistant]);
    await saveConversation(conversation);
    return {
      conversationId: conversation.id,
      sessionToken: conversation.sessionToken,
      messages: assistant,
      conversationState: conversation.state,
      handoffState: conversation.handoffState,
    };
  }

  // CSAT: customer picked an emoji / score after ending the chat
  const ratingPick = parseRatingChoice(inboundText, req.choiceId);
  if (ratingPick) {
    conversation.rating = {
      score: ratingPick.score,
      emoji: ratingPick.emoji,
      label: ratingPick.label,
      at: new Date().toISOString(),
    };
    conversation.state.slots.chatRated = String(ratingPick.score);
    conversation.state.slots.chatRatingEmoji = ratingPick.emoji;
    const assistant = [
      makeMessage({
        role: "assistant",
        contentType: "text",
        body: `Thanks for the ${ratingPick.emoji} — we appreciate your feedback. Take care!`,
        senderName: env.agentName,
      }),
    ];
    const customerMsg = makeMessage({
      role: "customer",
      contentType: "text",
      body: inboundText || `${ratingPick.emoji} ${ratingPick.label}`,
    });
    await appendMessages(conversation.id, [customerMsg, ...assistant]);
    await saveConversation(conversation);
    publish(conversation.id, { type: "typing", value: false });
    return {
      conversationId: conversation.id,
      sessionToken: conversation.sessionToken,
      messages: assistant,
      conversationState: conversation.state,
      handoffState: conversation.handoffState,
    };
  }

  // Customer ending the chat → offer emoji rating (once)
  if (
    isEndChatIntent(inboundText, req.choiceId) &&
    !conversation.rating &&
    !conversation.state.slots.chatRated
  ) {
    const rating = ratingPayload();
    const assistant = [
      makeMessage({
        role: "assistant",
        contentType: "rating",
        body: "Glad I could help! Before you go — how was this chat?",
        senderName: env.agentName,
        rating,
      }),
    ];
    const customerMsg = makeMessage({
      role: "customer",
      contentType: "text",
      body: inboundText,
    });
    await appendMessages(conversation.id, [customerMsg, ...assistant]);
    conversation.state.lastTurnOutcome = {
      type: "general",
      summary: "Asked for chat rating",
      at: new Date().toISOString(),
    };
    await saveConversation(conversation);
    publish(conversation.id, { type: "typing", value: false });
    return {
      conversationId: conversation.id,
      sessionToken: conversation.sessionToken,
      messages: assistant,
      conversationState: conversation.state,
      handoffState: conversation.handoffState,
    };
  }

  if (containsSensitiveRequest(inboundText)) {
    const assistant = [
      makeMessage({
        role: "assistant",
        contentType: "text",
        body: "For your security I can’t collect card numbers, CVV, passwords, or PINs here. Please use the secure checkout or account page for payment details.",
        senderName: env.agentName,
      }),
    ];
    const customerMsg = makeMessage({
      role: "customer",
      contentType: "text",
      body: inboundText,
    });
    await appendMessages(conversation.id, [customerMsg, ...assistant]);
    return {
      conversationId: conversation.id,
      sessionToken: conversation.sessionToken,
      messages: assistant,
      conversationState: conversation.state,
      handoffState: conversation.handoffState,
    };
  }

  const history = await getMessages(conversation.id);
  const understood = understandMessage({
    message: inboundText,
    slots: conversation.state.slots,
    goal: conversation.state.goal,
    hasVerifiedOrder: Boolean(conversation.state.verifiedOrderId),
    lastOutcome: conversation.state.lastTurnOutcome,
    verifiedOrderNumber: conversation.state.verifiedOrderSnapshot?.orderNumber,
  });

  // Keep restock / waitlist intent through forms and "Notify me" choices
  if (
    req.choiceId === "notify_restock" ||
    req.formSubmission?.actionId === "back_in_stock" ||
    (/notify me when/i.test(inboundText) &&
      /back in stock|available again|restock/i.test(inboundText))
  ) {
    understood.goal = "back_in_stock";
    understood.switchedTopic = true;
  } else if (
    conversation.state.activeFlow === "back_in_stock" &&
    !understood.switchedTopic
  ) {
    understood.goal = "back_in_stock";
  }

  if (
    req.formSubmission?.actionId === "custom_product_request" ||
    req.formSubmission?.actionId === "custom_product"
  ) {
    understood.goal = "custom_product_request";
    understood.switchedTopic = true;
  } else if (
    conversation.state.activeFlow === "custom_product" &&
    !understood.switchedTopic
  ) {
    understood.goal = "custom_product_request";
  }

  if (req.formSubmission?.actionId === "return_reason") {
    understood.goal = "return_request";
    understood.switchedTopic = true;
    if (req.formSubmission.values?.returnReason) {
      understood.slots.returnReason = String(req.formSubmission.values.returnReason);
    }
  } else if (
    conversation.state.activeFlow === "return" &&
    !understood.switchedTopic &&
    understood.goal === "general"
  ) {
    understood.goal = "return_request";
  }

  if (req.formSubmission?.actionId === "exchange_reason") {
    understood.goal = "exchange_request";
    understood.switchedTopic = true;
  } else if (
    conversation.state.activeFlow === "exchange" &&
    !understood.switchedTopic
  ) {
    understood.goal = "exchange_request";
  }

  if (req.formSubmission?.actionId === "partial_return") {
    understood.goal = "partial_return";
    understood.switchedTopic = true;
  } else if (
    conversation.state.activeFlow === "partial_return" &&
    !understood.switchedTopic
  ) {
    understood.goal = "partial_return";
  }

  if (
    req.choiceId === "connect_agent_payment" ||
    req.choiceId === "connect_agent_delivery" ||
    /please connect me with an agent/i.test(inboundText)
  ) {
    understood.goal = "handoff";
    understood.switchedTopic = true;
  }

  if (req.choiceId === "check_order_payment") {
    understood.goal = "order_lookup";
    understood.switchedTopic = true;
  }

  if (
    req.choiceId === "browse_products" ||
    /^show me product recommendations$/i.test(inboundText.trim())
  ) {
    understood.goal = "product_recommend";
    understood.switchedTopic = true;
  }

  conversation.state.goal = understood.goal;
  conversation.state.slots = understood.slots;
  // Prefer email/phone extracted from this message over a stale visitorEmail default
  if (understood.slots.email) {
    conversation.visitorEmail = understood.slots.email;
  }
  if (understood.slots.phone) {
    conversation.visitorPhone = understood.slots.phone;
  }

  // Language + urgency detection each turn
  const lang = detectLanguage(inboundText);
  if (lang !== "en" || !conversation.state.language) {
    conversation.state.language = lang;
  }
  const urgency = detectUrgency(inboundText);
  conversation.state.urgency = urgency;

  // Customer corrected order number / email → drop old verification and look up again
  if (understood.identityChanged || understood.orderNumberChanged) {
    conversation.state.verifiedOrderId = null;
    conversation.state.verifiedOrderSnapshot = null;
    conversation.state.lastTurnOutcome = null;
  }

  conversation.state = clearFlowIfSwitched(conversation.state, understood.switchedTopic);

  const flow = suggestedFlowForGoal(understood.goal);
  if (flow && understood.switchedTopic) {
    conversation.state.activeFlow = flow;
    conversation.state.flowStep = "start";
  } else if (flow && !conversation.state.activeFlow) {
    conversation.state.activeFlow = flow;
  }

  // Persist goal/slots before tools so disk reloads cannot wipe topic switches
  await saveConversation(conversation);

  const customerMsg = makeMessage({
    role: "customer",
    contentType: "text",
    body: inboundText,
  });
  await appendMessages(conversation.id, [customerMsg]);
  publish(conversation.id, { type: "typing", value: true });

  const brand = storeBrand(conversation.workspaceId);
  const hours = getBusinessHoursStatus();

  // Off-topic — AI reply when possible
  if (understood.isOffTopic) {
    const body = await contextualAiReply({
      brand,
      hoursSummary: hours.summary,
      conversation,
      history,
      inboundText,
      fallback: offTopicReply(),
    });
    return finishTextTurn(conversation, body);
  }

  // Privacy: another customer's / unverified third-party order — explicit refusal only
  if (understood.isCrossCustomerPrivacyAsk) {
    return finishTextTurn(conversation, crossCustomerOrderReply());
  }

  // Checkout links disabled — never create/share cart links in chat
  if (
    understood.goal === "place_order" ||
    req.choiceId === "confirm_checkout_link" ||
    /\b(checkout link|send (me )?(a )?checkout|buy (this|it|that) (for me)?|order (this|it|that) for me)\b/i.test(
      inboundText,
    )
  ) {
    return finishTextTurn(
      conversation,
      "I can’t create checkout links in chat. Use View More on a product card to open the product page and complete your purchase on the website.",
    );
  }

  // "show again" / "yes" after a failed lookup → re-open the form (do NOT re-run same search)
  if (understood.wantsRetryForm) {
    const form = formForMissing("order_lookup", ["orderNumber", "email"]);
    const assistant = [
      makeMessage({
        role: "assistant",
        contentType: "text",
        body: "Sounds good — enter the order number and the email used at checkout below, and I’ll look it up again.",
        senderName: env.agentName,
      }),
      ...(form
        ? [
            makeMessage({
              role: "assistant",
              contentType: "input_form" as const,
              senderName: env.agentName,
              form,
            }),
          ]
        : []),
    ];
    conversation.state.lastTurnOutcome = {
      type: "form_shown",
      summary: "Re-showed order lookup form after retry confirmation",
      at: new Date().toISOString(),
    };
    conversation.state.activeFlow = "order_lookup";
    conversation.state.verifiedOrderId = null;
    conversation.state.verifiedOrderSnapshot = null;
    // Clear prior identity so we don’t silently re-hit the same failed lookup
    delete conversation.state.slots.orderNumber;
    delete conversation.state.slots.orderId;
    delete conversation.state.slots.email;
    await appendMessages(conversation.id, assistant);
    await saveConversation(conversation);
    publish(conversation.id, { type: "typing", value: false });
    publish(conversation.id, { type: "assistant_messages", messages: assistant });
    return {
      conversationId: conversation.id,
      sessionToken: conversation.sessionToken,
      messages: assistant,
      conversationState: conversation.state,
      handoffState: conversation.handoffState,
    };
  }

  // Follow-up about a failed lookup — explain context, don’t spam the same error
  if (understood.isAboutLastFailure && conversation.state.lastTurnOutcome) {
    const last = conversation.state.lastTurnOutcome;
    const fallback =
      last.type === "order_not_found"
        ? `Yes — we couldn’t match${last.attemptedOrderNumber ? ` order #${last.attemptedOrderNumber}` : " that order"}${last.attemptedEmail ? ` to ${last.attemptedEmail}` : ""}. That usually means the email isn’t the one on the order, or the number is off. Want to try again with different details?`
        : last.summary ||
          "That didn’t go through. Want to try again with the order number and email on the order?";
    const body = await contextualAiReply({
      brand,
      hoursSummary: hours.summary,
      conversation,
      history,
      inboundText,
      fallback,
      clarifyFollowUp: true,
    });
    // Keep failure type so a following “yes” still opens a fresh form
    conversation.state.lastTurnOutcome = {
      ...last,
      type: last.type === "tool_error" ? "tool_error" : "order_not_found",
      summary: body.slice(0, 180),
      at: new Date().toISOString(),
    };
    return finishTextTurn(conversation, body);
  }

  // Clarify follow-up on a verified order → answer in text (AI-first), no re-show card
  if (
    understood.isClarifyFollowUp &&
    conversation.state.verifiedOrderId &&
    !understood.wantsOrderCardAgain &&
    !understood.identityChanged
  ) {
    if (!conversation.state.verifiedOrderSnapshot) {
      await executeTool(
        "getOrderStatus",
        {
          orderId: conversation.state.verifiedOrderId,
          includeUi: false,
        },
        { workspaceId, conversation },
      );
      const refreshed = await getConversation(conversation.id);
      if (refreshed) conversation = refreshed;
    }
    const snap = conversation.state.verifiedOrderSnapshot as VerifiedOrderSnapshot | null;
    if (snap) {
      const fallback = explainOrderFromSnapshot(snap, inboundText);
      let reply = fallback;
      if (hasAiKey()) {
        try {
          const ai = createAiProvider();
          const grounded = await ai.complete({
            messages: [
              {
                role: "system",
                content: buildSystemPrompt({
                  storeName: brand.storeName,
                  agentName: brand.agentName,
                  slots: conversation.state.slots,
                  goal: conversation.state.goal,
                  activeFlow: conversation.state.activeFlow,
                  businessHoursSummary: hours.summary,
                  verifiedOrderSnapshot: snap,
                  lastTurnOutcome: conversation.state.lastTurnOutcome,
                  languageHint: languageInstruction(
                    (conversation.state.language as DetectedLanguage) || "en",
                  ),
                  urgency: conversation.state.urgency,
                  channel: conversation.channel,
                  workspaceId: conversation.workspaceId,
                }),
              },
              {
                role: "system",
                content: buildResponsePrompt({
                  toolResultsJson: "(none — answer from verified order facts and chat history)",
                  knowledgeSnippets: "",
                  verifiedOrderSnapshot: snap,
                  lastTurnOutcome: conversation.state.lastTurnOutcome,
                  clarifyFollowUp: true,
                }),
              },
              ...recentContext(history),
              { role: "user", content: inboundText },
            ],
            temperature: 0.55,
          });
          if (
            grounded.text &&
            !looksLikeDeferredAction(grounded.text) &&
            !replyContradictsOrderSnapshot(grounded.text, snap)
          ) {
            reply = grounded.text;
          }
        } catch {
          // keep fallback
        }
      }
      conversation.state.lastTurnOutcome = {
        type: "clarify",
        summary: reply.slice(0, 180),
        attemptedOrderNumber: snap.orderNumber,
        at: new Date().toISOString(),
      };
      return finishTextTurn(conversation, reply);
    }
  }

  const activeFlow =
    conversation.state.activeFlow || suggestedFlowForGoal(understood.goal);

  // Already filed an issue report — don't re-ask for the form or open another ticket
  if (
    conversation.state.slots.issueReportTicketId &&
    (activeFlow === "damage_report" || isDamageRelatedGoal(understood.goal))
  ) {
    const ref =
      conversation.state.slots.issueReportTicketRef ||
      conversation.state.slots.issueReportTicketId.slice(0, 8);
    conversation.state.activeFlow = null;
    const body = await contextualAiReply({
      brand,
      hoursSummary: hours.summary,
      conversation,
      history,
      inboundText,
      fallback: `We already have support ticket #${ref} open for this. Our team will follow up — anything else I can help with?`,
    });
    return finishTextTurn(conversation, body);
  }

  // If we're collecting an issue report, prefer the customer's latest message
  // (or recent description) over re-showing the same form.
  if (
    (activeFlow === "damage_report" || isDamageRelatedGoal(understood.goal)) &&
    !conversation.state.slots.issueDescription
  ) {
    const fromMessage = extractIssueDescription(inboundText, undefined, {
      allowFreeText:
        activeFlow === "damage_report" ||
        conversation.state.lastTurnOutcome?.type === "form_shown",
    });
    if (fromMessage) {
      conversation.state.slots.issueDescription = fromMessage;
    }
  }

  // Cancelled / ineligible orders must not open address / cancel / return forms
  if (
    activeFlow &&
    ["address_change", "cancellation", "return"].includes(activeFlow) &&
    conversation.state.verifiedOrderId &&
    conversation.state.verifiedOrderSnapshot
  ) {
    const snap = conversation.state.verifiedOrderSnapshot;
    const cancelled =
      String(snap.cancellationStatus || "").toLowerCase() === "cancelled";
    if (activeFlow === "address_change" && (cancelled || snap.addressChangeEligible === false)) {
      const body = cancelled
        ? `Order #${snap.orderNumber} is already cancelled, so the shipping address can’t be changed. I can help with something else if you need.`
        : `Order #${snap.orderNumber} can’t have its address updated anymore (it’s already being fulfilled or shipped). Want help with something else?`;
      conversation.state.activeFlow = null;
      conversation.state.flowStep = null;
      return finishTextTurn(conversation, body);
    }
    if (activeFlow === "cancellation" && (cancelled || snap.cancelEligible === false)) {
      const body = cancelled
        ? `Order #${snap.orderNumber} is already cancelled.`
        : `Order #${snap.orderNumber} can’t be cancelled now. After delivery, a return may be the path instead.`;
      conversation.state.activeFlow = null;
      return finishTextTurn(conversation, body);
    }
    if (activeFlow === "return" && (cancelled || snap.returnEligible === false)) {
      let body = cancelled
        ? `Looking at order #${snap.orderNumber}, it’s already cancelled, so a return can’t be started.`
        : `Looking at order #${snap.orderNumber}, it isn’t eligible for a return under our store policy right now. I can connect you with an agent if you still need help.`;
      try {
        const { evaluateReturnEligibility } = await import(
          "../commerce/returnPolicy.js"
        );
        const eligibility = evaluateReturnEligibility({
          orderNumber: snap.orderNumber,
          cancellationStatus: snap.cancellationStatus,
          fulfillmentStatus: snap.fulfillmentStatus,
          shipmentStatus: snap.shipmentStatus,
          refundStatus: snap.refundStatus,
          financialStatus: snap.financialStatus,
        });
        if (eligibility.message) body = eligibility.message;
      } catch {
        // keep fallback body
      }
      conversation.state.activeFlow = null;
      conversation.state.flowStep = null;
      return finishTextTurn(conversation, body);
    }
  }

  const missing = activeFlow
    ? missingSlotsForFlow(
        activeFlow as any,
        conversation.state.slots,
        conversation.state.verifiedOrderId,
      )
    : [];

  // Collect required details via widget forms (not free-text asks)
  const collectionForm = formForMissing(activeFlow as any, missing);
  if (
    collectionForm &&
    missing.length &&
    !hasEnoughToProceed(understood.goal, conversation.state, missing)
  ) {
    const assistant = [
      makeMessage({
        role: "assistant",
        contentType: "text",
        body: introForForm(collectionForm),
        senderName: env.agentName,
      }),
      makeMessage({
        role: "assistant",
        contentType: "input_form",
        senderName: env.agentName,
        form: collectionForm,
      }),
    ];
    await appendMessages(conversation.id, assistant);
    conversation.state.lastTurnOutcome = {
      type: "form_shown",
      summary: `Asked for ${missing.join(", ")}`,
      at: new Date().toISOString(),
    };
    await saveConversation(conversation);
    publish(conversation.id, { type: "typing", value: false });
    return {
      conversationId: conversation.id,
      sessionToken: conversation.sessionToken,
      messages: assistant,
      conversationState: conversation.state,
      handoffState: conversation.handoffState,
    };
  }

  let toolCalls: Array<{ name: string; arguments: Record<string, unknown> }> = [];
  let aiText: string | undefined;

  // Product recommend with zero preferences → ask one short question (don't empty-search)
  const openEndedRecommend =
    understood.goal === "product_recommend" &&
    !hasProductPreferences(conversation.state.slots) &&
    !wantsProductBrowse(inboundText);

  if (openEndedRecommend) {
    const ask = [
      makeMessage({
        role: "assistant",
        contentType: "text",
        body: "Happy to help — what are you looking for? For example a dress, veil, or accessory, and any color or budget you have in mind.",
        senderName: env.agentName,
      }),
    ];
    await appendMessages(conversation.id, ask);
    await saveConversation(conversation);
    publish(conversation.id, { type: "typing", value: false });
    return {
      conversationId: conversation.id,
      sessionToken: conversation.sessionToken,
      messages: ask,
      conversationState: conversation.state,
      handoffState: conversation.handoffState,
    };
  }

  if (hasAiKey()) {
    try {
      const ai = createAiProvider();
      const completion = await ai.complete({
        messages: [
          {
            role: "system",
            content: buildSystemPrompt({
              storeName: brand.storeName,
              agentName: brand.agentName,
              slots: conversation.state.slots,
              goal: conversation.state.goal,
              activeFlow: conversation.state.activeFlow,
              businessHoursSummary: hours.summary,
              verifiedOrderSnapshot: conversation.state.verifiedOrderSnapshot,
              lastTurnOutcome: conversation.state.lastTurnOutcome,
              languageHint: languageInstruction(
                (conversation.state.language as DetectedLanguage) || "en",
              ),
              urgency: conversation.state.urgency,
              channel: conversation.channel,
              workspaceId: conversation.workspaceId,
            }),
          },
          ...recentContext(history),
          { role: "user", content: inboundText },
        ],
        tools: toolDefinitions,
      });
      toolCalls = (completion.toolCalls || []).map((t) => ({
        name: t.name,
        arguments: t.arguments,
      }));
      // Don't file a second issue report in the same conversation
      if (conversation.state.slots.issueReportTicketId) {
        toolCalls = toolCalls.filter((c) => c.name !== "reportDamagedItem");
      }
      // Attribute follow-ups / availability claims must verify catalog — never agree blindly
      const attrAsk = detectProductAttributeAsk(inboundText);
      const claim = detectProductAvailabilityClaim(inboundText);
      if (attrAsk || claim) {
        toolCalls = toolCalls.filter(
          (c) => c.name !== "recommendProducts" && c.name !== "searchProducts",
        );
        if (
          !toolCalls.some(
            (c) =>
              c.name === "getProductDetails" || c.name === "checkProductAvailability",
          )
        ) {
          const forced = await heuristicToolPlan({
            goal: conversation.state.goal,
            slots: conversation.state.slots,
            message: inboundText,
            verifiedOrderId: conversation.state.verifiedOrderId,
          });
          toolCalls = [
            ...toolCalls,
            ...forced.filter(
              (c) =>
                c.name === "getProductDetails" ||
                c.name === "checkProductAvailability" ||
                c.name === "listCatalogOptions",
            ),
          ];
        } else {
          toolCalls = toolCalls.map((c) => {
            if (c.name !== "getProductDetails") return c;
            const next = { ...c.arguments };
            if (!next.ask) next.ask = attrAsk || (claim?.facet === "size" ? "sizes" : "colors");
            if (claim?.facet === "color" && !next.checkColor) next.checkColor = claim.value;
            if (claim?.facet === "size" && !next.checkSize) next.checkSize = claim.value;
            if (!next.query && !next.productId) next.query = inboundText;
            return { ...c, arguments: next };
          });
        }
      }

      // Force correct tools when the model picks recommend/search instead
      const forceGoal = conversation.state.goal;
      if (
        forceGoal === "product_compare" ||
        forceGoal === "back_in_stock" ||
        forceGoal === "refund_status" ||
        (forceGoal === "product_availability" &&
          /\bin stock\b|\bout of stock\b|\bavailability\b/i.test(inboundText))
      ) {
        const forced = await heuristicToolPlan({
          goal: forceGoal,
          slots: conversation.state.slots,
          message: inboundText,
          verifiedOrderId: conversation.state.verifiedOrderId,
          includeOrderUi: true,
        });
        if (forceGoal === "product_compare") {
          // Compare must not be diluted by a parallel recommendProducts call
          const compareCalls = forced.filter((c) => c.name === "compareProducts");
          toolCalls = compareCalls.length
            ? compareCalls.map((c) => ({
                ...c,
                arguments: {
                  ...c.arguments,
                  message: inboundText,
                  query: inboundText,
                },
              }))
            : [
                {
                  name: "compareProducts",
                  arguments: { message: inboundText, query: inboundText },
                },
              ];
        } else if (forceGoal === "back_in_stock") {
          toolCalls = toolCalls.filter(
            (c) => c.name !== "recommendProducts" && c.name !== "searchProducts",
          );
          if (!toolCalls.some((c) => c.name === "subscribeBackInStock") && forced.length) {
            toolCalls = [...forced, ...toolCalls];
          } else {
            toolCalls = toolCalls.map((c) =>
              c.name === "subscribeBackInStock"
                ? {
                    ...c,
                    arguments: {
                      ...c.arguments,
                      query: c.arguments.query || inboundText,
                      message: inboundText,
                      email:
                        c.arguments.email ||
                        conversation.state.slots.email ||
                        conversation.visitorEmail,
                    },
                  }
                : c,
            );
          }
        } else if (forceGoal === "refund_status") {
          // Always use heuristic findOrder + checkRefundStatus with extracted slots
          toolCalls = forced.length
            ? forced
            : [
                {
                  name: "findOrder",
                  arguments: {
                    orderNumber: conversation.state.slots.orderNumber,
                    email: conversation.state.slots.email || conversation.visitorEmail,
                    phone: conversation.state.slots.phone,
                    includeUi: true,
                  },
                },
              ];
        } else if (forceGoal === "product_availability") {
          toolCalls = toolCalls.filter((c) => c.name !== "recommendProducts");
          if (
            !toolCalls.some(
              (c) =>
                c.name === "checkProductAvailability" || c.name === "getProductDetails",
            ) &&
            forced.length
          ) {
            toolCalls = [
              ...forced.filter(
                (c) =>
                  c.name === "checkProductAvailability" ||
                  c.name === "getProductDetails",
              ),
              ...toolCalls,
            ];
          }
        }
      }
      aiText = completion.text;
    } catch (err) {
      console.error("AI error, falling back to heuristics:", err);
      toolCalls = await heuristicToolPlan({
        goal: conversation.state.goal,
        slots: conversation.state.slots,
        message: inboundText,
        verifiedOrderId: conversation.state.verifiedOrderId,
      });
    }
  } else {
    toolCalls = await heuristicToolPlan({
      goal: conversation.state.goal,
      slots: conversation.state.slots,
      message: inboundText,
      verifiedOrderId: conversation.state.verifiedOrderId,
    });
  }

  // Never leave the customer with "I'll check…" and no tools — execute now
  // But do NOT re-fetch order status on every sticky-goal turn.
  const needsForcedTools =
    toolCalls.length === 0 &&
    (looksLikeDeferredAction(aiText || "") ||
      shouldForceToolsForGoal(understood.goal, inboundText, {
        verifiedOrderId: conversation.state.verifiedOrderId,
        slots: conversation.state.slots,
        wantsOrderCardAgain: understood.wantsOrderCardAgain,
        lastOutcome: conversation.state.lastTurnOutcome,
        identityChanged: understood.identityChanged,
      }));

  if (needsForcedTools) {
    toolCalls = await heuristicToolPlan({
      goal: conversation.state.goal,
      slots: conversation.state.slots,
      message: inboundText,
      verifiedOrderId: conversation.state.verifiedOrderId,
      includeOrderUi:
        understood.wantsOrderCardAgain ||
        looksLikeOrderToolAction(inboundText) ||
        understood.identityChanged ||
        !conversation.state.verifiedOrderId,
      skipOrderStatusRefresh:
        Boolean(conversation.state.verifiedOrderId) &&
        ["order_lookup", "order_status"].includes(understood.goal) &&
        !looksLikeOrderToolAction(inboundText) &&
        !understood.wantsOrderCardAgain &&
        !understood.identityChanged,
    });
    if (toolCalls.length && looksLikeDeferredAction(aiText || "")) {
      aiText = undefined;
    }
  }

  // If model requested order status on a clarify-ish turn, suppress UI card
  if (
    conversation.state.verifiedOrderSnapshot &&
    !understood.wantsOrderCardAgain &&
    !looksLikeOrderToolAction(inboundText) &&
    !understood.identityChanged
  ) {
    toolCalls = toolCalls.map((c) => {
      if (
        c.name === "getOrderStatus" ||
        c.name === "getTrackingDetails" ||
        c.name === "findOrder"
      ) {
        return { ...c, arguments: { ...c.arguments, includeUi: false } };
      }
      return c;
    });
  }

  // Prefer extracted slots over model args (model often invents or reuses stale filters)
  const slotState = conversation.state;
  if (shouldClearProductPreferences(inboundText)) {
    conversation.state.slots = clearProductPreferenceSlots(conversation.state.slots);
  }
  const openBrowse = wantsProductBrowse(inboundText) || shouldClearProductPreferences(inboundText);
  toolCalls = toolCalls.map((c) => {
    if (c.name !== "recommendProducts" && c.name !== "searchProducts") return c;
    const slots = slotState.slots;
    if (openBrowse) {
      return { ...c, arguments: { query: undefined } };
    }
    const budgetMax = slots.budget ? Number(slots.budget) : undefined;
    const query = slots.productQuery || undefined;
    return {
      ...c,
      arguments: {
        query,
        productType: slots.productType,
        size: slots.size,
        color: slots.color,
        style: slots.style,
        material: slots.material,
        occasion: slots.occasion,
        budgetMax,
        availableOnly: c.arguments.availableOnly,
      },
    };
  });

  const toolResults: Awaited<ReturnType<typeof executeTool>>[] = [];
  for (const call of toolCalls.slice(0, 3)) {
    let args = { ...call.arguments };
    if (
      (call.name === "checkRefundStatus" ||
        call.name === "getOrderStatus" ||
        call.name === "getTrackingDetails" ||
        call.name === "checkReturnEligibility") &&
      (!args.orderId || args.orderId === "pending-verify")
    ) {
      args.orderId = conversation.state.verifiedOrderId || undefined;
    }
    const result = await executeTool(call.name, args, {
      workspaceId,
      conversation,
    });
    toolResults.push(result);
    const refreshed = await getConversation(conversation.id);
    if (refreshed) conversation = refreshed;
  }

  // After order lookup for a return ask, always run the policy check so we
  // answer from the order + window — never invent day counts.
  if (
    understood.goal === "return_request" &&
    conversation.state.verifiedOrderId &&
    !conversation.state.slots.returnReason &&
    !conversation.state.slots.returnRequestId &&
    !toolResults.some(
      (r, i) =>
        toolCalls[i]?.name === "checkReturnEligibility" ||
        toolCalls[i]?.name === "createReturnRequest" ||
        (typeof r.data === "object" &&
          r.data &&
          "eligible" in (r.data as object) &&
          "windowDays" in (r.data as object)),
    )
  ) {
    const eligibilityResult = await executeTool(
      "checkReturnEligibility",
      { orderId: conversation.state.verifiedOrderId },
      { workspaceId, conversation },
    );
    toolResults.push(eligibilityResult);
    const refreshed = await getConversation(conversation.id);
    if (refreshed) conversation = refreshed;
  }

  // Issue report filed — stop asking for the same form again
  const reportedIssue = toolCalls.some(
    (c, i) =>
      c.name === "reportDamagedItem" && toolResults[i]?.ok,
  );
  if (reportedIssue) {
    conversation.state.activeFlow = null;
    conversation.state.flowStep = null;
  }

  conversation.state.lastTurnOutcome = outcomeFromTools(
    toolResults,
    conversation.state.slots,
  );

  // Second pass: grounded reply with tool results when AI available
  if (hasAiKey() && toolResults.length) {
    try {
      const ai = createAiProvider();
      const grounded = await ai.complete({
        messages: [
          {
            role: "system",
            content: buildSystemPrompt({
              storeName: brand.storeName,
              agentName: brand.agentName,
              slots: conversation.state.slots,
              goal: conversation.state.goal,
              activeFlow: conversation.state.activeFlow,
              businessHoursSummary: hours.summary,
              verifiedOrderSnapshot: conversation.state.verifiedOrderSnapshot,
              lastTurnOutcome: conversation.state.lastTurnOutcome,
              languageHint: languageInstruction(
                (conversation.state.language as DetectedLanguage) || "en",
              ),
              urgency: conversation.state.urgency,
              channel: conversation.channel,
              workspaceId: conversation.workspaceId,
            }),
          },
          {
            role: "system",
            content: buildResponsePrompt({
              toolResultsJson: JSON.stringify(toolResults.map(summarizeToolResult)),
              knowledgeSnippets: extractKnowledge(toolResults),
              verifiedOrderSnapshot: conversation.state.verifiedOrderSnapshot,
              lastTurnOutcome: conversation.state.lastTurnOutcome,
              clarifyFollowUp: understood.isClarifyFollowUp,
            }),
          },
          ...recentContext(history),
          { role: "user", content: inboundText },
        ],
        temperature: 0.55,
      });
      if (grounded.text) aiText = grounded.text;
    } catch {
      // keep heuristic text
    }
  }

  // If tools ran but model still produced deferred/leaky text, replace with grounded default
  if (toolResults.length && looksLikeDeferredAction(aiText || "")) {
    aiText = undefined;
  }

  // Handoff: never let the model invent a ticket that wasn't created (or skip confirmation)
  for (const tr of toolResults) {
    const data = tr.data as
      | {
          needsTicketConfirm?: boolean;
          ticketRef?: string;
          message?: string;
          returnId?: string;
          needsConfirmation?: boolean;
          eligible?: boolean;
          fullyRefunded?: boolean;
          refundedAmount?: number;
          status?: string;
          alertId?: string;
          alreadySubscribed?: boolean;
          alreadyAvailable?: boolean;
          needsContact?: boolean;
          justCancelled?: boolean;
          disabled?: boolean;
        }
      | undefined;
    if (!data || typeof data !== "object") continue;
    if (data.justCancelled && data.message) {
      aiText = data.message;
      break;
    }
    if (data.disabled && data.message) {
      aiText = data.message;
      break;
    }
    if (data.needsTicketConfirm && data.message) {
      aiText = data.message;
      break;
    }
    if (data.ticketRef && data.message && /ticket|reference/i.test(data.message)) {
      aiText = data.message;
      break;
    }
    if (data.returnId && data.message) {
      aiText = data.message;
      break;
    }
    if (data.needsConfirmation && data.message) {
      aiText = data.message;
      break;
    }
    // Return / exchange eligibility — always use tool copy (cites order + policy)
    if (typeof data.eligible === "boolean" && data.message) {
      aiText = data.message;
      break;
    }
    if (
      data.message &&
      ("available" in data || "alreadyAvailable" in data) &&
      ("product" in data || "productTitle" in data || "productId" in data)
    ) {
      aiText = data.message;
      break;
    }
    // Product compare grounded copy
    if (
      data.message &&
      Array.isArray((data as { products?: unknown[] }).products) &&
      ((data as { products?: unknown[] }).products?.length || 0) >= 2 &&
      /comparison|compare|vs\.|versus|difference/i.test(data.message)
    ) {
      aiText = data.message;
      break;
    }
    if (
      data.message &&
      ("fullyRefunded" in data ||
        "refundedAmount" in data ||
        "alertId" in data ||
        "alreadySubscribed" in data ||
        "needsContact" in data ||
        "exchangeId" in data ||
        "checkoutUrl" in data ||
        "valid" in data ||
        "couponLookup" in data ||
        "etaStart" in data ||
        "etaEnd" in data ||
        "financialStatus" in data ||
        "issueType" in data ||
        "windowDays" in data ||
        (typeof (data as { amount?: number }).amount === "number" &&
          "currency" in data) ||
        (Array.isArray((data as { products?: unknown[] }).products) &&
          ((data as { products?: unknown[] }).products?.length || 0) >= 2) ||
        (typeof (data as { status?: string }).status === "string" &&
          /^(none|partial|refunded|pending)$/.test(
            String((data as { status?: string }).status),
          )))
    ) {
      aiText = data.message;
      break;
    }
  }

  // Connecting handoff: spinner only — never show “prepared a summary” text
  const handoffConnecting = toolResults.some(
    (r) => r.ui?.systemEvent?.type === "handoff_connecting",
  );
  if (handoffConnecting) {
    aiText = undefined;
  }
  if (aiText && /prepared a short summary|shared a short summary/i.test(aiText)) {
    aiText = undefined;
  }

  // Products: if search returned zero matches, never keep a model line that pretends it found some
  const productUi = [...toolResults].reverse().find((r) => r.ui?.contentType === "product_cards");
  if (productUi) {
    const count = productUi.ui?.products?.length ?? 0;
    const search = (productUi.data as { search?: Record<string, unknown> } | undefined)?.search;
    const detailMsg = (productUi.data as { message?: string; ask?: string; checkColor?: string; checkSize?: string } | undefined)?.message;
    const ask = (productUi.data as { ask?: string } | undefined)?.ask;
    const checked =
      (productUi.data as { checkColor?: string; checkSize?: string } | undefined)?.checkColor ||
      (productUi.data as { checkSize?: string } | undefined)?.checkSize;
    // Attribute answers / color-size claim checks: prefer grounded tool message over invent/agree copy
    if (
      detailMsg &&
      (ask ||
        checked ||
        /don'?t have|isn'?t (listed|available)|not (listed|available)|aren'?t listed|doesn'?t list|available in:|made of:|actually,/i.test(
          detailMsg,
        ))
    ) {
      aiText = detailMsg;
    } else if (count === 0) {
      aiText = undefined; // respond.ts builds the honest empty intro from search prefs
    } else if (
      search?.budgetMax != null &&
      /under your budget|within your budget|great options/i.test(aiText || "") &&
      (productUi.ui?.products || []).some((p) => Number(p.price) > Number(search.budgetMax))
    ) {
      aiText = undefined;
    }
  }

  // Don't paste raw knowledge dumps (e.g. "Returns and refunds: …")
  const knowledgeDocs = extractKnowledgeDocs(toolResults);
  if (knowledgeDocs.length && looksLikeRawPolicyDump(aiText || "")) {
    if (hasAiKey()) {
      try {
        const ai = createAiProvider();
        const rewritten = await ai.complete({
          messages: [
            {
              role: "system",
              content:
                "Rewrite the store policy below as a friendly human support agent. Keep every fact accurate. Do not use the document title as a heading. 2–4 sentences.",
            },
            {
              role: "user",
              content: knowledgeDocs.map((d) => d.body).join("\n\n"),
            },
          ],
          temperature: 0.5,
        });
        if (rewritten.text) aiText = rewritten.text;
        else aiText = paraphrasePolicy(knowledgeDocs);
      } catch {
        aiText = paraphrasePolicy(knowledgeDocs);
      }
    } else {
      aiText = paraphrasePolicy(knowledgeDocs);
    }
  } else if (knowledgeDocs.length && !aiText) {
    aiText = paraphrasePolicy(knowledgeDocs);
  }

  let assistantMessages: ChatMessage[] = buildAssistantMessages(aiText, toolResults);
  if (!toolResults.length && !aiText) {
    const snap = conversation.state.verifiedOrderSnapshot;
    const last = conversation.state.lastTurnOutcome;
    let body: string;
    if (snap && /\?|why|when|how|what|status|pack|ship/i.test(inboundText)) {
      body = explainOrderFromSnapshot(snap, inboundText);
    } else if (last?.type === "order_not_found") {
      body = `We still don’t have a match${last.attemptedOrderNumber ? ` for order #${last.attemptedOrderNumber}` : ""}${last.attemptedEmail ? ` with ${last.attemptedEmail}` : ""}. Please use the email that was used at checkout, or say “show again” to re-enter the details.`;
    } else {
      body = humanFallbackReply(inboundText, understood.goal);
    }
    assistantMessages = [
      makeMessage({
        role: "assistant",
        contentType: "text",
        body,
        senderName: env.agentName,
      }),
    ];
  } else if (!toolResults.length && aiText) {
    // Avoid repeating the same capability blurb
    if (looksLikeCapabilityBlurb(aiText)) {
      aiText = humanFallbackReply(inboundText, understood.goal);
    }
    assistantMessages = buildAssistantMessages(aiText, []);
  }

  // After tools, collect next required details with a widget form when needed
  const postFlow =
    conversation.state.activeFlow || suggestedFlowForGoal(understood.goal);
  const postMissing = postFlow
    ? missingSlotsForFlow(
        postFlow as any,
        conversation.state.slots,
        conversation.state.verifiedOrderId,
      )
    : [];
  const nextForm = formForMissing(postFlow as any, postMissing);
  const alreadyHasForm = assistantMessages.some((m) => m.contentType === "input_form");
  if (nextForm && !alreadyHasForm && postMissing.length && !reportedIssue) {
    const onlyNeedsOrderFields =
      nextForm.formId === "order_lookup" &&
      postMissing.every((m) => m === "orderNumber" || m === "email");
    const orderJustVerified = toolResults.some(
      (r) => r.ok && r.ui?.contentType === "order_card",
    );
    // If we just verified the order, skip re-showing order lookup; show the next form instead
    if (!(orderJustVerified && onlyNeedsOrderFields)) {
      assistantMessages.push(
        makeMessage({
          role: "assistant",
          contentType: "text",
          body: introForForm(nextForm),
          senderName: env.agentName,
        }),
        makeMessage({
          role: "assistant",
          contentType: "input_form",
          senderName: env.agentName,
          form: nextForm,
        }),
      );
    }
  }

  await appendMessages(conversation.id, assistantMessages);
  conversation.handoffState = conversation.state.handoffState;
  await saveConversation(conversation);
  publish(conversation.id, { type: "typing", value: false });
  publish(conversation.id, { type: "assistant_messages", messages: assistantMessages });

  return {
    conversationId: conversation.id,
    sessionToken: conversation.sessionToken,
    messages: assistantMessages,
    conversationState: conversation.state,
    handoffState: conversation.handoffState,
  };
}

function hasEnoughToProceed(
  goal: string,
  state: { slots: Record<string, string | undefined>; verifiedOrderId?: string | null },
  missing: string[] = [],
): boolean {
  if (
    missing.some((m) =>
      [
        "addressLine1",
        "city",
        "zip",
        "country",
        "returnReason",
        "issueDescription",
        "exchangeReason",
        "partialReturnItems",
        "customRequestDescription",
      ].includes(m),
    )
  ) {
    return false;
  }
  if (
    [
      "product_recommend",
      "product_search",
      "product_availability",
      "product_compare",
      "similar_products",
      "policy",
      "store_info",
      "size_fit",
      "general",
      "place_order",
      "initiate_refund",
      "discount_help",
      "shipping_cost",
      "delivery_estimate",
      "abandoned_cart",
    ].includes(goal)
  ) {
    return true;
  }
  if (goal === "back_in_stock") {
    return Boolean(state.slots.email || state.slots.phone);
  }
  if (goal === "custom_product_request") {
    return Boolean(
      (state.slots.email || state.slots.phone) &&
        (state.slots.customRequestDescription || state.slots.issueDescription),
    );
  }
  if (goal === "handoff") return true;
  if (state.verifiedOrderId) return true;
  if (state.slots.orderNumber && (state.slots.email || state.slots.phone)) return true;
  if (
    goal === "order_lookup" ||
    goal === "tracking" ||
    goal === "order_status" ||
    goal === "refund_status" ||
    goal === "late_delivery" ||
    goal === "lost_delivery" ||
    goal === "reorder" ||
    goal === "payment_issue" ||
    goal === "exchange_request" ||
    goal === "partial_return"
  ) {
    return Boolean(state.slots.orderNumber && (state.slots.email || state.slots.phone));
  }
  return false;
}

function shouldForceToolsForGoal(
  goal: string,
  message: string,
  ctx: {
    verifiedOrderId?: string | null;
    slots: Record<string, string | undefined>;
    wantsOrderCardAgain?: boolean;
    lastOutcome?: LastTurnOutcome | null;
    identityChanged?: boolean;
  },
): boolean {
  if (goal === "policy" || goal === "store_info" || goal === "size_fit") {
    return /policy|return|refund|ship|cancel|size|fit|hour|contact|care|damage/i.test(
      message,
    );
  }
  if (goal === "product_recommend" || goal === "product_search") {
    return (
      hasProductPreferences(ctx.slots) ||
      wantsProductBrowse(message) ||
      goal === "product_search" ||
      /where (are|is) (they|it|those)|show (them|me )?again|those options|the options/i.test(
        message,
      )
    );
  }
  if (
    goal === "product_availability" ||
    /\b(what|which)\s+colors?\b|\bcolors?\s+available\b/i.test(message)
  ) {
    return true;
  }
  if (goal === "initiate_refund") {
    return /refund/i.test(message);
  }
  if (goal === "return_request") {
    if (ctx.slots.returnRequestId) return false;
    return Boolean(ctx.verifiedOrderId) || Boolean(ctx.slots.orderNumber);
  }
  if (goal === "refund_status") {
    return Boolean(ctx.verifiedOrderId) || Boolean(ctx.slots.orderNumber);
  }
  if (goal === "back_in_stock") {
    if (ctx.slots.backInStockAlertId) return false;
    return true;
  }
  if (goal === "product_compare" || goal === "similar_products") {
    return true;
  }
  if (goal === "discount_help" || goal === "shipping_cost" || goal === "delivery_estimate") {
    return true;
  }
  if (goal === "abandoned_cart") return true;
  if (goal === "custom_product_request") {
    if (ctx.slots.customRequestTicketId) return false;
    return Boolean(
      ctx.slots.email ||
        ctx.slots.phone ||
        /customRequestDescription\s*[:=]|email\s*[:=]/i.test(message),
    );
  }
  if (goal === "payment_issue") {
    return true;
  }
  if (goal === "exchange_request") {
    if (ctx.slots.exchangeRequestId) return false;
    return Boolean(ctx.verifiedOrderId) || Boolean(ctx.slots.orderNumber);
  }
  if (goal === "partial_return") {
    if (ctx.slots.returnRequestId) return false;
    return Boolean(ctx.verifiedOrderId) || Boolean(ctx.slots.orderNumber);
  }
  if (goal === "late_delivery" || goal === "lost_delivery" || goal === "reorder") {
    return Boolean(ctx.verifiedOrderId) || Boolean(ctx.slots.orderNumber);
  }
  if (["order_lookup", "order_status", "tracking"].includes(goal)) {
    // Never re-run tools on a bare "yes/ok" — that should open the form instead
    if (
      /^(yes|yeah|yep|yup|sure|ok|okay|please|alright|go ahead)([.!])?$/i.test(
        message.trim(),
      )
    ) {
      return false;
    }
    if (ctx.wantsOrderCardAgain || looksLikeOrderToolAction(message) || ctx.identityChanged) {
      return true;
    }
    // Don't re-run the exact same failed lookup
    if (
      ctx.lastOutcome?.type === "order_not_found" &&
      ctx.slots.orderNumber &&
      ctx.lastOutcome.attemptedOrderNumber === ctx.slots.orderNumber &&
      (!ctx.slots.email ||
        ctx.lastOutcome.attemptedEmail?.toLowerCase() === ctx.slots.email.toLowerCase())
    ) {
      return false;
    }
    if (!ctx.verifiedOrderId && ctx.slots.orderNumber && (ctx.slots.email || ctx.slots.phone)) {
      return true;
    }
    return false;
  }
  if (goal === "place_order") {
    return false;
  }
  if (goal === "damaged_item" || goal === "incorrect_item" || goal === "missing_item") {
    if (ctx.slots.issueReportTicketId) return false;
    if (!ctx.slots.issueDescription || !ctx.verifiedOrderId) return false;
    // Form dump from the widget
    if (/issueDescription\s*[:=]/i.test(message)) return true;
    // Customer answered after we asked for details / showed the form
    if (ctx.lastOutcome?.type === "form_shown") return true;
    // First "I haven't received it" after an order card → let AI advise first
    if (
      ctx.lastOutcome?.type === "order_found" &&
      /haven'?t received|didn'?t (receive|get|arrive)|not received/i.test(message)
    ) {
      return false;
    }
    // Follow-up details ("its missing", "box was empty", …) → file the report
    return /missing|damaged|broken|incorrect|wrong|empty|incomplete|never arrived/i.test(
      message,
    );
  }
  return false;
}

async function contextualAiReply(input: {
  brand: { storeName: string; agentName: string };
  hoursSummary: string;
  conversation: { state: import("@chatbot/shared").ConversationState };
  history: import("@chatbot/shared").ChatMessage[];
  inboundText: string;
  fallback: string;
  clarifyFollowUp?: boolean;
}): Promise<string> {
  if (!hasAiKey()) return input.fallback;
  try {
    const ai = createAiProvider();
    const grounded = await ai.complete({
      messages: [
        {
          role: "system",
          content: buildSystemPrompt({
            storeName: input.brand.storeName,
            agentName: input.brand.agentName,
            slots: input.conversation.state.slots,
            goal: input.conversation.state.goal,
            activeFlow: input.conversation.state.activeFlow,
            businessHoursSummary: input.hoursSummary,
            verifiedOrderSnapshot: input.conversation.state.verifiedOrderSnapshot,
            lastTurnOutcome: input.conversation.state.lastTurnOutcome,
            languageHint: languageInstruction(
              (input.conversation.state.language as DetectedLanguage) || "en",
            ),
            urgency: input.conversation.state.urgency,
            channel: input.conversation.channel,
            workspaceId: input.conversation.workspaceId,
          }),
        },
        {
          role: "system",
          content: buildResponsePrompt({
            toolResultsJson: "(none)",
            knowledgeSnippets: "",
            verifiedOrderSnapshot: input.conversation.state.verifiedOrderSnapshot,
            lastTurnOutcome: input.conversation.state.lastTurnOutcome,
            clarifyFollowUp: input.clarifyFollowUp,
          }),
        },
        ...recentContext(input.history),
        { role: "user", content: input.inboundText },
      ],
      temperature: 0.55,
    });
    if (grounded.text && !looksLikeDeferredAction(grounded.text)) {
      return grounded.text;
    }
  } catch {
    // fallback
  }
  return input.fallback;
}

async function finishTextTurn(
  conversation: Awaited<ReturnType<typeof getConversation>> & object,
  body: string,
) {
  const conv = conversation!;
  const assistant = [
    makeMessage({
      role: "assistant",
      contentType: "text",
      body,
      senderName: env.agentName,
    }),
  ];
  await appendMessages(conv.id, assistant);
  await saveConversation(conv);
  publish(conv.id, { type: "typing", value: false });
  publish(conv.id, { type: "assistant_messages", messages: assistant });
  return {
    conversationId: conv.id,
    sessionToken: conv.sessionToken,
    messages: assistant,
    conversationState: conv.state,
    handoffState: conv.handoffState,
  };
}

function outcomeFromTools(
  results: Array<{ ok: boolean; code?: string; error?: string; ui?: { contentType?: string; order?: { orderNumber?: string } } }>,
  slots: Record<string, string | undefined>,
): LastTurnOutcome {
  const failed = results.find((r) => !r.ok);
  if (failed?.code === "ORDER_NOT_FOUND") {
    return {
      type: "order_not_found",
      code: failed.code,
      summary: failed.error || "No matching order found",
      attemptedOrderNumber: slots.orderNumber,
      attemptedEmail: slots.email,
      at: new Date().toISOString(),
    };
  }
  if (failed) {
    return {
      type: "tool_error",
      code: failed.code,
      summary: failed.error || "Something went wrong",
      attemptedOrderNumber: slots.orderNumber,
      attemptedEmail: slots.email,
      at: new Date().toISOString(),
    };
  }
  const orderUi = [...results].reverse().find((r) => r.ui?.contentType === "order_card");
  if (orderUi?.ui?.order?.orderNumber) {
    return {
      type: "order_found",
      summary: `Showed order #${orderUi.ui.order.orderNumber}`,
      attemptedOrderNumber: orderUi.ui.order.orderNumber,
      attemptedEmail: slots.email,
      at: new Date().toISOString(),
    };
  }
  return {
    type: "general",
    summary: "Completed tool turn",
    at: new Date().toISOString(),
  };
}

function askForMissing(missing: string[]): string {
  if (missing.includes("orderNumber") && missing.includes("email")) {
    return "Sure — enter your order number and the email on the order below.";
  }
  if (missing.includes("orderNumber")) return "What’s your order number?";
  if (missing.includes("email")) return "What’s the email on the order?";
  if (missing.includes("returnReason")) return "What’s the reason for the return?";
  if (missing.includes("addressLine1")) return "Please enter the new shipping address below.";
  if (missing.includes("issueDescription")) {
    return "Sorry about that — describe what arrived damaged or incorrect below.";
  }
  return "Could you share a bit more so I can help?";
}

void askForMissing;

function summarizeToolResult(r: {
  ok: boolean;
  data?: unknown;
  error?: string;
  code?: string;
}) {
  return {
    ok: r.ok,
    code: r.code,
    error: r.error,
    data: r.data,
  };
}

function extractKnowledge(results: Array<{ data?: unknown }>): string {
  for (const r of results) {
    const docs = (r.data as { documents?: Array<{ title: string; body: string }> })
      ?.documents;
    if (docs?.length) {
      return docs.map((d) => `${d.title}: ${d.body}`).join("\n");
    }
  }
  return "";
}

function extractKnowledgeDocs(
  results: Array<{ data?: unknown }>,
): Array<{ title: string; body: string }> {
  for (const r of results) {
    const docs = (r.data as { documents?: Array<{ title: string; body: string }> })
      ?.documents;
    if (docs?.length) return docs;
  }
  return [];
}

function looksLikeRawPolicyDump(text: string): boolean {
  if (!text) return true;
  return /^(Returns and refunds|Shipping policy|Cancellations|Size and fit|Product care|Damaged|Store contact)\s*:/i.test(
    text.trim(),
  );
}

function looksLikeCapabilityBlurb(text: string): boolean {
  return /i can help with orders.*(products|policies)/i.test(text);
}
