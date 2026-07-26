import { env } from "../../config/env.js";
import { evaluateReturnEligibility } from "../returnPolicy.js";
import { buildRefundDetails } from "../refundStatus.js";
import { parseColorFilters, productMatchesAnyColor } from "../colorFilter.js";
import type {
  ProductSearchQuery,
  StoreAdapter,
  StoreOrder,
  StoreProduct,
} from "../types.js";

const products: StoreProduct[] = [
  {
    id: "p-1001",
    title: "Emilia Lace Wedding Dress",
    description: "Fitted lace gown with soft A-line skirt. Ideal for garden ceremonies.",
    imageUrl: "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=400",
    price: 890,
    currency: "USD",
    url: "https://example.com/products/emilia-lace",
    available: true,
    productType: "dress",
    tags: ["wedding", "lace", "bridal"],
    colors: ["ivory", "white"],
    sizes: ["0", "2", "4", "6", "8", "10"],
    materials: ["lace", "satin"],
    styles: ["fitted", "a-line"],
    variants: [
      { id: "v-1001-4", title: "Ivory / 4", available: true, price: 890, size: "4", color: "ivory" },
      { id: "v-1001-6", title: "Ivory / 6", available: true, price: 890, size: "6", color: "ivory" },
      { id: "v-1001-8", title: "Ivory / 8", available: false, price: 890, size: "8", color: "ivory" },
    ],
  },
  {
    id: "p-1002",
    title: "Sofia Satin Ballgown",
    description: "Classic ballgown with structured bodice and full skirt.",
    imageUrl: "https://images.unsplash.com/photo-1594552072238-5f08a8d2e5c8?w=400",
    price: 1250,
    currency: "USD",
    url: "https://example.com/products/sofia-satin",
    available: true,
    productType: "dress",
    tags: ["wedding", "ballgown", "satin"],
    colors: ["white", "champagne"],
    sizes: ["2", "4", "6", "8", "10", "12"],
    materials: ["satin"],
    styles: ["ballgown"],
    variants: [
      { id: "v-1002-6", title: "White / 6", available: true, price: 1250, size: "6", color: "white" },
      { id: "v-1002-8", title: "White / 8", available: true, price: 1250, size: "8", color: "white" },
    ],
  },
  {
    id: "p-1003",
    title: "Pearl Hair Vine",
    description: "Delicate pearl and crystal hair vine for bridal styling.",
    imageUrl: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=400",
    price: 68,
    currency: "USD",
    url: "https://example.com/products/pearl-hair-vine",
    available: true,
    productType: "accessory",
    tags: ["accessory", "hair", "pearl"],
    colors: ["pearl"],
    materials: ["pearl", "crystal"],
    styles: ["romantic"],
    variants: [
      { id: "v-1003-1", title: "Default", available: true, price: 68 },
    ],
  },
  {
    id: "p-1004",
    title: "Luna Veil — Cathedral Length",
    description: "Soft tulle cathedral veil with raw edge.",
    imageUrl: "https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=400",
    price: 145,
    currency: "USD",
    url: "https://example.com/products/luna-veil",
    available: true,
    productType: "veil",
    tags: ["veil", "cathedral"],
    colors: ["ivory", "white"],
    materials: ["tulle"],
    styles: ["classic"],
    variants: [
      { id: "v-1004-w", title: "White", available: true, price: 145, color: "white" },
      { id: "v-1004-i", title: "Ivory", available: true, price: 145, color: "ivory" },
    ],
  },
  {
    id: "p-1005",
    title: "Maya Crepe Sheath Dress",
    description: "Minimal crepe sheath for modern ceremonies and receptions.",
    imageUrl: "https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=400",
    price: 720,
    currency: "USD",
    url: "https://example.com/products/maya-crepe",
    available: false,
    productType: "dress",
    tags: ["wedding", "modern", "crepe"],
    colors: ["ivory"],
    sizes: ["0", "2", "4", "6", "8"],
    materials: ["crepe"],
    styles: ["sheath", "minimal"],
    variants: [
      { id: "v-1005-4", title: "Ivory / 4", available: false, price: 720, size: "4", color: "ivory" },
    ],
  },
  {
    id: "p-1006",
    title: "Scarlet Satin Ribbon Sash",
    description: "Bold red satin sash to accent bridal gowns and formal dresses.",
    imageUrl: "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=400",
    price: 45,
    currency: "USD",
    url: "https://example.com/products/scarlet-sash",
    available: true,
    productType: "accessory",
    tags: ["wedding", "sash", "red"],
    colors: ["red"],
    sizes: ["one size"],
    materials: ["satin"],
    styles: ["classic"],
    variants: [
      { id: "v-1006-r", title: "Red", available: true, price: 45, color: "red" },
    ],
  },
];

const orders: StoreOrder[] = [
  {
    id: "o-1001",
    orderNumber: "1001",
    email: "jane@example.com",
    phone: "+15551234567",
    total: 958,
    currency: "USD",
    financialStatus: "paid",
    fulfillmentStatus: "fulfilled",
    shipmentStatus: "in_transit",
    refundStatus: "none",
    cancellationStatus: "none",
    createdAt: "2026-07-10T14:22:00.000Z",
    fulfilledAt: "2026-07-12T10:00:00.000Z",
    items: [
      { title: "Emilia Lace Wedding Dress", quantity: 1, productId: "p-1001", price: 890 },
      { title: "Pearl Hair Vine", quantity: 1, productId: "p-1003", price: 68 },
    ],
    shippingAddress: {
      line1: "12 Rose Lane",
      city: "Brooklyn",
      state: "NY",
      zip: "11201",
      country: "US",
    },
    tracking: {
      number: "1Z999AA10123456784",
      carrier: "UPS",
      url: "https://www.ups.com/track?tracknum=1Z999AA10123456784",
      estimate: "2026-07-24",
    },
    returnEligible: true,
    cancelEligible: false,
    addressChangeEligible: false,
  },
  {
    id: "o-1002",
    orderNumber: "1002",
    email: "sam@example.com",
    total: 1250,
    currency: "USD",
    financialStatus: "paid",
    fulfillmentStatus: "unfulfilled",
    shipmentStatus: "not_shipped",
    refundStatus: "none",
    cancellationStatus: "none",
    createdAt: "2026-07-18T09:10:00.000Z",
    items: [
      { title: "Sofia Satin Ballgown", quantity: 1, productId: "p-1002", price: 1250 },
    ],
    shippingAddress: {
      line1: "88 Oak Street",
      city: "Austin",
      state: "TX",
      zip: "78701",
      country: "US",
    },
    returnEligible: false,
    cancelEligible: true,
    addressChangeEligible: true,
  },
  {
    id: "o-1003",
    orderNumber: "1003",
    email: "alex@example.com",
    total: 145,
    currency: "USD",
    financialStatus: "refunded",
    fulfillmentStatus: "fulfilled",
    shipmentStatus: "delivered",
    refundStatus: "refunded",
    cancellationStatus: "none",
    createdAt: "2026-06-01T11:00:00.000Z",
    items: [{ title: "Luna Veil — Cathedral Length", quantity: 1, productId: "p-1004", price: 145 }],
    returnEligible: false,
    cancelEligible: false,
    addressChangeEligible: false,
  },
];

function matches(product: StoreProduct, q: ProductSearchQuery): boolean {
  const hay = [
    product.title,
    product.description,
    product.productType,
    ...(product.tags || []),
    ...(product.colors || []),
    ...(product.materials || []),
    ...(product.styles || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (q.query) {
    const stop = new Set([
      "a", "an", "the", "for", "and", "or", "with", "under", "over", "please",
      "recommend", "recommendations", "suggest", "show", "me", "find", "looking",
      "want", "need", "something", "products", "product",
    ]);
    const colorTerms = new Set(parseColorFilters(q.color));
    const sizeTerm = (q.size || "").toLowerCase();
    const terms = q.query
      .toLowerCase()
      .replace(/\$\d+/g, " ")
      .split(/\s+/)
      .filter((t) => t && !stop.has(t) && t.length > 1)
      .filter((t) => !colorTerms.has(t) && t !== sizeTerm);
    if (terms.length && !terms.some((t) => hay.includes(t))) return false;
  }
  if (q.productType && product.productType !== q.productType) return false;
  if (q.color && !productMatchesAnyColor(product, q.color)) return false;
  if (q.size && !(product.sizes || []).some((s) => String(s).toLowerCase() === String(q.size).toLowerCase()) && !(product.variants || []).some((v) => String(v.size || "").toLowerCase() === String(q.size).toLowerCase()))
    return false;
  if (q.style && !(product.styles || []).some((s) => s.toLowerCase().includes(q.style!.toLowerCase())))
    return false;
  if (q.material && !(product.materials || []).some((m) => m.toLowerCase().includes(q.material!.toLowerCase())))
    return false;
  if (q.budgetMax != null && product.price > q.budgetMax) return false;
  if (q.occasion && !hay.includes(q.occasion.toLowerCase()) && !hay.includes("wedding")) {
    // soft filter: keep bridal inventory for bridal occasions
  }
  if (q.availableOnly && !product.available) return false;
  return true;
}

export function createCustomAdapter(): StoreAdapter {
  return {
    provider: "custom",
    async searchProducts(q) {
      const limit = q.limit ?? 6;
      return products.filter((p) => matches(p, q)).slice(0, limit);
    },
    async getProduct(id) {
      return products.find((p) => p.id === id) || null;
    },
    async checkAvailability(productId, variantId) {
      const product = products.find((p) => p.id === productId) || null;
      if (!product) return { available: false, product: null };
      if (variantId) {
        const v = product.variants?.find((x) => x.id === variantId);
        return { available: Boolean(v?.available), product };
      }
      return { available: product.available, product };
    },
    async findOrder({ orderNumber, email, phone }) {
      const order = orders.find(
        (o) =>
          o.orderNumber.replace(/^#/, "") === orderNumber.replace(/^#/, ""),
      );
      if (!order) return null;
      if (email && order.email.toLowerCase() !== email.toLowerCase()) return null;
      if (phone && order.phone && normalizePhone(order.phone) !== normalizePhone(phone))
        return null;
      if (!email && !phone) {
        // Unverified lookup returns null for privacy — require identity
        return null;
      }
      return structuredClone(order);
    },
    async getOrder(orderId) {
      const order = orders.find((o) => o.id === orderId);
      return order ? structuredClone(order) : null;
    },
    async requestCancellation(orderId, reason) {
      const order = orders.find((o) => o.id === orderId);
      if (!order) return { ok: false, message: "Order not found." };
      if (!order.cancelEligible) {
        return { ok: false, message: "This order can no longer be cancelled." };
      }
      order.cancellationStatus = "cancelled";
      order.financialStatus = "refunded";
      order.refundStatus = "refunded";
      order.cancelEligible = false;
      order.addressChangeEligible = false;
      return {
        ok: true,
        message: `Order #${order.orderNumber} cancelled${reason ? ` (${reason})` : ""}.`,
        order: structuredClone(order),
      };
    },
    async requestAddressChange(orderId, address) {
      const order = orders.find((o) => o.id === orderId);
      if (!order) return { ok: false, message: "Order not found." };
      if (!order.addressChangeEligible) {
        return { ok: false, message: "Shipping address can no longer be changed for this order." };
      }
      order.shippingAddress = address;
      order.addressChangeEligible = false;
      return {
        ok: true,
        message: `Address updated for order #${order.orderNumber}.`,
        order: structuredClone(order),
      };
    },
    async createReturn(orderId, reason, itemTitles) {
      const order = orders.find((o) => o.id === orderId);
      if (!order) return { ok: false, message: "Order not found." };
      const eligibility = evaluateReturnEligibility({
        ...order,
        orderNumber: order.orderNumber,
      });
      if (!eligibility.eligible) {
        return { ok: false, message: eligibility.message || eligibility.reason };
      }
      const returnId = `ret-${Date.now()}`;
      order.returnEligible = false;
      return {
        ok: true,
        message: `Return ${returnId} created for order #${order.orderNumber}. Reason: ${reason}.${itemTitles?.length ? ` Items: ${itemTitles.join(", ")}.` : ""} You’ll get next steps from the store by email for shipping it back.`,
        returnId,
      };
    },
    async createCheckoutLink(input) {
      const qty = Math.max(1, Math.min(20, Number(input.quantity) || 1));
      const product = input.productId
        ? products.find((p) => p.id === String(input.productId))
        : products[0];
      if (!product) return { ok: false, message: "Product not found." };
      const sizeWant = (input.size || "").toLowerCase();
      const variant =
        (input.variantId &&
          product.variants?.find((v) => v.id === String(input.variantId))) ||
        product.variants?.find(
          (v) =>
            v.available &&
            (!sizeWant || String(v.size || "").toLowerCase() === sizeWant),
        ) ||
        product.variants?.find((v) => v.available) ||
        product.variants?.[0];
      if (!variant) return { ok: false, message: "No variant available for checkout." };
      return {
        ok: true,
        url: `https://example.store/cart/${variant.id}:${qty}`,
        productTitle: product.title,
        message: `Checkout link ready for ${product.title}.`,
      };
    },
    async initiateRefund({ orderId, amount, reason }) {
      const order = orders.find((o) => o.id === orderId);
      if (!order) return { ok: false, message: "Order not found." };
      if (/refunded/i.test(order.refundStatus)) {
        return { ok: false, message: `Order #${order.orderNumber} is already refunded.` };
      }
      const capped = Math.min(Number(amount), Number(order.total), env.refundMaxAmount);
      if (!(capped > 0)) return { ok: false, message: "Invalid refund amount." };
      order.refundStatus = capped >= order.total ? "refunded" : "partial";
      if (capped >= order.total) order.financialStatus = "refunded";
      return {
        ok: true,
        amount: capped,
        refundId: `rf-${Date.now()}`,
        message: `Refund of $${capped.toFixed(2)} submitted for order #${order.orderNumber}${reason ? ` (${reason})` : ""}.`,
      };
    },
    async getRefundDetails(orderId) {
      const order = orders.find((o) => o.id === orderId);
      if (!order) return null;
      const refunds =
        /refunded|partial/i.test(order.refundStatus)
          ? [
              {
                id: `rf-${order.id}`,
                amount:
                  order.refundStatus === "partial"
                    ? Math.round(order.total * 0.5 * 100) / 100
                    : order.total,
                createdAt: order.createdAt,
                note: "Store refund",
              },
            ]
          : [];
      return buildRefundDetails({
        orderNumber: order.orderNumber,
        orderTotal: order.total,
        currency: order.currency,
        financialStatus: order.financialStatus,
        refundStatus: order.refundStatus,
        refunds,
      });
    },
  };
}

function normalizePhone(p: string) {
  return p.replace(/\D/g, "");
}
