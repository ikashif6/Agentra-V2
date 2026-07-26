import type { ToolResult } from "@chatbot/shared";
import type { AiToolSpec } from "../ai/provider.js";
import type { ConversationRecord } from "../storage/store.js";
import { getStoreAdapter } from "../commerce/factory.js";
import { searchKnowledgeBase } from "../knowledge/store.js";
import { requestHandoff } from "../handoff/service.js";
import { getBusinessHoursStatus, areAgentsOnline } from "../handoff/hours.js";
import { createTicket, createCustomerAlert, saveConversation, listCustomerAlerts, getMessages } from "../storage/store.js";
import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { evaluateReturnEligibility } from "../commerce/returnPolicy.js";
import { sendEmail } from "../notify/email.js";
import { extraHandlers, extraToolDefinitions } from "./extraHandlers.js";
import { parseColorFilters, productMatchesAnyColor } from "../commerce/colorFilter.js";
import {
  extractProductNameHints,
  pickBestProductsByName,
} from "../engine/featureHelpers.js";
import {
  featureForTool,
  getWorkspaceConfig,
  isFeatureEnabled,
} from "../workspace/index.js";

export type ToolContext = {
  workspaceId: string;
  conversation: ConversationRecord;
};

type ToolHandler = (
  args: Record<string, unknown>,
  ctx: ToolContext,
) => Promise<ToolResult>;

async function resolveProductFromArgs(
  args: Record<string, unknown>,
  ctx?: ToolContext,
): Promise<NonNullable<
  Awaited<ReturnType<ReturnType<typeof getStoreAdapter>["getProduct"]>>
> | null> {
  const store = getStoreAdapter(ctx.workspaceId);
  const slots = ctx?.conversation.state.slots || {};
  const id =
    (args.productId as string) ||
    slots.lastProductId ||
    slots.productId ||
    String(slots.lastRecommendedProductIds || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)[0];
  if (id) {
    const byId = await store.getProduct(String(id));
    if (byId) return byId;
  }

  const query = String(
    args.query ||
      args.title ||
      args.productName ||
      args.productQuery ||
      slots.productQuery ||
      "",
  ).trim();
  const hints = [
    ...(query ? [query] : []),
    ...extractProductNameHints(query || String(args.message || "")),
  ];
  if (!hints.length && args.message) {
    hints.push(...extractProductNameHints(String(args.message)));
  }
  if (!hints.length) return null;

  const catalog = await store.searchProducts({ limit: 40 });
  for (const hint of hints) {
    const hits = pickBestProductsByName(catalog, hint, { limit: 1, minScore: 4 });
    if (hits[0]) return hits[0];
  }
  // Fallback: search API with the best hint
  const searched = await store.searchProducts({
    query: hints[0],
    limit: 8,
  });
  const ranked = pickBestProductsByName(searched, hints[0], { limit: 1, minScore: 3 });
  return ranked[0] || null;
}

function productHasSizeHint(
  p: { sizes?: string[]; variants?: Array<{ size?: string }>; title?: string; tags?: string[] },
  size: string,
): boolean {
  const want = String(size).toLowerCase();
  if ((p.sizes || []).some((s) => s.toLowerCase().includes(want))) return true;
  if ((p.variants || []).some((v) => String(v.size || "").toLowerCase().includes(want))) return true;
  const hay = `${p.title || ""} ${(p.tags || []).join(" ")}`.toLowerCase();
  return hay.includes(want);
}

function productCards(
  products: Awaited<ReturnType<ReturnType<typeof getStoreAdapter>["searchProducts"]>>,
  reasons?: string[],
  search?: Record<string, unknown>,
): ToolResult {
  const publicHost = (env.storePublicDomain || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  return {
    ok: true,
    data: { products, search: search || null, count: products.length },
    ui: {
      contentType: "product_cards",
      products: products.map((p, i) => {
        let url = p.url;
        if (url && publicHost) {
          url = url.replace(
            /https?:\/\/[^/]*myshopify\.com/i,
            `https://${publicHost}`,
          );
          // Also rewrite if somehow still on admin shop domain
          if (env.shopifyShop && url.includes(env.shopifyShop) && publicHost !== env.shopifyShop) {
            url = url.replace(`https://${env.shopifyShop}`, `https://${publicHost}`);
          }
        }
        return {
          id: p.id,
          title: p.title,
          imageUrl: p.imageUrl,
          price: p.price,
          currency: p.currency === "USD" ? "$" : p.currency,
          url,
          available: p.available,
          reason: reasons?.[i],
          variants: p.variants?.map((v) => ({
            id: v.id,
            title: v.title,
            available: v.available,
          })),
        };
      }),
    },
  };
}

function orderCard(
  order: NonNullable<Awaited<ReturnType<ReturnType<typeof getStoreAdapter>["getOrder"]>>>,
  opts?: { includeUi?: boolean; conversation?: { state: { verifiedOrderSnapshot?: unknown; verifiedOrderId?: string | null } } },
): ToolResult {
  const includeUi = opts?.includeUi !== false;
  const outcome =
    order.cancellationStatus === "cancelled"
      ? "cancelled"
      : order.refundStatus === "refunded" || order.financialStatus === "refunded"
        ? "refunded"
        : null;

  let current: "placed" | "packed" | "shipped" | "delivered" = "placed";
  if (order.shipmentStatus === "delivered") current = "delivered";
  else if (order.shipmentStatus === "in_transit" || order.shipmentStatus === "shipped")
    current = "shipped";
  else if (order.fulfillmentStatus === "fulfilled" || order.fulfillmentStatus === "partial")
    current = "packed";

  if (opts?.conversation) {
    opts.conversation.state.verifiedOrderId = order.id;
    opts.conversation.state.verifiedOrderSnapshot = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      financialStatus: order.financialStatus,
      fulfillmentStatus: order.fulfillmentStatus,
      shipmentStatus: order.shipmentStatus,
      refundStatus: order.refundStatus,
      cancellationStatus: order.cancellationStatus,
      stepperCurrent: outcome ? undefined : current,
      trackingNumber: order.tracking?.number,
      trackingUrl: order.tracking?.url,
      cancelEligible: order.cancelEligible,
      addressChangeEligible: order.addressChangeEligible,
      returnEligible: order.returnEligible,
      updatedAt: new Date().toISOString(),
    };
  }

  return {
    ok: true,
    data: { order },
    ui: includeUi
      ? {
          contentType: "order_card",
          order: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            total: `${order.currency === "USD" ? "$" : order.currency}${order.total}`,
            currency: order.currency,
            financialStatus: order.financialStatus,
            fulfillmentStatus: order.fulfillmentStatus,
            shipmentStatus: order.shipmentStatus,
            refundStatus: order.refundStatus,
            cancellationStatus: order.cancellationStatus,
            badge: outcome || order.fulfillmentStatus || order.financialStatus,
            items: order.items.map((i) => ({ title: i.title, quantity: i.quantity })),
            tracking: order.tracking,
            stepper: outcome ? undefined : { current },
            outcome,
          },
        }
      : undefined,
  };
}

function requireVerifiedOrder(ctx: ToolContext, orderId?: string) {
  const raw = orderId && orderId !== "pending-verify" ? orderId : undefined;
  const id = raw || ctx.conversation.state.verifiedOrderId;
  if (!id) {
    return {
      ok: false as const,
      error: "Order must be verified first with findOrder (order number + email).",
      code: "ORDER_NOT_VERIFIED",
    };
  }
  return { ok: true as const, orderId: id };
}

export const toolDefinitions: AiToolSpec[] = [
  {
    name: "searchProducts",
    description: "Search the store catalog by query and optional filters.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
        productType: { type: "string" },
        size: { type: "string" },
        color: { type: "string" },
        style: { type: "string" },
        material: { type: "string" },
        budgetMax: { type: "number" },
        availableOnly: { type: "boolean" },
      },
    },
  },
  {
    name: "getProductDetails",
    description:
      "Get catalog facts for a product (colors, sizes, materials, price). Pass productId when known, or query/title with the product name from the customer message. Use for follow-ups like material/fabric/colors/sizes, and whenever the customer claims a color/size is missing — verify with checkColor/checkSize. Never invent missing fields or agree without checking.",
    parameters: {
      type: "object",
      properties: {
        productId: { type: "string" },
        query: {
          type: "string",
          description: "Product name or phrase from the customer message when id is unknown",
        },
        ask: {
          type: "string",
          enum: ["material", "colors", "sizes", "details"],
          description: "Which attribute the customer asked about",
        },
        checkColor: {
          type: "string",
          description: "Color the customer claims is missing or asks about (e.g. white)",
        },
        checkSize: {
          type: "string",
          description: "Size the customer claims is missing or asks about",
        },
      },
    },
  },
  {
    name: "checkProductAvailability",
    description:
      "Check if a product or variant is available. Pass productId or query/title with the product name.",
    parameters: {
      type: "object",
      properties: {
        productId: { type: "string" },
        query: { type: "string" },
        variantId: { type: "string" },
      },
    },
  },
  {
    name: "recommendProducts",
    description:
      "Recommend products from preferences. Call once enough preferences are known. For multiple colors (e.g. white or red), pass color as comma-separated values like white,red so either color can match.",
    parameters: {
      type: "object",
      properties: {
        productType: { type: "string" },
        size: { type: "string" },
        color: {
          type: "string",
          description: "One color or comma-separated colors for OR matching, e.g. white,red",
        },
        style: { type: "string" },
        material: { type: "string" },
        budgetMax: { type: "number" },
        occasion: { type: "string" },
        query: { type: "string" },
      },
    },
  },
  {
    name: "listCatalogOptions",
    description:
      "List real colors, sizes, or product types available in the store catalog. Use when the customer asks what colors/sizes/types you have — never invent them.",
    parameters: {
      type: "object",
      properties: {
        facet: { type: "string", enum: ["colors", "sizes", "types"] },
      },
    },
  },
  {
    name: "createCheckoutLink",
    description:
      "DEPRECATED — do not create checkout links. Tell the customer to use View More on a product card to open the storefront and check out there.",
    parameters: {
      type: "object",
      properties: {
        productId: { type: "string" },
        variantId: { type: "string" },
        quantity: { type: "number" },
        size: { type: "string" },
        color: { type: "string" },
        confirmed: { type: "boolean" },
      },
    },
  },
  {
    name: "findOrder",
    description: "Look up an order by order number and customer email (or phone).",
    parameters: {
      type: "object",
      properties: {
        orderNumber: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
      },
      required: ["orderNumber"],
    },
  },
  {
    name: "getOrderStatus",
    description: "Get verified order status fields for a previously found order.",
    parameters: {
      type: "object",
      properties: { orderId: { type: "string" } },
    },
  },
  {
    name: "getTrackingDetails",
    description: "Get shipment tracking for a verified order.",
    parameters: {
      type: "object",
      properties: { orderId: { type: "string" } },
    },
  },
  {
    name: "checkReturnEligibility",
    description:
      "Check whether a verified order is eligible for return under store policy (window, fulfillment, final-sale). Call before starting a return.",
    parameters: {
      type: "object",
      properties: { orderId: { type: "string" } },
    },
  },
  {
    name: "createReturnRequest",
    description:
      "Initiate a return for a verified, policy-eligible order. Collect a reason, confirm with the customer, then create the return. Do NOT use for refunds (refunds need a human agent).",
    parameters: {
      type: "object",
      properties: {
        orderId: { type: "string" },
        reason: { type: "string" },
        itemTitles: { type: "array", items: { type: "string" } },
        confirmed: { type: "boolean" },
      },
      required: ["reason"],
    },
  },
  {
    name: "checkRefundStatus",
    description:
      "Check whether a refund has been issued for a verified order (none / partial / fully refunded), including amounts when available. Use for “where’s my refund”, “was I refunded”, “refund status” — not to process a new refund.",
    parameters: {
      type: "object",
      properties: { orderId: { type: "string" } },
    },
  },
  {
    name: "requestRefund",
    description:
      "Handle refund requests. The bot cannot process refunds — use this to refuse and offer a human agent.",
    parameters: {
      type: "object",
      properties: {
        orderId: { type: "string" },
        amount: { type: "number" },
        reason: { type: "string" },
        confirmed: { type: "boolean" },
      },
    },
  },
  {
    name: "confirmRefundOtp",
    description: "Deprecated — chat refunds are disabled. Prefer requestRefund / human handoff.",
    parameters: {
      type: "object",
      properties: {
        code: { type: "string" },
      },
      required: ["code"],
    },
  },
  {
    name: "requestCancellation",
    description: "Cancel a verified eligible order after confirmation.",
    parameters: {
      type: "object",
      properties: {
        orderId: { type: "string" },
        reason: { type: "string" },
        confirmed: { type: "boolean" },
      },
    },
  },
  {
    name: "requestAddressChange",
    description: "Change shipping address on a verified eligible order after confirmation.",
    parameters: {
      type: "object",
      properties: {
        orderId: { type: "string" },
        line1: { type: "string" },
        line2: { type: "string" },
        city: { type: "string" },
        state: { type: "string" },
        zip: { type: "string" },
        country: { type: "string" },
        confirmed: { type: "boolean" },
      },
      required: ["line1", "city", "zip", "country"],
    },
  },
  {
    name: "reportDamagedItem",
    description: "Report damaged, incorrect, or missing items and create a support ticket.",
    parameters: {
      type: "object",
      properties: {
        orderId: { type: "string" },
        issueType: { type: "string", enum: ["damaged", "incorrect", "missing"] },
        description: { type: "string" },
        email: { type: "string" },
      },
      required: ["issueType", "description"],
    },
  },
  {
    name: "createSupportTicket",
    description: "Create a support ticket with customer contact details.",
    parameters: {
      type: "object",
      properties: {
        subject: { type: "string" },
        body: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
      },
      required: ["subject", "body"],
    },
  },
  {
    name: "requestHumanHandoff",
    description: "Request a human agent. Use only when appropriate.",
    parameters: {
      type: "object",
      properties: {
        reason: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
      },
      required: ["reason"],
    },
  },
  {
    name: "collectCustomerContact",
    description: "Save customer email and/or phone on the conversation.",
    parameters: {
      type: "object",
      properties: {
        email: { type: "string" },
        phone: { type: "string" },
      },
    },
  },
  {
    name: "subscribeBackInStock",
    description:
      "Collect customer contact and subscribe them to a back-in-stock / restock alert for a product. Use when they ask to be notified when an item is available again. Requires email (or phone) and a productId from a recent recommendation or search.",
    parameters: {
      type: "object",
      properties: {
        productId: { type: "string" },
        variantId: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        size: { type: "string" },
        color: { type: "string" },
      },
    },
  },
  {
    name: "getBusinessHours",
    description: "Get store support business hours and whether currently open.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "searchKnowledgeBase",
    description: "Search approved store policies and FAQs.",
    parameters: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  ...extraToolDefinitions,
];

const handlers: Record<string, ToolHandler> = {
  async searchProducts(args, ctx) {
    const store = getStoreAdapter(ctx.workspaceId);
    const search = {
      query: args.query as string | undefined,
      productType: args.productType as string | undefined,
      size: args.size as string | undefined,
      color: args.color as string | undefined,
      style: args.style as string | undefined,
      material: args.material as string | undefined,
      budgetMax: args.budgetMax as number | undefined,
    };
    const products = await store.searchProducts({
      ...search,
      availableOnly: (args.availableOnly as boolean | undefined) ?? true,
      limit: 8,
    });
    if (products[0] && ctx?.conversation) {
      ctx.conversation.state.slots.lastProductId = products[0].id;
      ctx.conversation.state.slots.lastRecommendedProductIds = products
        .map((p) => p.id)
        .join(",");
      ctx.conversation.state.slots.lastRecommendedProductTitles = products
        .map((p) => p.title)
        .join(" | ");
      await saveConversation(ctx.conversation);
    }
    return productCards(products, undefined, search);
  },

  async getProductDetails(args, ctx) {
    const product = await resolveProductFromArgs(args, ctx);
    if (!product) {
      return {
        ok: false,
        error: "Product not found.",
        code: "NOT_FOUND",
        data: {
          message:
            "I couldn’t match that to a catalog product. Share the exact product name or pick a card and I’ll check materials, colors, or sizes.",
        },
      };
    }
    if (ctx?.conversation) {
      ctx.conversation.state.slots.lastProductId = product.id;
      await saveConversation(ctx.conversation);
    }
    const colors = [
      ...new Set(
        [
          ...(product.colors || []),
          ...(product.variants || []).map((v) => v.color).filter(Boolean),
        ].map((c) => String(c)),
      ),
    ];
    const sizes = [
      ...new Set(
        [
          ...(product.sizes || []),
          ...(product.variants || []).map((v) => v.size).filter(Boolean),
        ].map((s) => String(s)),
      ),
    ];
    const materials = [
      ...new Set((product.materials || []).map((m) => String(m).trim()).filter(Boolean)),
    ];
    const ask = String(args.ask || "details").toLowerCase();
    const checkColor = args.checkColor ? String(args.checkColor).toLowerCase().trim() : "";
    const checkSize = args.checkSize ? String(args.checkSize).toLowerCase().trim() : "";

    const colorMatches = (want: string) => {
      const w = want.toLowerCase().replace(/[-_]/g, " ").trim();
      return colors.some((c) => {
        const x = String(c).toLowerCase().replace(/[-_]/g, " ").trim();
        return x === w || x.includes(w) || w.includes(x);
      });
    };
    const sizeMatches = (want: string) => {
      const w = want.toLowerCase().trim();
      return sizes.some((s) => String(s).toLowerCase().trim() === w);
    };

    let message: string;
    let claimCorrect: boolean | null = null;

    if (checkColor) {
      const has = colorMatches(checkColor);
      claimCorrect = has;
      if (has) {
        message = colors.length
          ? `Actually, ${product.title} is available in ${checkColor}. Catalog colors: ${colors.join(", ")}.`
          : `Actually, ${product.title} is listed with ${checkColor} available.`;
      } else if (colors.length) {
        message = `${product.title} isn’t listed in ${checkColor}. Available colors: ${colors.join(", ")}.`;
      } else {
        message = `${product.title} doesn’t list ${checkColor} (or separate color options) in the catalog.`;
      }
    } else if (checkSize) {
      const has = sizeMatches(checkSize);
      claimCorrect = has;
      if (has) {
        message = sizes.length
          ? `Actually, ${product.title} is available in size ${checkSize.toUpperCase()}. Catalog sizes: ${sizes.join(", ")}.`
          : `Actually, ${product.title} is listed in size ${checkSize.toUpperCase()}.`;
      } else if (sizes.length) {
        message = `${product.title} isn’t listed in size ${checkSize.toUpperCase()}. Available sizes: ${sizes.join(", ")}.`;
      } else {
        message = `${product.title} doesn’t list size ${checkSize.toUpperCase()} (or size options) in the catalog.`;
      }
    } else if (ask === "material") {
      message = materials.length
        ? `${product.title} is made of: ${materials.join(", ")}.`
        : `I don’t have material/fabric details listed for ${product.title} in our catalog — that info isn’t available for this item.`;
    } else if (ask === "colors") {
      message = colors.length
        ? `${product.title} is available in: ${colors.join(", ")}.`
        : `${product.title} doesn’t list separate color options in the catalog — what you see on the product is the available look.`;
    } else if (ask === "sizes") {
      message = sizes.length
        ? `${product.title} comes in sizes: ${sizes.join(", ")}.`
        : `${product.title} doesn’t list size options in the catalog.`;
    } else {
      const parts: string[] = [];
      if (colors.length) parts.push(`colors: ${colors.join(", ")}`);
      if (sizes.length) parts.push(`sizes: ${sizes.join(", ")}`);
      if (materials.length) parts.push(`material: ${materials.join(", ")}`);
      message = parts.length
        ? `Here’s what we have listed for ${product.title}: ${parts.join("; ")}.`
        : `I only have the basic listing for ${product.title} — material and other specs aren’t listed in the catalog.`;
    }
    const cards = productCards([product]);
    return {
      ok: true,
      data: {
        product: {
          id: product.id,
          title: product.title,
          price: product.price,
          currency: product.currency,
          available: product.available,
          colors,
          sizes,
          materials,
          url: product.url,
        },
        ask,
        checkColor: checkColor || undefined,
        checkSize: checkSize || undefined,
        claimCorrect,
        message,
      },
      ui: cards.ui,
    };
  },

  async checkProductAvailability(args, ctx) {
    const product = await resolveProductFromArgs(args, ctx);
    if (!product) {
      return {
        ok: false,
        error: "Product not found.",
        code: "NOT_FOUND",
        data: {
          message:
            "I couldn’t match that product name in the catalog. Double-check the name or pick it from a product card.",
        },
      };
    }
    if (ctx?.conversation) {
      ctx.conversation.state.slots.lastProductId = product.id;
      await saveConversation(ctx.conversation);
    }
    const store = getStoreAdapter(ctx.workspaceId);
    const result = await store.checkAvailability(
      product.id,
      args.variantId ? String(args.variantId) : undefined,
    );
    const available = Boolean(result.available);
    const cards = productCards([result.product || product]);
    return {
      ok: true,
      data: {
        ...result,
        product: result.product || product,
        available,
        message: available
          ? `${(result.product || product).title} is in stock right now.`
          : `${(result.product || product).title} isn’t available right now. I can notify you by email when it’s back in stock.`,
      },
      ui: available
        ? cards.ui
        : {
            contentType: "choices" as const,
            choices: [
              {
                id: "notify_restock",
                label: "Notify me when back",
                value: "Notify me when it's back in stock",
              },
              {
                id: "browse_similar",
                label: "Show similar options",
                value: "Show me similar products that are in stock",
              },
            ],
          },
    };
  },

  async recommendProducts(args, ctx) {
    const store = getStoreAdapter(ctx.workspaceId);
    const budgetRaw = args.budgetMax;
    const budgetMax =
      budgetRaw == null || budgetRaw === ""
        ? undefined
        : Number(String(budgetRaw).replace(/[$,\s]/g, "").replace(/k$/i, "000"));
    const colorRaw = args.color ? String(args.color) : undefined;
    const colorList = parseColorFilters(colorRaw);
    const color = colorList.length ? colorList.join(",") : undefined;
    const size = args.size ? String(args.size).toLowerCase() : undefined;
    // Strip structured filters that may have been stuffed into free-text query
    let query = (args.query as string) || undefined;
    if (query) {
      const colorSet = new Set(colorList);
      query = query
        .split(/\s+/)
        .filter((t) => {
          const low = t.toLowerCase();
          if (colorSet.has(low)) return false;
          if (size && low === size) return false;
          if (/^(or|and)$/i.test(low)) return false;
          return true;
        })
        .join(" ")
        .trim() || undefined;
    }
    const search = {
      query,
      productType: args.productType as string | undefined,
      size: args.size as string | undefined,
      color,
      style: args.style as string | undefined,
      material: args.material as string | undefined,
      budgetMax: Number.isFinite(budgetMax as number) ? budgetMax : undefined,
      occasion: args.occasion as string | undefined,
    };
    let products = await store.searchProducts({
      ...search,
      availableOnly: false,
      limit: 8,
    });
    // Hard guarantee: never return over-budget items
    if (search.budgetMax != null) {
      products = products.filter((p) => p.price <= search.budgetMax!);
    }
    if (products[0] && ctx?.conversation) {
      ctx.conversation.state.slots.lastProductId = products[0].id;
      ctx.conversation.state.slots.lastRecommendedProductIds = products
        .map((p) => p.id)
        .join(",");
      ctx.conversation.state.slots.lastRecommendedProductTitles = products
        .map((p) => p.title)
        .join(" | ");
      if (color) ctx.conversation.state.slots.color = color;
      const v =
        products[0].variants?.find((x) => x.available)?.id ||
        products[0].variants?.[0]?.id;
      if (v) ctx.conversation.state.slots.lastVariantId = v;
      await saveConversation(ctx.conversation);
    }
    const reasons = products.map((p) => {
      const bits = [];
      if (color && productMatchesAnyColor(p, color)) {
        const hit = colorList.find((c) =>
          (p.colors || []).some((pc) => pc.toLowerCase().includes(c)),
        );
        bits.push(hit ? `matches ${hit}` : "matches color");
      }
      if (args.size && productHasSizeHint(p, String(args.size))) bits.push("matches size");
      if (args.style && p.styles?.some((s) => s.includes(String(args.style).toLowerCase())))
        bits.push("matches style");
      if (search.budgetMax != null && p.price <= search.budgetMax) bits.push("within budget");
      if (p.available) bits.push("in stock");
      return bits.join(", ") || "popular pick from our collection";
    });
    return productCards(products, reasons, search);
  },

  async listCatalogOptions(args) {
    const store = getStoreAdapter(ctx.workspaceId);
    const products = await store.searchProducts({ limit: 50, availableOnly: false });
    const facet = String(args.facet || "colors").toLowerCase();
    const set = new Set<string>();
    for (const p of products) {
      if (facet === "sizes") {
        for (const s of p.sizes || []) if (s) set.add(String(s));
      } else if (facet === "types") {
        if (p.productType) set.add(p.productType);
      } else {
        for (const c of p.colors || []) if (c) set.add(String(c));
      }
    }
    const values = [...set].sort((a, b) => a.localeCompare(b));
    const label =
      facet === "sizes" ? "sizes" : facet === "types" ? "product types" : "colors";
    return {
      ok: true,
      data: {
        facet: label,
        values,
        count: values.length,
        message: values.length
          ? `From our current catalog, available ${label} include: ${values.join(", ")}.`
          : `I don’t see specific ${label} listed on products right now — tell me what you’re looking for and I’ll search.`,
      },
    };
  },

  async createCheckoutLink(_args, ctx) {
    ctx.conversation.state.pendingAction = null;
    await saveConversation(ctx.conversation);
    return {
      ok: true,
      data: {
        disabled: true,
          message:
          "I can’t create checkout links in chat. Use View More on a product card to open the product page and complete your purchase on the website.",
      },
    };
  },

  async findOrder(args, ctx) {
    const orderNumber = String(args.orderNumber || "").replace(/^#/, "");
    const email = (args.email as string) || ctx.conversation.visitorEmail || ctx.conversation.state.slots.email;
    const phone = (args.phone as string) || ctx.conversation.state.slots.phone;
    if (!email && !phone) {
      return {
        ok: false,
        error: "Email or phone is required to verify order ownership.",
        code: "IDENTITY_REQUIRED",
        ui: {
          contentType: "input_form",
          form: {
            formId: "order_lookup",
            title: "Verify your order",
            fields: [
              {
                name: "orderNumber",
                label: "Order number",
                required: true,
                placeholder: "e.g. 1001",
              },
              {
                name: "email",
                label: "Email on the order",
                type: "email",
                required: true,
              },
            ],
            submitLabel: "Look up order",
            actionId: "order_lookup",
          },
        },
      };
    }
    const store = getStoreAdapter(ctx.workspaceId);
    const order = await store.findOrder({ orderNumber, email, phone });
    if (!order) {
      return {
        ok: false,
        error: "No matching order found for that number and contact details.",
        code: "ORDER_NOT_FOUND",
      };
    }
    ctx.conversation.state.verifiedOrderId = order.id;
    ctx.conversation.state.slots.orderNumber = order.orderNumber;
    ctx.conversation.state.slots.orderId = order.id;
    if (email) {
      ctx.conversation.visitorEmail = email;
      ctx.conversation.state.slots.email = email;
    }
    const card = orderCard(order, {
      conversation: ctx.conversation,
      includeUi: args.includeUi !== false,
    });
    await saveConversation(ctx.conversation);
    return card;
  },

  async getOrderStatus(args, ctx) {
    const verified = requireVerifiedOrder(ctx, args.orderId as string | undefined);
    if (!verified.ok) return verified;
    const store = getStoreAdapter(ctx.workspaceId);
    const order = await store.getOrder(verified.orderId);
    if (!order) return { ok: false, error: "Order not found.", code: "NOT_FOUND" };
    const result = orderCard(order, {
      conversation: ctx.conversation,
      includeUi: args.includeUi !== false,
    });
    await saveConversation(ctx.conversation);
    return result;
  },

  async getTrackingDetails(args, ctx) {
    const verified = requireVerifiedOrder(ctx, args.orderId as string | undefined);
    if (!verified.ok) return verified;
    const store = getStoreAdapter(ctx.workspaceId);
    const order = await store.getOrder(verified.orderId);
    if (!order) return { ok: false, error: "Order not found.", code: "NOT_FOUND" };
    const card = orderCard(order, {
      conversation: ctx.conversation,
      includeUi: args.includeUi !== false,
    });
    await saveConversation(ctx.conversation);
    return {
      ...card,
      data: {
        tracking: order.tracking || null,
        shipmentStatus: order.shipmentStatus,
        fulfillmentStatus: order.fulfillmentStatus,
        cancellationStatus: order.cancellationStatus,
      },
    };
  },

  async checkReturnEligibility(args, ctx) {
    const verified = requireVerifiedOrder(ctx, args.orderId as string | undefined);
    if (!verified.ok) return verified;
    const store = getStoreAdapter(ctx.workspaceId);
    const order = await store.getOrder(verified.orderId);
    if (!order) return { ok: false, error: "Order not found.", code: "NOT_FOUND" };
    const eligibility = evaluateReturnEligibility({
      ...order,
      orderNumber: order.orderNumber,
    });
    if (ctx.conversation.state.verifiedOrderSnapshot) {
      ctx.conversation.state.verifiedOrderSnapshot.returnEligible = eligibility.eligible;
      await saveConversation(ctx.conversation);
    }
    return {
      ok: true,
      data: {
        eligible: eligibility.eligible,
        reason: eligibility.reason,
        policySummary: eligibility.policySummary,
        windowDays: eligibility.windowDays,
        daysSinceAnchor: eligibility.daysSinceAnchor,
        anchorLabel: eligibility.anchorLabel,
        orderNumber: order.orderNumber,
        fulfillmentStatus: order.fulfillmentStatus,
        shipmentStatus: order.shipmentStatus,
        refundStatus: order.refundStatus,
        // Prefer this exact copy — do not invent day counts or policy windows.
        message: eligibility.message,
      },
      ui: eligibility.eligible
        ? {
            contentType: "choices",
            choices: [
              { id: "start_return", label: "Start a return", value: "I want to start a return" },
              { id: "not_now", label: "Not now", value: "Not now" },
            ],
          }
        : {
            contentType: "choices",
            choices: [
              {
                id: "connect_agent_return",
                label: "Talk to an agent",
                value: "Please connect me with an agent about a return",
              },
              { id: "not_now", label: "Not now", value: "Not now" },
            ],
          },
    };
  },

  async createReturnRequest(args, ctx) {
    const verified = requireVerifiedOrder(ctx, args.orderId as string | undefined);
    if (!verified.ok) return verified;
    const store = getStoreAdapter(ctx.workspaceId);
    const order = await store.getOrder(verified.orderId);
    if (!order) return { ok: false, error: "Order not found.", code: "NOT_FOUND" };

    const eligibility = evaluateReturnEligibility({
      ...order,
      orderNumber: order.orderNumber,
    });
    if (!eligibility.eligible) {
      return {
        ok: false,
        error: eligibility.reason,
        code: "NOT_ELIGIBLE",
        data: {
          eligible: false,
          reason: eligibility.reason,
          policySummary: eligibility.policySummary,
          windowDays: eligibility.windowDays,
          message: eligibility.message,
        },
        requiresHuman: false,
      };
    }

    const reason = String(args.reason || "").trim();
    if (!reason) {
      return {
        ok: false,
        error: "A return reason is required.",
        code: "REASON_REQUIRED",
      };
    }

    if (!args.confirmed) {
      const token = randomUUID();
      ctx.conversation.state.pendingAction = {
        actionId: "create_return",
        tool: "createReturnRequest",
        args: { ...args, orderId: verified.orderId, reason, confirmed: true },
        confirmToken: token,
      };
      await saveConversation(ctx.conversation);
      return {
        ok: true,
        data: {
          needsConfirmation: true,
          eligible: true,
          message: `I can start a return for order #${order.orderNumber}. Please confirm below.`,
        },
        ui: {
          contentType: "input_form",
          form: {
            formId: randomUUID(),
            title: "Confirm return",
            summary: [
              `Order #${order.orderNumber}`,
              `Reason: ${reason}`,
              eligibility.policySummary,
            ],
            fields: [],
            submitLabel: "Yes, create the return",
            actionId: "create_return",
            confirmToken: token,
          },
        },
      };
    }

    const result = await store.createReturn(
      verified.orderId,
      reason,
      args.itemTitles as string[] | undefined,
    );
    ctx.conversation.state.pendingAction = null;

    if (result.ok) {
      ctx.conversation.state.slots.returnRequestId = result.returnId || "created";
      ctx.conversation.state.slots.returnReason = reason;
      ctx.conversation.state.activeFlow = null;
      ctx.conversation.state.flowStep = null;
      if (ctx.conversation.state.verifiedOrderSnapshot) {
        ctx.conversation.state.verifiedOrderSnapshot.returnEligible = false;
      }

      const email =
        ctx.conversation.visitorEmail ||
        ctx.conversation.state.slots.email ||
        order.email;
      try {
        const ticket = await createTicket({
          workspaceId: ctx.workspaceId,
          conversationId: ctx.conversation.id,
          email,
          phone: ctx.conversation.visitorPhone || ctx.conversation.state.slots.phone,
          subject: `Return ${result.returnId || ""} — order #${order.orderNumber}`.trim(),
          body: `Customer-initiated return via chat.\nOrder: #${order.orderNumber}\nReturn ID: ${result.returnId || "n/a"}\nReason: ${reason}\nItems: ${(args.itemTitles as string[] | undefined)?.join(", ") || order.items.map((i) => i.title).join(", ") || "n/a"}`,
        });
        (result as { ticketId?: string }).ticketId = ticket.id;
      } catch (err) {
        console.warn("[return] ticket create failed:", err);
      }
      // Do not send Agentra transactional email — Shopify handles customer return emails.
    }

    await saveConversation(ctx.conversation);
    return {
      ok: result.ok,
      data: {
        ...result,
        message: result.message,
        eligible: result.ok,
      },
      error: result.ok ? undefined : result.message,
      // Policy-ineligible or hard failures may need a human; soft store notes should not
      requiresHuman: !result.ok,
    };
  },

  async checkRefundStatus(args, ctx) {
    const verified = requireVerifiedOrder(ctx, args.orderId as string | undefined);
    if (!verified.ok) return verified;
    const store = getStoreAdapter(ctx.workspaceId);
    const details = await store.getRefundDetails(verified.orderId);
    if (!details) {
      return { ok: false, error: "Order not found.", code: "NOT_FOUND" };
    }
    const order = await store.getOrder(verified.orderId);
    if (ctx.conversation.state.verifiedOrderSnapshot) {
      ctx.conversation.state.verifiedOrderSnapshot.refundStatus = details.status;
      ctx.conversation.state.verifiedOrderSnapshot.financialStatus =
        details.financialStatus;
      await saveConversation(ctx.conversation);
    }
    return {
      ok: true,
      data: {
        ...details,
        refunded: details.status === "refunded" || details.status === "partial",
        fullyRefunded: details.status === "refunded",
      },
      ui: order ? orderCard(order).ui : undefined,
    };
  },

  async requestRefund(_args, ctx) {
    ctx.conversation.state.pendingAction = null;
    delete ctx.conversation.state.slots.refundOtpKey;
    await saveConversation(ctx.conversation);
    return {
      ok: true,
      data: {
        refundAllowed: false,
        message:
          "I'm not allowed to process refunds myself. I can connect you with a teammate who can help with that.",
      },
      ui: {
        contentType: "choices",
        choices: [
          {
            id: "connect_agent_refund",
            label: "Connect with an agent",
            value: "Connect with an agent",
          },
          { id: "decline_refund_agent", label: "No thanks", value: "No thanks" },
        ],
      },
    };
  },

  async confirmRefundOtp(_args, ctx) {
    ctx.conversation.state.pendingAction = null;
    delete ctx.conversation.state.slots.refundOtpKey;
    await saveConversation(ctx.conversation);
    return {
      ok: false,
      error:
        "I'm not allowed to process refunds myself. I can connect you with a teammate who can help.",
      code: "REFUND_NOT_ALLOWED",
      requiresHuman: true,
      ui: {
        contentType: "choices",
        choices: [
          {
            id: "connect_agent_refund",
            label: "Connect with an agent",
            value: "Connect with an agent",
          },
          { id: "decline_refund_agent", label: "No thanks", value: "No thanks" },
        ],
      },
    };
  },

  async requestCancellation(args, ctx) {
    const verified = requireVerifiedOrder(ctx, args.orderId as string | undefined);
    if (!verified.ok) return verified;
    if (!args.confirmed) {
      const token = randomUUID();
      ctx.conversation.state.pendingAction = {
        actionId: "cancel_order",
        tool: "requestCancellation",
        args: { ...args, orderId: verified.orderId, confirmed: true },
        confirmToken: token,
      };
      await saveConversation(ctx.conversation);
      return {
        ok: true,
        data: { needsConfirmation: true },
        ui: {
          contentType: "choices",
          choices: [
            { id: "confirm_cancel", label: "Yes, cancel my order", value: "Yes, cancel my order" },
            { id: "keep_order", label: "Keep my order", value: "Keep my order" },
          ],
          actionButtons: [
            { id: "confirm_cancel", label: "Confirm cancellation", value: "confirm" },
          ],
        },
      };
    }
    const store = getStoreAdapter(ctx.workspaceId);
    const result = await store.requestCancellation(
      verified.orderId,
      args.reason ? String(args.reason) : undefined,
    );
    ctx.conversation.state.pendingAction = null;

    // Ensure UI reflects cancelled even if commerce poll is slightly stale
    const orderForUi =
      result.ok && result.order
        ? {
            ...result.order,
            cancellationStatus: "cancelled" as const,
            cancelEligible: false,
            addressChangeEligible: false,
          }
        : result.order;

    if (result.ok) {
      ctx.conversation.state.activeFlow = null;
      ctx.conversation.state.flowStep = null;
      ctx.conversation.state.slots.lastCancelConfirmed = "1";
    }

    const card = orderForUi
      ? orderCard(orderForUi, { conversation: ctx.conversation, includeUi: true })
      : null;
    await saveConversation(ctx.conversation);

    return {
      ok: result.ok,
      data: {
        ...result,
        order: orderForUi,
        justCancelled: Boolean(result.ok),
        message:
          result.ok
            ? `I’ve now cancelled order #${orderForUi?.orderNumber || ""}. It won’t ship.`
            : result.message ||
              "I couldn’t cancel that order. Want me to connect you with an agent?",
      },
      error: result.ok ? undefined : result.message,
      requiresHuman: !result.ok,
      ui: card?.ui,
    };
  },

  async requestAddressChange(args, ctx) {
    const verified = requireVerifiedOrder(ctx, args.orderId as string | undefined);
    if (!verified.ok) return verified;

    const line1 = String(args.line1 || ctx.conversation.state.slots.addressLine1 || "").trim();
    const city = String(args.city || ctx.conversation.state.slots.city || "").trim();
    const zip = String(args.zip || ctx.conversation.state.slots.zip || "").trim();
    const country = String(args.country || ctx.conversation.state.slots.country || "").trim();
    const line2 = String(
      args.line2 || ctx.conversation.state.slots.addressLine2 || "",
    ).trim();
    const state = String(args.state || ctx.conversation.state.slots.state || "").trim();

    if (!line1 || !city || !zip || !country) {
      return {
        ok: true,
        data: { needsAddress: true },
        ui: {
          contentType: "input_form",
          form: {
            formId: "shipping_address",
            title: "New shipping address",
            fields: [
              {
                name: "name",
                label: "Full name",
                required: false,
                placeholder: "Name on the shipment",
              },
              {
                name: "address1",
                label: "Street address",
                required: true,
                placeholder: "Street and number",
              },
              {
                name: "address2",
                label: "Apartment, suite, etc.",
                required: false,
              },
              { name: "city", label: "City", required: true },
              { name: "province", label: "State / Province", required: false },
              { name: "zip", label: "Postal / ZIP code", required: true },
              {
                name: "country",
                label: "Country",
                required: true,
                placeholder: "e.g. PK, US, GB",
              },
              { name: "phone", label: "Phone", type: "tel", required: false },
            ],
            submitLabel: "Continue",
            actionId: "shipping_address",
          },
        },
      };
    }

    const address = {
      line1,
      line2: line2 || undefined,
      city,
      state: state || undefined,
      zip,
      country,
    };

    if (!args.confirmed) {
      const token = randomUUID();
      ctx.conversation.state.pendingAction = {
        actionId: "address_change",
        tool: "requestAddressChange",
        args: {
          orderId: verified.orderId,
          line1,
          line2,
          city,
          state,
          zip,
          country,
          confirmed: true,
        },
        confirmToken: token,
      };
      ctx.conversation.state.slots.addressLine1 = line1;
      ctx.conversation.state.slots.city = city;
      ctx.conversation.state.slots.zip = zip;
      ctx.conversation.state.slots.country = country;
      await saveConversation(ctx.conversation);
      return {
        ok: true,
        data: { needsConfirmation: true, address },
        ui: {
          contentType: "input_form",
          form: {
            formId: "address_confirm",
            title: "Confirm new shipping address",
            summary: [
              address.line1,
              [address.city, address.state, address.zip].filter(Boolean).join(", "),
              address.country,
            ],
            fields: [],
            submitLabel: "Update address",
            actionId: "action_confirm",
            confirmToken: token,
          },
        },
      };
    }

    const store = getStoreAdapter(ctx.workspaceId);
    const result = await store.requestAddressChange(verified.orderId, address);
    ctx.conversation.state.pendingAction = null;
    await saveConversation(ctx.conversation);
    return {
      ok: result.ok,
      data: result,
      error: result.ok ? undefined : result.message,
      requiresHuman: !result.ok,
      ui: result.order ? orderCard(result.order).ui : undefined,
    };
  },

  async reportDamagedItem(args, ctx) {
    const email =
      (args.email as string) ||
      ctx.conversation.visitorEmail ||
      ctx.conversation.state.slots.email;
    const ticket = await createTicket({
      workspaceId: ctx.workspaceId,
      conversationId: ctx.conversation.id,
      email,
      subject: `${String(args.issueType)} item report`,
      body: `Order: ${args.orderId || ctx.conversation.state.verifiedOrderId || "unknown"}\n${args.description}`,
    });
    const ref = ticket.id.slice(0, 8);
    const kind =
      args.issueType === "missing"
        ? "missing item"
        : args.issueType === "incorrect"
          ? "incorrect item"
          : "damaged item";
    ctx.conversation.state.slots.issueReportTicketId = ticket.id;
    ctx.conversation.state.slots.issueReportTicketRef = ref;
    ctx.conversation.state.activeFlow = null;
    ctx.conversation.state.flowStep = null;
    await saveConversation(ctx.conversation);
    return {
      ok: true,
      data: {
        ticketId: ticket.id,
        ticketRef: ref,
        message: `I’ve opened support ticket #${ref} for your ${kind} report. Our team will follow up at ${email || "your email on file"} shortly.`,
      },
      ui: {
        contentType: "system_event",
        systemEvent: {
          type: "ticket_created",
          text: `Support ticket ${ref} created`,
        },
      },
    };
  },

  async createSupportTicket(args, ctx) {
    const email =
      (args.email as string) ||
      ctx.conversation.visitorEmail ||
      ctx.conversation.state.slots.email;
    const phone = (args.phone as string) || ctx.conversation.state.slots.phone;
    if (!email && !phone) {
      return {
        ok: false,
        error: "Email or phone is required to create a ticket.",
        code: "CONTACT_REQUIRED",
        ui: {
          contentType: "input_form",
          form: {
            formId: randomUUID(),
            title: "How can we reach you?",
            fields: [
              { name: "email", label: "Email", type: "email", required: true },
              { name: "phone", label: "Phone", type: "tel", required: false },
            ],
            submitLabel: "Submit",
            actionId: "collect_contact",
          },
        },
      };
    }
    const ticket = await createTicket({
      workspaceId: ctx.workspaceId,
      conversationId: ctx.conversation.id,
      email,
      phone,
      subject: String(args.subject),
      body: String(args.body),
    });
    return {
      ok: true,
      data: { ticketId: ticket.id },
      ui: {
        contentType: "system_event",
        systemEvent: {
          type: "ticket_created",
          text: `Ticket ${ticket.id.slice(0, 8)} created`,
        },
      },
    };
  },

  async requestHumanHandoff(args, ctx) {
    // Build agent summary before connecting when missing
    if (!ctx.conversation.state.slots.handoffSummary) {
      const history = await getMessages(ctx.conversation.id);
      const recent = history.slice(-16);
      const lines = recent
        .map((m) => {
          const who =
            m.role === "customer" ? "Customer" : m.role === "agent" ? "Agent" : "Assistant";
          const body = String(m.body || "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 220);
          return body ? `${who}: ${body}` : null;
        })
        .filter(Boolean);
      const snap = ctx.conversation.state.verifiedOrderSnapshot;
      const slots = ctx.conversation.state.slots;
      const meta = [
        `Goal: ${ctx.conversation.state.goal}`,
        ctx.conversation.state.urgency ? `Urgency: ${ctx.conversation.state.urgency}` : null,
        ctx.conversation.state.language ? `Language: ${ctx.conversation.state.language}` : null,
        snap
          ? `Order #${snap.orderNumber} — pay ${snap.financialStatus}, fulfill ${snap.fulfillmentStatus}, ship ${snap.shipmentStatus}`
          : null,
        slots.email ? `Email: ${slots.email}` : null,
        args.reason ? `Handoff reason: ${args.reason}` : null,
      ]
        .filter(Boolean)
        .join("\n");
      ctx.conversation.state.slots.handoffSummary =
        `${meta}\n\nRecent chat:\n${lines.join("\n") || "(no messages)"}`.slice(0, 3500);
      await saveConversation(ctx.conversation);
    }

    const confirmed = Boolean(args.confirmed);
    const result = await requestHandoff({
      conversation: ctx.conversation,
      reason: String(args.reason || "Customer requested human support"),
      email: args.email as string | undefined,
      phone: args.phone as string | undefined,
      createTicketConfirmed: confirmed,
    });
    const unavailable =
      result.handoffState === "unavailable" ||
      result.handoffState === "outside_business_hours";
    const message = result.message;

    if (unavailable && result.needsTicketConfirm && !confirmed) {
      ctx.conversation.state.pendingAction = {
        actionId: "confirm_handoff_ticket",
        tool: "requestHumanHandoff",
        args: {
          reason: String(args.reason || "Customer requested human support"),
          email: args.email,
          phone: args.phone,
          confirmed: true,
        },
        confirmToken: randomUUID(),
      };
      await saveConversation(ctx.conversation);
      return {
        ok: true,
        data: { ...result, message },
        ui: {
          contentType: "choices",
          choices: [
            {
              id: "confirm_handoff_ticket",
              label: "Yes, create a ticket",
              value: "Yes, create a ticket",
            },
            {
              id: "decline_handoff_ticket",
              label: "No thanks",
              value: "No thanks",
            },
          ],
        },
      };
    }

    if (unavailable && result.ticketRef) {
      ctx.conversation.state.pendingAction = null;
      await saveConversation(ctx.conversation);
      return {
        ok: result.ok,
        data: { ...result, message },
        ui: {
          contentType: "choices",
          choices: [
            { id: "all_set", label: "All set, thanks", value: "All set, thanks" },
            {
              id: "still_need_help",
              label: "I still need help",
              value: "I still need help",
            },
          ],
        },
      };
    }

    if (unavailable) {
      return {
        ok: result.ok,
        data: { ...result, message },
      };
    }

    return {
      ok: result.ok,
      data: { ...result, message },
      ui: {
        contentType: "system_event",
        systemEvent: {
          type: "handoff_connecting",
          text: result.message,
        },
      },
    };
  },

  async collectCustomerContact(args, ctx) {
    if (args.email) {
      ctx.conversation.visitorEmail = String(args.email);
      ctx.conversation.state.slots.email = String(args.email);
    }
    if (args.phone) {
      ctx.conversation.visitorPhone = String(args.phone);
      ctx.conversation.state.slots.phone = String(args.phone);
    }
    await saveConversation(ctx.conversation);
    return {
      ok: true,
      data: {
        email: ctx.conversation.visitorEmail,
        phone: ctx.conversation.visitorPhone,
      },
    };
  },

  async subscribeBackInStock(args, ctx) {
    const store = getStoreAdapter(ctx.workspaceId);
    const slots = ctx.conversation.state.slots;
    const email =
      (args.email as string) ||
      ctx.conversation.visitorEmail ||
      slots.email;
    const phone =
      (args.phone as string) ||
      ctx.conversation.visitorPhone ||
      slots.phone;

    if (!email && !phone) {
      return {
        ok: false,
        error: "Email is required to send a back-in-stock alert.",
        code: "CONTACT_REQUIRED",
        data: {
          needsContact: true,
          message: "Share your email and I’ll notify you when this item is back in stock.",
        },
        ui: {
          contentType: "input_form",
          form: {
            formId: randomUUID(),
            title: "Get notified when it’s back",
            summary: ["We’ll email you when this item is available again."],
            fields: [
              {
                name: "email",
                label: "Email",
                type: "email",
                required: true,
                placeholder: "you@example.com",
              },
              {
                name: "phone",
                label: "Phone",
                type: "tel",
                required: false,
                placeholder: "Optional",
              },
              {
                name: "size",
                label: "Preferred size",
                required: false,
                placeholder: "e.g. M or 8",
              },
              {
                name: "color",
                label: "Preferred color",
                required: false,
                placeholder: "e.g. ivory",
              },
            ],
            submitLabel: "Notify me",
            actionId: "back_in_stock",
          },
        },
      };
    }

    let product = await resolveProductFromArgs(
      {
        productId: args.productId,
        query: args.query || args.productName || args.title,
        message: args.message,
      },
      ctx,
    );

    if (!product) {
      return {
        ok: false,
        error: "Which product should I watch for you?",
        code: "PRODUCT_REQUIRED",
        data: {
          message:
            "Tell me which product (or pick one from the cards) and I’ll set up a back-in-stock alert.",
        },
      };
    }

    slots.lastProductId = product.id;
    const productId = product.id;

    if (product.available) {
      return {
        ok: true,
        data: {
          alreadyAvailable: true,
          productId: product.id,
          productTitle: product.title,
          message: `Good news — ${product.title} is in stock right now, so you don’t need a waitlist. Use View More on the product card to open it on the website.`,
        },
        ui: productCards([product]).ui,
      };
    }

    if (email) {
      ctx.conversation.visitorEmail = email;
      slots.email = email;
    }
    if (phone) {
      ctx.conversation.visitorPhone = phone;
      slots.phone = phone;
    }
    if (args.size) slots.size = String(args.size);
    if (args.color) slots.color = String(args.color);
    slots.lastProductId = product.id;
    slots.backInStockAlertId = undefined;

    const size = (args.size as string) || slots.size;
    const color = (args.color as string) || slots.color;
    const variantId = (args.variantId as string) || slots.lastVariantId;

    // Avoid duplicate pending alerts for same email + product
    if (email) {
      const existing = await listCustomerAlerts(ctx.workspaceId, {
        productId: product.id,
        status: "pending",
        type: "back_in_stock",
      });
      const dup = existing.find(
        (a) => a.email.toLowerCase() === email.toLowerCase(),
      );
      if (dup) {
        slots.backInStockAlertId = dup.id;
        ctx.conversation.state.activeFlow = null;
        await saveConversation(ctx.conversation);
        return {
          ok: true,
          data: {
            alertId: dup.id,
            alreadySubscribed: true,
            productId: product.id,
            productTitle: product.title,
            email,
            message: `You’re already on the list for ${product.title}. I’ll email ${email} when it’s back in stock.`,
          },
        };
      }
    }

    const alert = await createCustomerAlert({
      workspaceId: ctx.workspaceId,
      conversationId: ctx.conversation.id,
      type: "back_in_stock",
      email: email || `phone:${phone}`,
      phone: phone || undefined,
      productId: product.id,
      productTitle: product.title,
      variantId: variantId || undefined,
      size: size || undefined,
      color: color || undefined,
    });

    slots.backInStockAlertId = alert.id;
    ctx.conversation.state.activeFlow = null;
    ctx.conversation.state.flowStep = null;

    try {
      await createTicket({
        workspaceId: ctx.workspaceId,
        conversationId: ctx.conversation.id,
        email: email || undefined,
        phone: phone || undefined,
        subject: `Back-in-stock alert — ${product.title}`,
        body: `Customer wants a restock notification.\nProduct: ${product.title} (${product.id})\nEmail: ${email || "n/a"}\nPhone: ${phone || "n/a"}\nSize: ${size || "n/a"}\nColor: ${color || "n/a"}\nAlert ID: ${alert.id}`,
      });
    } catch (err) {
      console.warn("[back-in-stock] ticket failed:", err);
    }

    if (email && email.includes("@")) {
      try {
        await sendEmail({
          to: email,
          subject: `We’ll notify you about ${product.title}`,
          text: `You’re on the list for ${product.title} at ${env.storeName}.${
            size ? `\nPreferred size: ${size}` : ""
          }${color ? `\nPreferred color: ${color}` : ""}\n\nWe’ll email you when it’s back in stock.\n\n— ${env.storeName}`,
        });
      } catch (err) {
        console.warn("[back-in-stock] confirm email failed:", err);
      }
    }

    await saveConversation(ctx.conversation);
    return {
      ok: true,
      data: {
        alertId: alert.id,
        productId: product.id,
        productTitle: product.title,
        email,
        phone,
        size,
        color,
        message: `You’re set — I’ll notify ${email || "you"} when ${product.title} is back in stock${
          size || color
            ? ` (${[size && `size ${size}`, color].filter(Boolean).join(", ")})`
            : ""
        }.`,
      },
    };
  },

  async getBusinessHours() {
    const status = getBusinessHoursStatus();
    return {
      ok: true,
      data: {
        ...status,
        agentsOnline: areAgentsOnline(),
        storeName: env.storeName,
      },
    };
  },

  async searchKnowledgeBase(args, ctx) {
    const docs = await searchKnowledgeBase(ctx.workspaceId, String(args.query));
    return {
      ok: true,
      data: { documents: docs },
    };
  },

  ...extraHandlers,
};

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const feature = featureForTool(name);
  if (feature) {
    const features = getWorkspaceConfig(ctx.workspaceId).features;
    if (!isFeatureEnabled(features, feature)) {
      return {
        ok: false,
        error: "This action isn’t available for this store right now.",
        code: "FEATURE_DISABLED",
        data: {
          feature,
          message:
            "That action isn’t enabled for this store. I can help another way, or connect you with an agent.",
        },
      };
    }
  }
  const handler = handlers[name];
  if (!handler) {
    return { ok: false, error: `Unknown tool: ${name}`, code: "UNKNOWN_TOOL" };
  }
  try {
    return await handler(args, ctx);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Tool execution failed",
      code: "TOOL_ERROR",
      requiresHuman: true,
    };
  }
}

export function listToolNames() {
  return Object.keys(handlers);
}
