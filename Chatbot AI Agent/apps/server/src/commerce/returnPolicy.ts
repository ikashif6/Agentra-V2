import { env } from "../config/env.js";

export type ReturnEligibilityInput = {
  orderNumber?: string;
  cancellationStatus?: string;
  fulfillmentStatus?: string;
  shipmentStatus?: string;
  refundStatus?: string;
  financialStatus?: string;
  createdAt?: string;
  deliveredAt?: string | null;
  fulfilledAt?: string | null;
  items?: Array<{ title?: string; sku?: string }>;
  tags?: string[];
};

export type ReturnEligibilityResult = {
  eligible: boolean;
  reason: string;
  /** Customer-facing reply that cites the order + store policy. */
  message: string;
  policySummary: string;
  windowDays: number;
  daysSinceAnchor?: number | null;
  anchorLabel?: string;
};

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

function looksFinalSale(input: ReturnEligibilityInput): boolean {
  const hay = [
    ...(input.tags || []),
    ...(input.items || []).map((i) => `${i.title || ""} ${i.sku || ""}`),
  ]
    .join(" ")
    .toLowerCase();
  return /\b(final[-\s]?sale|finalsale|no\s*returns?|non[-\s]?returnable|custom\s*(order|gown|dress|item)?|made[-\s]?to[-\s]?order)\b/i.test(
    hay,
  );
}

function orderRef(orderNumber?: string): string {
  const n = String(orderNumber || "").replace(/^#/, "").trim();
  return n ? `order #${n}` : "your order";
}

function lookingAt(orderNumber?: string): string {
  return `Looking at ${orderRef(orderNumber)}`;
}

/**
 * Store return policy: unworn items with tags within N days of delivery;
 * custom / final-sale not eligible. Uses delivery date when known, else
 * fulfillment/ship date, else order created date.
 */
export function evaluateReturnEligibility(
  order: ReturnEligibilityInput,
  opts?: { windowDays?: number; now?: Date },
): ReturnEligibilityResult {
  const windowDays = Math.max(
    1,
    opts?.windowDays ?? env.returnWindowDays ?? 14,
  );
  const policySummary = `Unworn items with tags may be returned within ${windowDays} days of delivery. Custom and final-sale items aren’t eligible.`;
  const policyLine = `According to our policy, unworn items with tags may be returned within ${windowDays} days of delivery (custom and final-sale items aren’t eligible).`;
  const now = opts?.now ?? new Date();
  const looking = lookingAt(order.orderNumber);

  const cancelled =
    String(order.cancellationStatus || "").toLowerCase() === "cancelled";
  if (cancelled) {
    const reason = `${looking}, it’s already cancelled, so a return can’t be started.`;
    return {
      eligible: false,
      reason,
      message: `${reason} ${policyLine}`,
      policySummary,
      windowDays,
    };
  }

  const refund = `${order.refundStatus || ""} ${order.financialStatus || ""}`.toLowerCase();
  if (/\b(refunded|voided)\b/.test(refund) && !/partial/.test(refund)) {
    const reason = `${looking}, it’s already refunded, so a return isn’t available.`;
    return {
      eligible: false,
      reason,
      message: `${reason} ${policyLine}`,
      policySummary,
      windowDays,
    };
  }

  const fulfillment = String(order.fulfillmentStatus || "").toLowerCase();
  const shipment = String(order.shipmentStatus || "").toLowerCase();
  if (
    !fulfillment ||
    fulfillment === "unfulfilled" ||
    fulfillment === "null" ||
    shipment === "not_shipped"
  ) {
    const reason = `${looking}, it still hasn’t shipped yet, so a return can’t be started.`;
    return {
      eligible: false,
      reason,
      message: `${reason} ${policyLine} If you need to stop it instead, I can check cancellation for you.`,
      policySummary,
      windowDays,
    };
  }

  if (looksFinalSale(order)) {
    const reason = `${looking}, it looks like a custom or final-sale item, which isn’t eligible for return.`;
    return {
      eligible: false,
      reason,
      message: `${reason} ${policyLine}`,
      policySummary,
      windowDays,
    };
  }

  let anchorIso =
    order.deliveredAt ||
    (shipment === "delivered" ? order.fulfilledAt || order.createdAt : null) ||
    order.fulfilledAt ||
    order.createdAt ||
    null;
  let anchorLabel =
    order.deliveredAt || shipment === "delivered"
      ? "delivery"
      : order.fulfilledAt
        ? "fulfillment"
        : "order date";

  if (!anchorIso) {
    const reason = `${looking}, I couldn’t verify the delivery window yet.`;
    return {
      eligible: false,
      reason,
      message: `${reason} ${policyLine}`,
      policySummary,
      windowDays,
    };
  }

  const anchor = new Date(anchorIso);
  if (Number.isNaN(anchor.getTime())) {
    const reason = `${looking}, I couldn’t verify the delivery window yet.`;
    return {
      eligible: false,
      reason,
      message: `${reason} ${policyLine}`,
      policySummary,
      windowDays,
    };
  }

  const days = daysBetween(anchor, now);
  if (days > windowDays) {
    const reason = `${looking}, the ${windowDays}-day return window from ${anchorLabel} has already passed (it’s been ${days} days).`;
    return {
      eligible: false,
      reason,
      message: `${reason} ${policyLine}`,
      policySummary,
      windowDays,
      daysSinceAnchor: days,
      anchorLabel,
    };
  }

  const reason = `${looking}, you can start a return — it’s within our ${windowDays}-day window from ${anchorLabel}.`;
  return {
    eligible: true,
    reason,
    message: `${reason} ${policyLine}`,
    policySummary,
    windowDays,
    daysSinceAnchor: days,
    anchorLabel,
  };
}
