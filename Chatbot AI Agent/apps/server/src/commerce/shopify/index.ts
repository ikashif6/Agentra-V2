import { env } from "../../config/env.js";
import { shopifyAdminFetch } from "./connection.js";
import { evaluateReturnEligibility } from "../returnPolicy.js";
import { buildRefundDetails } from "../refundStatus.js";
import { parseColorFilters, productMatchesAnyColor } from "../colorFilter.js";
import type {
  ProductSearchQuery,
  StoreAdapter,
  StoreOrder,
  StoreProduct,
} from "../types.js";

function storefrontHost(shop: string): string {
  return env.storePublicDomain || shop;
}

function optionIndex(options: any[] | undefined, names: string[]): number {
  const list = options || [];
  const idx = list.findIndex((o) =>
    names.some((n) => String(o?.name || "").toLowerCase().includes(n)),
  );
  return idx >= 0 ? idx : -1;
}

function variantOptionValue(v: any, index: number): string | undefined {
  if (index < 0) return undefined;
  const key = `option${index + 1}` as "option1" | "option2" | "option3";
  const val = v?.[key];
  return val != null && String(val).trim() && String(val) !== "Default Title"
    ? String(val).trim()
    : undefined;
}

function normalizeSizeValue(raw: string): string {
  const s = String(raw || "").trim().toLowerCase();
  if (s === "2xl") return "xxl";
  if (s === "3xl") return "xxxl";
  if (s === "4xl") return "xxxxl";
  return s;
}

function productMatchesSize(product: StoreProduct, size: string): boolean {
  const want = normalizeSizeValue(size);
  if (!want) return true;
  const fromSizes = (product.sizes || []).map(normalizeSizeValue);
  if (fromSizes.some((s) => s === want || s.includes(want) || want.includes(s))) {
    return true;
  }
  if (
    (product.variants || []).some((v) => {
      const vs = normalizeSizeValue(String(v.size || ""));
      return vs && (vs === want || vs.includes(want) || want.includes(vs));
    })
  ) {
    return true;
  }
  const hay = `${product.title} ${(product.tags || []).join(" ")}`.toLowerCase();
  return new RegExp(`\\b${want.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(hay);
}

function mapProduct(p: any, shop: string): StoreProduct {
  const sizeOpt = optionIndex(p.options, ["size"]);
  const colorOpt = optionIndex(p.options, ["color", "colour"]);
  const variants = (p.variants || []).map((v: any) => {
    const tracked = Boolean(v.inventory_management);
    const qty = Number(v.inventory_quantity ?? 0);
    const available = !tracked
      ? p.status === "active"
      : qty > 0 || v.inventory_policy === "continue";
    return {
      id: String(v.id),
      title: v.title,
      available,
      price: Number(v.price),
      size: variantOptionValue(v, sizeOpt),
      color: variantOptionValue(v, colorOpt),
    };
  });
  const sizes = [
    ...new Set(
      variants
        .map((v: { size?: string }) => v.size)
        .filter(Boolean)
        .map((s: string) => normalizeSizeValue(s)),
    ),
  ] as string[];
  const colors = [
    ...new Set(
      variants
        .map((v: { color?: string }) => v.color)
        .filter(Boolean)
        .map((c: string) => String(c).toLowerCase()),
    ),
  ] as string[];
  const description = (p.body_html || "").replace(/<[^>]+>/g, " ").trim();
  // Only labeled material/fabric lines — never invent from title/tags alone
  const materials: string[] = [];
  const materialMatch = description.match(
    /(?:^|\n|\.\s*)(?:material|fabric|composition)\s*[:\-]\s*([^\n.;]+)/i,
  );
  if (materialMatch?.[1]) {
    for (const part of materialMatch[1].split(/,|\/|&|\band\b/i)) {
      const t = part.trim();
      if (t && t.length < 60) materials.push(t);
    }
  }
  const available =
    p.status === "active" &&
    (variants.length === 0 ||
      variants.some((v: { available: boolean }) => v.available));
  const host = storefrontHost(shop);
  return {
    id: String(p.id),
    title: p.title,
    description,
    imageUrl: p.image?.src || p.images?.[0]?.src,
    price: Number(p.variants?.[0]?.price || 0),
    currency: "USD",
    url: p.handle ? `https://${host}/products/${p.handle}` : undefined,
    available,
    productType: p.product_type || undefined,
    tags:
      typeof p.tags === "string"
        ? p.tags.split(",").map((t: string) => t.trim())
        : [],
    sizes,
    colors,
    materials: materials.length ? materials : undefined,
    variants,
  };
}

function mapOrder(o: any): StoreOrder {
  const fulfillments = o.fulfillments || [];
  const tracking =
    fulfillments.find((f: any) => f.tracking_number) || fulfillments[0];
  const cancelled = Boolean(o.cancelled_at);
  const financial = String(o.financial_status || "unknown");
  const fulfillment = String(o.fulfillment_status || "unfulfilled");
  let shipmentStatus = "not_shipped";
  if (fulfillments.some((f: any) => f.shipment_status === "delivered"))
    shipmentStatus = "delivered";
  else if (fulfillments.some((f: any) => f.tracking_number))
    shipmentStatus = "in_transit";
  else if (fulfillment === "fulfilled") shipmentStatus = "shipped";

  const deliveredFulfillment = fulfillments.find(
    (f: any) => f.shipment_status === "delivered",
  );
  const deliveredAt =
    deliveredFulfillment?.updated_at ||
    deliveredFulfillment?.created_at ||
    null;
  const fulfilledAt =
    o.fulfilled_at ||
    fulfillments[0]?.created_at ||
    fulfillments[0]?.updated_at ||
    null;

  const items = (o.line_items || []).map((li: any) => ({
    title: li.title,
    quantity: li.quantity,
    sku: li.sku,
    productId: li.product_id ? String(li.product_id) : undefined,
    variantId: li.variant_id ? String(li.variant_id) : undefined,
    price: Number(li.price),
  }));

  const base = {
    id: String(o.id),
    orderNumber: String(o.order_number || o.name?.replace("#", "") || o.id),
    email: o.email || o.contact_email || "",
    phone: o.phone || o.billing_address?.phone || undefined,
    total: Number(o.total_price || 0),
    currency: o.currency || "USD",
    financialStatus: financial,
    fulfillmentStatus: fulfillment,
    shipmentStatus,
    refundStatus: financial.includes("partially_refunded")
      ? "partial"
      : financial.includes("refund")
        ? "refunded"
        : "none",
    cancellationStatus: cancelled ? "cancelled" : "none",
    createdAt: o.created_at,
    deliveredAt,
    fulfilledAt,
    items,
    shippingAddress: o.shipping_address
      ? {
          line1: o.shipping_address.address1 || "",
          line2: o.shipping_address.address2 || undefined,
          city: o.shipping_address.city || "",
          state: o.shipping_address.province || undefined,
          zip: o.shipping_address.zip || "",
          country:
            o.shipping_address.country_code ||
            o.shipping_address.country ||
            "",
        }
      : undefined,
    tracking: tracking
      ? {
          number: tracking.tracking_number,
          carrier: tracking.tracking_company,
          url: Array.isArray(tracking.tracking_urls)
            ? tracking.tracking_urls[0]
            : tracking.tracking_url,
        }
      : undefined,
    cancelEligible: !cancelled && fulfillment === "unfulfilled",
    addressChangeEligible: !cancelled && fulfillment === "unfulfilled",
  };

  const eligibility = evaluateReturnEligibility(base);
  return {
    ...base,
    returnEligible: eligibility.eligible,
  };
}

export function createShopifyAdapter(): StoreAdapter {
  const shop = env.shopifyShop;
  if (!shop) {
    throw new Error(
      "Shopify shop missing (SHOPIFY_STORE_DOMAIN or SHOPIFY_SHOP)",
    );
  }

  return {
    provider: "shopify",
    async searchProducts(q: ProductSearchQuery) {
      const limit = q.limit ?? 6;
      // Pull a page of products and filter locally — Shopify title= filter is too strict
      const data = await shopifyAdminFetch<{ products: any[] }>(
        `/products.json?${new URLSearchParams({ limit: "50", status: "active" })}`,
      );
      let list = (data.products || []).map((p) => mapProduct(p, shop));

      if (q.query) {
        const colorTerms = new Set(parseColorFilters(q.color));
        const sizeTerm = (q.size || "").toLowerCase();
        const terms = q.query
          .toLowerCase()
          .split(/\s+/)
          .filter((t) => t.length > 2)
          // Color/size are applied as structured filters — don't also require them in title text
          .filter((t) => !colorTerms.has(t) && t !== sizeTerm && t !== "or" && t !== "and");
        if (terms.length) {
          list = list.filter((p) => {
            const hay = `${p.title} ${p.description || ""} ${p.productType || ""} ${(p.tags || []).join(" ")} ${(p.colors || []).join(" ")} ${(p.sizes || []).join(" ")} ${(p.styles || []).join(" ")} ${(p.materials || []).join(" ")}`.toLowerCase();
            return terms.some((t) => hay.includes(t));
          });
        }
      }
      if (q.availableOnly) list = list.filter((p) => p.available);
      if (q.budgetMax != null) list = list.filter((p) => p.price <= q.budgetMax!);
      if (q.productType) {
        const pt = q.productType.toLowerCase();
        list = list.filter((p) => {
          const hay = `${p.productType || ""} ${p.title} ${(p.tags || []).join(" ")}`.toLowerCase();
          return hay.includes(pt) || (pt === "dress" && /gown|dress|bridal/i.test(hay));
        });
      }
      if (q.color) {
        list = list.filter((p) => productMatchesAnyColor(p, q.color));
      }
      if (q.size) {
        list = list.filter((p) => productMatchesSize(p, q.size!));
      }
      if (q.style) {
        const st = q.style.toLowerCase();
        list = list.filter((p) => {
          const hay = `${p.title} ${p.description || ""} ${(p.tags || []).join(" ")} ${(p.styles || []).join(" ")}`.toLowerCase();
          return hay.includes(st);
        });
      }
      if (q.material) {
        const mat = q.material.toLowerCase();
        list = list.filter((p) => {
          const hay = `${p.title} ${p.description || ""} ${(p.tags || []).join(" ")} ${(p.materials || []).join(" ")}`.toLowerCase();
          return hay.includes(mat);
        });
      }
      if (q.occasion) {
        const occ = q.occasion.toLowerCase();
        list = list.filter((p) => {
          const hay = `${p.title} ${p.description || ""} ${(p.tags || []).join(" ")}`.toLowerCase();
          return hay.includes(occ) || /wedding|bridal|gown|dress/i.test(hay);
        });
      }
      return list.slice(0, limit);
    },
    async getProduct(id) {
      const data = await shopifyAdminFetch<{ product: any }>(
        `/products/${id}.json`,
      );
      return data.product ? mapProduct(data.product, shop) : null;
    },
    async checkAvailability(productId, variantId) {
      const product = await this.getProduct(productId);
      if (!product) return { available: false, product: null };
      if (variantId) {
        const v = product.variants?.find((x) => x.id === variantId);
        return { available: Boolean(v?.available), product };
      }
      return { available: product.available, product };
    },
    async findOrder({ orderNumber, email, phone }) {
      if (!email && !phone) return null;
      const num = String(orderNumber || "").replace(/^#/, "").trim();
      if (!num) return null;

      // Prefer email-scoped list, then match order number / name
      if (email) {
        const byEmail = await shopifyAdminFetch<{ orders: any[] }>(
          `/orders.json?${new URLSearchParams({
            email,
            status: "any",
            limit: "50",
          })}`,
        );
        const match = (byEmail.orders || []).find(
          (o) =>
            String(o.order_number) === num ||
            String(o.name || "").replace(/^#/, "") === num,
        );
        if (match) return mapOrder(match);
      }

      // Fallback: name search (Shopify order name, e.g. #1001)
      const byName = await shopifyAdminFetch<{ orders: any[] }>(
        `/orders.json?${new URLSearchParams({
          name: num,
          status: "any",
          limit: "10",
        })}`,
      );
      const match =
        (byName.orders || []).find(
          (o) =>
            String(o.order_number) === num ||
            String(o.name || "").replace(/^#/, "") === num,
        ) || (byName.orders || [])[0];
      if (!match) return null;
      const order = mapOrder(match);
      if (email && order.email.toLowerCase() !== email.toLowerCase()) return null;
      return order;
    },
    async getOrder(orderId) {
      const data = await shopifyAdminFetch<{ order: any }>(
        `/orders/${orderId}.json`,
      );
      return data.order ? mapOrder(data.order) : null;
    },
    async requestCancellation(orderId, reason) {
      if (!env.shopifyAllowWrites) {
        return {
          ok: false,
          message:
            "Cancellation requires write access. An agent can complete this for you.",
        };
      }
      const order = await this.getOrder(orderId);
      if (!order) return { ok: false, message: "Order not found." };
      if (!order.cancelEligible) {
        return { ok: false, message: "This order can no longer be cancelled." };
      }
      await shopifyAdminFetch(`/orders/${orderId}/cancel.json`, {
        method: "POST",
        body: JSON.stringify({ reason: reason || "customer", email: true }),
      });
      const updated = await this.getOrder(orderId);
      return {
        ok: true,
        message: `Order #${order.orderNumber} cancellation submitted.`,
        order: updated || undefined,
      };
    },
    async requestAddressChange(orderId, address) {
      if (!env.shopifyAllowWrites) {
        return {
          ok: false,
          message:
            "Address changes require write access. An agent can update this for you.",
        };
      }
      const order = await this.getOrder(orderId);
      if (!order) return { ok: false, message: "Order not found." };
      if (!order.addressChangeEligible) {
        return {
          ok: false,
          message: "Shipping address can no longer be changed.",
        };
      }
      await shopifyAdminFetch(`/orders/${orderId}.json`, {
        method: "PUT",
        body: JSON.stringify({
          order: {
            id: orderId,
            shipping_address: {
              address1: address.line1,
              address2: address.line2,
              city: address.city,
              province: address.state,
              zip: address.zip,
              country: address.country,
            },
          },
        }),
      });
      const updated = await this.getOrder(orderId);
      return {
        ok: true,
        message: `Address update submitted for order #${order.orderNumber}.`,
        order: updated || undefined,
      };
    },
    async createReturn(orderId, reason, itemTitles) {
      const order = await this.getOrder(orderId);
      if (!order) return { ok: false, message: "Order not found." };
      const eligibility = evaluateReturnEligibility({
        ...order,
        orderNumber: order.orderNumber,
      });
      if (!eligibility.eligible) {
        return { ok: false, message: eligibility.message || eligibility.reason };
      }

      const returnId = `RET-${order.orderNumber}-${Date.now().toString(36).toUpperCase()}`;
      const itemLine = itemTitles?.length
        ? ` Items: ${itemTitles.join(", ")}.`
        : order.items?.length
          ? ` Items: ${order.items.map((i) => i.title).join(", ")}.`
          : "";
      const noteLine = `[Chat return ${returnId}] ${reason}.${itemLine}`.trim();

      if (env.shopifyAllowWrites) {
        try {
          const data = await shopifyAdminFetch<{ order: { note?: string } }>(
            `/orders/${orderId}.json`,
          );
          const prev = String(data.order?.note || "").trim();
          await shopifyAdminFetch(`/orders/${orderId}.json`, {
            method: "PUT",
            body: JSON.stringify({
              order: {
                id: orderId,
                note: prev ? `${prev}\n\n${noteLine}` : noteLine,
              },
            }),
          });
        } catch (err) {
          console.warn("[shopify] failed to append return note:", err);
        }
      }

      return {
        ok: true,
        message: `Return ${returnId} started for order #${order.orderNumber}. Reason: ${reason}.${itemLine} You’ll get next steps from the store by email for shipping it back. Refunds (if any) are processed after we receive the return — that part still goes through the original payment method within 5–10 business days.`,
        returnId,
      };
    },
    async createCheckoutLink(input) {
      const qty = Math.max(1, Math.min(20, Number(input.quantity) || 1));
      let product =
        input.productId != null ? await this.getProduct(String(input.productId)) : null;
      let variantId = input.variantId ? String(input.variantId) : undefined;

      if (!variantId && product) {
        const sizeWant = (input.size || "").toLowerCase();
        const colorWant = (input.color || "").toLowerCase();
        const variants = product.variants || [];
        const match =
          variants.find((v) => {
            if (!v.available) return false;
            const sizeOk =
              !sizeWant ||
              String(v.size || "")
                .toLowerCase()
                .includes(sizeWant) ||
              String(v.title || "")
                .toLowerCase()
                .includes(sizeWant);
            const colorOk =
              !colorWant ||
              String(v.color || "")
                .toLowerCase()
                .includes(colorWant) ||
              String(v.title || "")
                .toLowerCase()
                .includes(colorWant);
            return sizeOk && colorOk;
          }) || variants.find((v) => v.available) || variants[0];
        variantId = match?.id;
      }

      if (!variantId && !product && input.productId) {
        return { ok: false, message: "That product wasn’t found." };
      }
      if (!variantId) {
        return {
          ok: false,
          message:
            "I need a specific product (and size if it has variants) before I can build a checkout link.",
        };
      }

      const host = storefrontHost(shop);
      const url = `https://${host}/cart/${variantId}:${qty}`;
      return {
        ok: true,
        url,
        productTitle: product?.title,
        message: product?.title
          ? `Checkout link ready for ${product.title}.`
          : "Checkout link ready.",
      };
    },
    async initiateRefund({ orderId, amount, reason }) {
      if (!env.shopifyAllowWrites) {
        return {
          ok: false,
          message:
            "Refunds require write access. I can create a ticket so the team can process this.",
        };
      }
      const order = await this.getOrder(orderId);
      if (!order) return { ok: false, message: "Order not found." };
      if (/refunded/i.test(order.refundStatus) || /refunded/i.test(order.financialStatus)) {
        return { ok: false, message: `Order #${order.orderNumber} is already refunded.` };
      }
      const capped = Math.min(
        Number(amount),
        Number(order.total),
        env.refundMaxAmount,
      );
      if (!(capped > 0)) {
        return { ok: false, message: "Refund amount must be greater than zero." };
      }

      const txData = await shopifyAdminFetch<{ transactions: any[] }>(
        `/orders/${orderId}/transactions.json`,
      );
      const parent = (txData.transactions || [])
        .filter((t) => t.kind === "sale" || t.kind === "capture")
        .filter((t) => t.status === "success" || t.status === "pending" || !t.status)
        .sort((a, b) => Number(b.id) - Number(a.id))[0];

      if (!parent?.id) {
        return {
          ok: false,
          message:
            "I couldn’t find a payment transaction to refund on this order. A teammate may need to help.",
        };
      }

      const refundBody = {
        refund: {
          currency: order.currency || "USD",
          notify: true,
          note: reason || "Customer requested refund via chat",
          transactions: [
            {
              parent_id: parent.id,
              amount: capped.toFixed(2),
              kind: "refund",
              gateway: parent.gateway || "manual",
            },
          ],
        },
      };

      const created = await shopifyAdminFetch<{ refund: { id?: number } }>(
        `/orders/${orderId}/refunds.json`,
        { method: "POST", body: JSON.stringify(refundBody) },
      );

      return {
        ok: true,
        amount: capped,
        refundId: created.refund?.id != null ? String(created.refund.id) : undefined,
        message: `Refund of $${capped.toFixed(2)} submitted for order #${order.orderNumber}.`,
      };
    },
    async getRefundDetails(orderId) {
      const order = await this.getOrder(orderId);
      if (!order) return null;
      let refundLines: Array<{
        id: string;
        amount: number;
        createdAt?: string;
        note?: string;
      }> = [];
      try {
        const data = await shopifyAdminFetch<{ refunds: any[] }>(
          `/orders/${orderId}/refunds.json`,
        );
        refundLines = (data.refunds || []).map((r: any) => {
          const txs = Array.isArray(r.transactions) ? r.transactions : [];
          const amount = txs
            .filter(
              (t: any) =>
                String(t.kind || "").toLowerCase() === "refund" &&
                String(t.status || "success").toLowerCase() !== "failure",
            )
            .reduce((s: number, t: any) => s + Number(t.amount || 0), 0);
          const fallback = Number(r.transactions?.[0]?.amount || 0);
          return {
            id: String(r.id),
            amount: amount > 0 ? amount : fallback,
            createdAt: r.created_at || undefined,
            note: r.note || undefined,
          };
        });
      } catch (err) {
        console.warn("[shopify] refunds fetch failed:", err);
      }

      const details = buildRefundDetails({
        orderNumber: order.orderNumber,
        orderTotal: order.total,
        currency: order.currency,
        financialStatus: order.financialStatus,
        refundStatus: order.refundStatus,
        refunds: refundLines,
      });

      // Keep order snapshot in sync when we have live refund lines
      if (details.status === "refunded") order.refundStatus = "refunded";
      else if (details.status === "partial") order.refundStatus = "partial";

      return details;
    },
  };
}
