import { randomUUID } from "node:crypto";
import type { ToolResult } from "@chatbot/shared";
import { getStoreAdapter } from "../commerce/factory.js";
import { evaluateReturnEligibility } from "../commerce/returnPolicy.js";
import { env } from "../config/env.js";
import {
  compareProductFacts,
  detectLanguage,
  detectUrgency,
  estimateDeliveryWindow,
  estimateShippingCost,
  extractProductNameHints,
  getKnownCoupons,
  pickBestProductsByName,
  scoreSimilarProduct,
} from "../engine/featureHelpers.js";
import { sendEmail } from "../notify/email.js";
import {
  createTicket,
  getMessages,
  saveConversation,
  type ConversationRecord,
} from "../storage/store.js";
import type { AiToolSpec } from "../ai/provider.js";

export type ToolContext = {
  workspaceId: string;
  conversation: ConversationRecord;
};

type ToolHandler = (
  args: Record<string, unknown>,
  ctx: ToolContext,
) => Promise<ToolResult>;

function productCards(
  products: Array<{
    id: string;
    title: string;
    imageUrl?: string;
    price?: number;
    currency?: string;
    url?: string;
    available?: boolean;
  }>,
  reasons?: string[],
) {
  return {
    ok: true as const,
    ui: {
      contentType: "product_cards" as const,
      products: products.map((p, i) => ({
        id: p.id,
        title: p.title,
        imageUrl: p.imageUrl,
        price: p.price,
        currency: p.currency || "USD",
        url: p.url,
        available: p.available,
        reason: reasons?.[i],
      })),
      search: undefined,
    },
  };
}

function requireVerifiedOrder(
  ctx: ToolContext,
  orderId?: string,
): { ok: true; orderId: string } | { ok: false; error: string; code: string } {
  const id = orderId || ctx.conversation.state.verifiedOrderId;
  if (!id) {
    return {
      ok: false,
      error: "I need to look up your order first — share the order number and email.",
      code: "ORDER_NOT_VERIFIED",
    };
  }
  return { ok: true, orderId: id };
}

export const extraToolDefinitions: AiToolSpec[] = [
  {
    name: "compareProducts",
    description:
      "Compare 2–4 products side by side (price, colors, sizes, materials, stock). Use when the customer asks which is better or to compare options.",
    parameters: {
      type: "object",
      properties: {
        productIds: { type: "array", items: { type: "string" } },
      },
      required: ["productIds"],
    },
  },
  {
    name: "suggestSimilarProducts",
    description:
      "Suggest products similar to a given product (or the last recommended one). Use for “something similar”, “like this”, or after out-of-stock.",
    parameters: {
      type: "object",
      properties: {
        productId: { type: "string" },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "createExchangeRequest",
    description:
      "Start an exchange (different size/color) for a verified eligible order. Collect reason and desired swap details.",
    parameters: {
      type: "object",
      properties: {
        orderId: { type: "string" },
        reason: { type: "string" },
        desiredSize: { type: "string" },
        desiredColor: { type: "string" },
        itemTitle: { type: "string" },
        confirmed: { type: "boolean" },
      },
      required: ["reason"],
    },
  },
  {
    name: "createPartialReturn",
    description:
      "Start a partial return for specific items on a verified eligible order (not the whole order).",
    parameters: {
      type: "object",
      properties: {
        orderId: { type: "string" },
        reason: { type: "string" },
        itemTitles: { type: "array", items: { type: "string" } },
        confirmed: { type: "boolean" },
      },
      required: ["reason", "itemTitles"],
    },
  },
  {
    name: "reportLateOrLostDelivery",
    description:
      "Help with late or lost packages: check tracking, open a delivery investigation ticket, and advise next steps.",
    parameters: {
      type: "object",
      properties: {
        orderId: { type: "string" },
        issueType: { type: "string", enum: ["late", "lost"] },
        description: { type: "string" },
      },
      required: ["issueType"],
    },
  },
  {
    name: "estimateDeliveryDate",
    description:
      "Estimate delivery dates from order tracking or standard/express/international shipping windows.",
    parameters: {
      type: "object",
      properties: {
        orderId: { type: "string" },
        speed: { type: "string", enum: ["standard", "express", "international"] },
      },
    },
  },
  {
    name: "estimateShippingCost",
    description: "Estimate shipping cost by destination country and speed.",
    parameters: {
      type: "object",
      properties: {
        destinationCountry: { type: "string" },
        speed: { type: "string", enum: ["standard", "express", "international"] },
        orderTotal: { type: "number" },
      },
    },
  },
  {
    name: "lookupDiscountOrCoupon",
    description:
      "Explain available discounts/coupons or validate a coupon code the customer mentions.",
    parameters: {
      type: "object",
      properties: {
        code: { type: "string" },
        query: { type: "string" },
      },
    },
  },
  {
    name: "helpPaymentIssue",
    description:
      "Assist with payment problems (declined card, pending payment, charged twice). Never collect card numbers. Offer safe next steps or handoff.",
    parameters: {
      type: "object",
      properties: {
        orderId: { type: "string" },
        issue: { type: "string" },
      },
    },
  },
  {
    name: "reorderPreviousProducts",
    description:
      "Show products from a previously verified order so the customer can reorder via View More on the product cards. Do not create checkout links.",
    parameters: {
      type: "object",
      properties: {
        orderId: { type: "string" },
      },
    },
  },
  {
    name: "submitCustomProductRequest",
    description:
      "Capture a custom product / made-to-order request with customer contact and details.",
    parameters: {
      type: "object",
      properties: {
        description: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        budget: { type: "string" },
        size: { type: "string" },
        color: { type: "string" },
      },
      required: ["description"],
    },
  },
  {
    name: "assistAbandonedCart",
    description:
      "Help with an abandoned cart reminder. Do not create checkout links — point the customer to product cards / View More on the website.",
    parameters: {
      type: "object",
      properties: {
        email: { type: "string" },
      },
    },
  },
  {
    name: "buildHandoffSummary",
    description:
      "Internal only: build a private conversation summary for agents. Prefer requestHumanHandoff (it builds the summary automatically). Do not tell the customer about the summary.",
    parameters: {
      type: "object",
      properties: {
        reason: { type: "string" },
      },
    },
  },
];

export const extraHandlers: Record<string, ToolHandler> = {
  async compareProducts(args, ctx) {
    const store = getStoreAdapter(ctx.workspaceId);
    let ids = (args.productIds as string[]) || [];
    if (!ids.length) {
      ids = String(ctx.conversation.state.slots.lastRecommendedProductIds || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 4);
    }
    ids = ids.slice(0, 4);

    const products = [];
    for (const id of ids) {
      const p = await store.getProduct(id);
      if (p) products.push(p);
    }

    // Resolve named products from the customer message when ids are missing
    if (products.length < 2) {
      const catalog = await store.searchProducts({ limit: 40 });
      const hints = [
        ...((args.names as string[]) || []),
        ...extractProductNameHints(String(args.query || args.message || "")),
      ];
      for (const hint of hints) {
        const hit = pickBestProductsByName(catalog, hint, { limit: 1, minScore: 4 })[0];
        if (hit && !products.some((p) => p.id === hit.id)) products.push(hit);
        if (products.length >= 2) break;
      }
      // "Emilia and Sofia" style — try each hint separately if still short
      if (products.length < 2 && hints.length) {
        const joined = hints.join(" ");
        const multi = pickBestProductsByName(catalog, joined, { limit: 4, minScore: 3 });
        for (const hit of multi) {
          if (!products.some((p) => p.id === hit.id)) products.push(hit);
          if (products.length >= 2) break;
        }
      }
    }

    if (products.length < 2) {
      return {
        ok: false,
        error: "Share at least two product names or pick two cards to compare.",
        code: "NEED_TWO_PRODUCTS",
        data: {
          message:
            "Tell me which two products to compare (for example Emilia and Sofia), or pick two from the cards.",
        },
      };
    }
    const cards = productCards(products);
    ctx.conversation.state.slots.lastRecommendedProductIds = products.map((p) => p.id).join(",");
    await saveConversation(ctx.conversation);
    return {
      ok: true,
      data: {
        products: products.map((p) => ({
          id: p.id,
          title: p.title,
          price: p.price,
          colors: p.colors,
          sizes: p.sizes,
          materials: p.materials,
          available: p.available,
        })),
        message: compareProductFacts(products),
      },
      ui: cards.ui,
    };
  },

  async suggestSimilarProducts(args, ctx) {
    const store = getStoreAdapter(ctx.workspaceId);
    const slots = ctx.conversation.state.slots;
    const productId =
      (args.productId as string) ||
      slots.lastProductId ||
      slots.productId ||
      String(slots.lastRecommendedProductIds || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)[0];
    if (!productId) {
      return {
        ok: false,
        error: "Which product should I find similar options for?",
        code: "PRODUCT_REQUIRED",
      };
    }
    const seed = await store.getProduct(String(productId));
    if (!seed) return { ok: false, error: "Product not found.", code: "NOT_FOUND" };
    const catalog = await store.searchProducts({
      query: seed.productType || seed.title.split(/\s+/)[0],
      availableOnly: true,
      limit: 24,
    });
    const ranked = catalog
      .map((p) => ({ p, score: scoreSimilarProduct(seed, p) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.min(8, Number(args.limit) || 6));
    const products = ranked.map((x) => x.p);
    if (!products.length) {
      return {
        ok: true,
        data: {
          message: `I couldn’t find close matches to ${seed.title} right now. Want to browse by color, size, or budget instead?`,
        },
      };
    }
    slots.lastRecommendedProductIds = products.map((p) => p.id).join(",");
    slots.lastProductId = products[0]?.id;
    await saveConversation(ctx.conversation);
    const cards = productCards(
      products,
      ranked.map(() => `similar to ${seed.title}`),
    );
    return {
      ok: true,
      data: {
        seedId: seed.id,
        seedTitle: seed.title,
        message: `Here are options similar to ${seed.title}:`,
        search: { query: `similar:${seed.title}` },
      },
      ui: { ...cards.ui, search: { query: `similar to ${seed.title}` } },
    };
  },

  async createExchangeRequest(args, ctx) {
    const verified = requireVerifiedOrder(ctx, args.orderId as string | undefined);
    if (!verified.ok) return verified;
    const store = getStoreAdapter(ctx.workspaceId);
    const order = await store.getOrder(verified.orderId);
    if (!order) return { ok: false, error: "Order not found.", code: "NOT_FOUND" };
    if (!order.returnEligible) {
      const eligibility = evaluateReturnEligibility({
        ...order,
        orderNumber: order.orderNumber,
      });
      const message = eligibility.eligible
        ? `Looking at order #${order.orderNumber}, you can request an exchange under our return policy.`
        : eligibility.message
            .replace(/\ba return\b/gi, "an exchange")
            .replace(/\breturn\b/gi, "exchange");
      return {
        ok: false,
        error: message,
        code: "NOT_ELIGIBLE",
        data: { eligible: false, message },
      };
    }
    const reason = String(args.reason || "").trim();
    if (!reason) {
      return { ok: false, error: "What’s the reason for the exchange?", code: "REASON_REQUIRED" };
    }
    if (!args.confirmed) {
      const token = randomUUID();
      ctx.conversation.state.pendingAction = {
        actionId: "create_exchange",
        tool: "createExchangeRequest",
        args: { ...args, orderId: verified.orderId, confirmed: true },
        confirmToken: token,
      };
      await saveConversation(ctx.conversation);
      return {
        ok: true,
        data: {
          needsConfirmation: true,
          message: `I can start an exchange for order #${order.orderNumber}. Please confirm below.`,
        },
        ui: {
          contentType: "input_form",
          form: {
            formId: randomUUID(),
            title: "Confirm exchange",
            summary: [
              `Order #${order.orderNumber}`,
              `Reason: ${reason}`,
              args.desiredSize ? `Desired size: ${args.desiredSize}` : "",
              args.desiredColor ? `Desired color: ${args.desiredColor}` : "",
            ].filter(Boolean),
            fields: [],
            submitLabel: "Yes, start the exchange",
            actionId: "create_exchange",
            confirmToken: token,
          },
        },
      };
    }

    const swapBits = [
      args.itemTitle ? `Item: ${args.itemTitle}` : null,
      args.desiredSize ? `Size → ${args.desiredSize}` : null,
      args.desiredColor ? `Color → ${args.desiredColor}` : null,
    ]
      .filter(Boolean)
      .join("; ");
    const returnResult = await store.createReturn(
      verified.orderId,
      `EXCHANGE: ${reason}${swapBits ? ` (${swapBits})` : ""}`,
      args.itemTitle ? [String(args.itemTitle)] : undefined,
    );
    const ref = returnResult.returnId || `EX-${order.orderNumber}`;
    try {
      await createTicket({
        workspaceId: ctx.workspaceId,
        conversationId: ctx.conversation.id,
        email: order.email || ctx.conversation.visitorEmail,
        phone: ctx.conversation.visitorPhone,
        subject: `Exchange ${ref} — order #${order.orderNumber}`,
        body: `Exchange request via chat.\nOrder: #${order.orderNumber}\nReason: ${reason}\n${swapBits}\nReturn/Exchange ID: ${ref}`,
      });
    } catch {}
    ctx.conversation.state.pendingAction = null;
    ctx.conversation.state.slots.exchangeRequestId = ref;
    await saveConversation(ctx.conversation);
    return {
      ok: returnResult.ok,
      data: {
        exchangeId: ref,
        message: returnResult.ok
          ? `Exchange ${ref} started for order #${order.orderNumber}. We’ll email return/shipping steps for the swap${swapBits ? ` (${swapBits})` : ""}.`
          : returnResult.message,
      },
      error: returnResult.ok ? undefined : returnResult.message,
      requiresHuman: !returnResult.ok,
    };
  },

  async createPartialReturn(args, ctx) {
    const verified = requireVerifiedOrder(ctx, args.orderId as string | undefined);
    if (!verified.ok) return verified;
    const store = getStoreAdapter(ctx.workspaceId);
    const order = await store.getOrder(verified.orderId);
    if (!order) return { ok: false, error: "Order not found.", code: "NOT_FOUND" };
    const items = (args.itemTitles as string[]) || [];
    if (!items.length) {
      return {
        ok: false,
        error: "Which item(s) do you want to return? List the product name(s).",
        code: "ITEMS_REQUIRED",
        data: {
          orderItems: order.items.map((i) => i.title),
          message: `Which items from order #${order.orderNumber} should I return? You have: ${order.items.map((i) => i.title).join(", ")}.`,
        },
      };
    }
    const reason = String(args.reason || "Partial return").trim();
    if (!args.confirmed) {
      const token = randomUUID();
      ctx.conversation.state.pendingAction = {
        actionId: "create_partial_return",
        tool: "createPartialReturn",
        args: { ...args, orderId: verified.orderId, confirmed: true },
        confirmToken: token,
      };
      await saveConversation(ctx.conversation);
      return {
        ok: true,
        data: {
          needsConfirmation: true,
          message: `I’ll start a partial return for: ${items.join(", ")}. Confirm below.`,
        },
        ui: {
          contentType: "input_form",
          form: {
            formId: randomUUID(),
            title: "Confirm partial return",
            summary: [`Order #${order.orderNumber}`, `Items: ${items.join(", ")}`, `Reason: ${reason}`],
            fields: [],
            submitLabel: "Yes, return these items",
            actionId: "create_partial_return",
            confirmToken: token,
          },
        },
      };
    }
    const result = await store.createReturn(verified.orderId, reason, items);
    ctx.conversation.state.pendingAction = null;
    if (result.ok) {
      ctx.conversation.state.slots.returnRequestId = result.returnId || "partial";
      try {
        await createTicket({
          workspaceId: ctx.workspaceId,
          conversationId: ctx.conversation.id,
          email: order.email,
          subject: `Partial return — order #${order.orderNumber}`,
          body: `Partial return.\nItems: ${items.join(", ")}\nReason: ${reason}\nID: ${result.returnId}`,
        });
      } catch {}
    }
    await saveConversation(ctx.conversation);
    return {
      ok: result.ok,
      data: {
        ...result,
        message: result.ok
          ? `Partial return ${result.returnId || ""} started for ${items.join(", ")} on order #${order.orderNumber}.`
          : result.message,
      },
      error: result.ok ? undefined : result.message,
      requiresHuman: !result.ok,
    };
  },

  async reportLateOrLostDelivery(args, ctx) {
    const verified = requireVerifiedOrder(ctx, args.orderId as string | undefined);
    if (!verified.ok) return verified;
    const store = getStoreAdapter(ctx.workspaceId);
    const order = await store.getOrder(verified.orderId);
    if (!order) return { ok: false, error: "Order not found.", code: "NOT_FOUND" };
    const issueType = String(args.issueType || "late") === "lost" ? "lost" : "late";
    const description =
      String(args.description || "").trim() ||
      (issueType === "lost"
        ? "Customer reports package lost / not received"
        : "Customer reports late delivery");

    const trackBit = order.tracking?.number
      ? `Tracking ${order.tracking.number}${order.tracking.url ? ` (${order.tracking.url})` : ""}`
      : "No tracking number on file yet";
    const statusBit = `Shipment: ${order.shipmentStatus}; fulfillment: ${order.fulfillmentStatus}`;

    let advice = "";
    if (order.shipmentStatus === "not_shipped" || order.fulfillmentStatus === "unfulfilled") {
      advice =
        "This order hasn’t shipped yet, so it isn’t late with the carrier — I can check cancellation or expected ship timing instead.";
    } else if (issueType === "late") {
      advice =
        "I’ve logged a late-delivery check. Carriers often update within 24–48 hours; if it stays stuck, our team will open a claim.";
    } else {
      advice =
        "I’ve opened a lost-package investigation. Our team will work with the carrier and follow up by email.";
    }

    const ticket = await createTicket({
      workspaceId: ctx.workspaceId,
      conversationId: ctx.conversation.id,
      email: order.email || ctx.conversation.visitorEmail,
      phone: ctx.conversation.visitorPhone,
      subject: `${issueType === "lost" ? "Lost" : "Late"} delivery — order #${order.orderNumber}`,
      body: `${description}\nOrder: #${order.orderNumber}\n${statusBit}\n${trackBit}`,
    });

    return {
      ok: true,
      data: {
        ticketId: ticket.id,
        issueType,
        tracking: order.tracking || null,
        message: `Order #${order.orderNumber}: ${statusBit}. ${trackBit}. ${advice} Reference ${ticket.id.slice(0, 8).toUpperCase()}.`,
      },
      ui: {
        contentType: "choices",
        choices: [
          {
            id: "connect_agent_delivery",
            label: "Talk to an agent",
            value: "Please connect me with an agent about my delivery",
          },
          { id: "all_set", label: "All set, thanks", value: "All set, thank you" },
        ],
      },
    };
  },

  async estimateDeliveryDate(args, ctx) {
    const store = getStoreAdapter(ctx.workspaceId);
    let order = null;
    const orderId = (args.orderId as string) || ctx.conversation.state.verifiedOrderId;
    if (orderId) order = await store.getOrder(String(orderId));
    const speed = (args.speed as "standard" | "express" | "international") || undefined;
    const est = estimateDeliveryWindow({ order, speed });
    return { ok: true, data: { ...est } };
  },

  async estimateShippingCost(args) {
    const est = estimateShippingCost({
      destinationCountry: args.destinationCountry as string | undefined,
      speed: args.speed as "standard" | "express" | "international" | undefined,
      orderTotal: args.orderTotal != null ? Number(args.orderTotal) : undefined,
    });
    return { ok: true, data: est };
  },

  async lookupDiscountOrCoupon(args) {
    const code = String(args.code || "")
      .trim()
      .toUpperCase();
    const query = String(args.query || "").toLowerCase();
    const coupons = getKnownCoupons();

    if (code) {
      const hit = coupons.find((c) => c.code === code);
      if (!hit) {
        return {
          ok: true,
          data: {
            valid: false,
            couponLookup: true,
            message: coupons.length
              ? `I don’t recognize the code “${code}”. Current promos I can confirm: ${coupons.map((c) => c.code).join(", ")}. Enter codes at checkout to apply — I won’t invent others.`
              : `I can’t verify promo codes from chat, and I won’t invent discount codes. Enter “${code}” at checkout — the store will accept it if it’s valid. If it doesn’t apply, I can connect you with an agent.`,
          },
        };
      }
      return {
        ok: true,
        data: {
          valid: true,
          couponLookup: true,
          code: hit.code,
          message: `Yes — ${hit.code}: ${hit.description}.${
            hit.minSubtotal ? ` Min. subtotal $${hit.minSubtotal}.` : ""
          } Enter it at checkout to apply.`,
        },
      };
    }

    if (!coupons.length) {
      return {
        ok: true,
        data: {
          valid: false,
          couponLookup: true,
          message:
            "I don’t have a live list of store promo codes in chat, and I won’t invent any. If you have a code, enter it at checkout — or share it here and I can only confirm codes we’ve been configured to know. For current promotions, check the site banner or ask an agent.",
        },
      };
    }

    const list = coupons
      .map((c) => `${c.code} — ${c.description}`)
      .join("; ");
    return {
      ok: true,
      data: {
        valid: true,
        couponLookup: true,
        message: /coupon|discount|promo|code/i.test(query)
          ? `Available promos I can confirm: ${list}. Codes may not stack — checkout shows what applies.`
          : `Here’s what I can confirm: ${list}.`,
      },
    };
  },

  async helpPaymentIssue(args, ctx) {
    const store = getStoreAdapter(ctx.workspaceId);
    const orderId = (args.orderId as string) || ctx.conversation.state.verifiedOrderId;
    const issue = String(args.issue || ctx.conversation.state.slots.issueDescription || "").toLowerCase();
    let order = null;
    if (orderId) order = await store.getOrder(String(orderId));

    const financial = order?.financialStatus || "unknown";
    let message = "";
    if (/declin|fail|didn't go|did not go|error/i.test(issue)) {
      message =
        "If the card was declined, double-check billing address/CVV on the secure checkout page (I can’t take card numbers here). Try another card or payment method, or ask your bank if they blocked the charge.";
    } else if (/twice|double|charged twice|duplicate/i.test(issue)) {
      message =
        "If you see two charges, one is often a temporary authorization that drops off in a few days. Share your order number and I can verify payment status — for a true duplicate charge I’ll connect you with an agent.";
    } else if (/pending|not captured|authorized/i.test(issue) || /pending|authorized/i.test(financial)) {
      message = order
        ? `Order #${order.orderNumber} payment shows as ${financial}. Pending/authorized charges usually capture when the order is fulfilled or within a few days.`
        : "Pending payments usually finalize when the order is processed. Share your order number + email and I can check the payment status.";
    } else if (order) {
      message = `On order #${order.orderNumber}, payment status is ${financial}. I can’t collect card details in chat — use the store checkout/account page for payment updates, or I can connect you with an agent.`;
    } else {
      message =
        "I can help with payment issues safely: I never ask for full card numbers or CVV. Tell me what happened (declined, pending, charged twice) and your order number if you have one.";
    }

    return {
      ok: true,
      data: {
        financialStatus: financial,
        message,
      },
      ui: {
        contentType: "choices",
        choices: [
          {
            id: "connect_agent_payment",
            label: "Talk to an agent",
            value: "Please connect me with an agent about a payment issue",
          },
          { id: "check_order_payment", label: "Look up my order", value: "Please look up my order payment status" },
        ],
      },
    };
  },

  async reorderPreviousProducts(args, ctx) {
    const verified = requireVerifiedOrder(ctx, args.orderId as string | undefined);
    if (!verified.ok) return verified;
    const store = getStoreAdapter(ctx.workspaceId);
    const order = await store.getOrder(verified.orderId);
    if (!order) return { ok: false, error: "Order not found.", code: "NOT_FOUND" };
    const products = [];
    for (const item of order.items) {
      if (!item.productId) continue;
      const p = await store.getProduct(item.productId);
      if (p) products.push(p);
    }
    if (!products.length) {
      return {
        ok: true,
        data: {
          message: `I see order #${order.orderNumber} (${order.items.map((i) => i.title).join(", ")}), but I couldn’t reload those products for reorder. Want me to search the catalog by name?`,
        },
      };
    }
    ctx.conversation.state.slots.lastRecommendedProductIds = products.map((p) => p.id).join(",");
    ctx.conversation.state.slots.lastProductId = products[0]?.id;
    await saveConversation(ctx.conversation);
    const cards = productCards(products);
    return {
      ok: true,
      data: {
        orderNumber: order.orderNumber,
        message: `Here are items from order #${order.orderNumber}. Use View More on a card to open the product page and reorder on the website.`,
      },
      ui: cards.ui,
    };
  },

  async submitCustomProductRequest(args, ctx) {
    const description = String(args.description || "").trim();
    if (!description) {
      return { ok: false, error: "Describe the custom piece you want.", code: "DESC_REQUIRED" };
    }
    const email =
      (args.email as string) ||
      ctx.conversation.visitorEmail ||
      ctx.conversation.state.slots.email;
    const phone =
      (args.phone as string) ||
      ctx.conversation.visitorPhone ||
      ctx.conversation.state.slots.phone;
    if (!email && !phone) {
      return {
        ok: false,
        error: "Email or phone is required for a custom request.",
        code: "CONTACT_REQUIRED",
        data: {
          needsContact: true,
          message: "Share your email so our team can follow up on your custom request.",
        },
        ui: {
          contentType: "input_form",
          form: {
            formId: randomUUID(),
            title: "Custom request contact",
            fields: [
              { name: "email", label: "Email", type: "email", required: true },
              { name: "phone", label: "Phone", type: "tel", required: false },
              {
                name: "description",
                label: "What do you need?",
                required: true,
                placeholder: "Describe the custom dress / alterations / design",
              },
              { name: "budget", label: "Budget", required: false },
              { name: "size", label: "Size", required: false },
              { name: "color", label: "Color", required: false },
            ],
            submitLabel: "Submit request",
            actionId: "custom_product_request",
          },
        },
      };
    }
    if (email) {
      ctx.conversation.visitorEmail = email;
      ctx.conversation.state.slots.email = email;
    }
    const ticket = await createTicket({
      workspaceId: ctx.workspaceId,
      conversationId: ctx.conversation.id,
      email: email || undefined,
      phone: phone || undefined,
      subject: "Custom product request",
      body: `Custom request via chat.\n${description}\nBudget: ${args.budget || "n/a"}\nSize: ${args.size || "n/a"}\nColor: ${args.color || "n/a"}`,
    });
    ctx.conversation.state.slots.customRequestTicketId = ticket.id;
    ctx.conversation.state.activeFlow = null;
    await saveConversation(ctx.conversation);
    if (email && email.includes("@")) {
      try {
        await sendEmail({
          to: email,
          subject: `We received your custom request — ${env.storeName}`,
          text: `Thanks for your custom request. Our team will review it and follow up.\n\nYour note:\n${description}\n\nReference: ${ticket.id.slice(0, 8).toUpperCase()}\n\n— ${env.storeName}`,
        });
      } catch {}
    }
    return {
      ok: true,
      data: {
        ticketId: ticket.id,
        message: `Custom request received (ref ${ticket.id.slice(0, 8).toUpperCase()}). Our team will follow up${email ? ` at ${email}` : ""}.`,
      },
    };
  },

  async assistAbandonedCart(args, ctx) {
    const slots = ctx.conversation.state.slots;
    const productId = slots.lastProductId || slots.productId;
    const title = slots.lastCheckoutProductTitle;

    if (productId || title) {
      return {
        ok: true,
        data: {
          message: title
            ? `I still have ${title} from this chat. Use View More on the product card (or ask me to show it again) to open the website and finish checkout there — I can’t send checkout links in chat.`
            : "I still have a product from this chat. Ask me to show it again, then use View More on the card to check out on the website — I can’t send checkout links in chat.",
        },
        ui: {
          contentType: "choices",
          choices: [
            {
              id: "browse_products",
              label: "Show me products",
              value: "Show me product recommendations",
            },
          ],
        },
      };
    }

    return {
      ok: true,
      data: {
        message:
          "I don’t have a saved cart in this chat. Tell me what you’re looking for and I’ll show product cards — use View More to check out on the website.",
      },
      ui: {
        contentType: "choices",
        choices: [
          {
            id: "browse_products",
            label: "Show me products",
            value: "Show me product recommendations",
          },
        ],
      },
    };
  },

  async buildHandoffSummary(args, ctx) {
    const history = await getMessages(ctx.conversation.id);
    const recent = history.slice(-16);
    const lines = recent.map((m) => {
      const who =
        m.role === "customer" ? "Customer" : m.role === "agent" ? "Agent" : "Assistant";
      const body = String(m.body || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 220);
      return body ? `${who}: ${body}` : null;
    }).filter(Boolean);
    const snap = ctx.conversation.state.verifiedOrderSnapshot;
    const slots = ctx.conversation.state.slots;
    const meta = [
      `Goal: ${ctx.conversation.state.goal}`,
      ctx.conversation.state.urgency
        ? `Urgency: ${ctx.conversation.state.urgency}`
        : null,
      ctx.conversation.state.language
        ? `Language: ${ctx.conversation.state.language}`
        : null,
      snap
        ? `Order #${snap.orderNumber} — pay ${snap.financialStatus}, fulfill ${snap.fulfillmentStatus}, ship ${snap.shipmentStatus}`
        : null,
      slots.email ? `Email: ${slots.email}` : null,
      args.reason ? `Handoff reason: ${args.reason}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    const summary = `${meta}\n\nRecent chat:\n${lines.join("\n") || "(no messages)"}`;
    ctx.conversation.state.slots.handoffSummary = summary.slice(0, 3500);
    await saveConversation(ctx.conversation);
    return {
      ok: true,
      data: {
        summary,
        // No customer-facing message — summary is for agents only
        silent: true,
      },
    };
  },
};

export { detectLanguage, detectUrgency };
