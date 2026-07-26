/** Shared refund-status messaging for tools and adapters. */

export type RefundLine = {
  id: string;
  amount: number;
  createdAt?: string;
  note?: string;
};

export type RefundDetails = {
  status: "none" | "partial" | "refunded" | "pending";
  financialStatus: string;
  orderNumber: string;
  orderTotal: number;
  currency: string;
  refundedAmount: number;
  remainingAmount: number;
  refunds: RefundLine[];
  message: string;
};

function money(amount: number, currency: string): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return String(amount);
  const symbol = currency === "USD" || !currency ? "$" : `${currency} `;
  return `${symbol}${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function buildRefundDetails(input: {
  orderNumber: string;
  orderTotal: number;
  currency: string;
  financialStatus: string;
  refundStatus?: string;
  refunds?: RefundLine[];
}): RefundDetails {
  const currency = input.currency || "USD";
  const orderTotal = Number(input.orderTotal) || 0;
  const refunds = input.refunds || [];
  const refundedAmount = refunds.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const financial = String(input.financialStatus || "").toLowerCase();
  const refundFlag = String(input.refundStatus || "").toLowerCase();

  let status: RefundDetails["status"] = "none";
  if (financial === "refunded" || refundFlag === "refunded" || (orderTotal > 0 && refundedAmount >= orderTotal - 0.01)) {
    status = "refunded";
  } else if (
    financial === "partially_refunded" ||
    refundFlag === "partial" ||
    refundFlag === "partially_refunded" ||
    refundedAmount > 0.01
  ) {
    status = "partial";
  } else if (/pending|processing/.test(refundFlag)) {
    status = "pending";
  }

  // If financial says refunded but no line items, still treat as refunded (full)
  const effectiveRefunded =
    status === "refunded" && refundedAmount < 0.01 ? orderTotal : refundedAmount;
  const remainingAmount = Math.max(0, orderTotal - effectiveRefunded);

  let message: string;
  if (status === "refunded") {
    message = `Yes — order #${input.orderNumber} shows as fully refunded${
      effectiveRefunded > 0 ? ` (${money(effectiveRefunded, currency)})` : ""
    }. Funds go back to the original payment method; banks often take 5–10 business days to post it.`;
  } else if (status === "partial") {
    message = `Order #${input.orderNumber} has a partial refund of ${money(
      effectiveRefunded,
      currency,
    )} (order total ${money(orderTotal, currency)}). About ${money(
      remainingAmount,
      currency,
    )} remains on the order.`;
  } else if (status === "pending") {
    message = `A refund for order #${input.orderNumber} looks pending / in progress. It isn’t fully posted yet — I can connect you with an agent if you need it chased up.`;
  } else {
    message = `I don’t see a refund issued yet for order #${input.orderNumber}. Payment still shows as ${
      input.financialStatus || "unknown"
    }. If you need a refund started, I can connect you with a teammate (I can’t process refunds myself).`;
  }

  return {
    status,
    financialStatus: input.financialStatus,
    orderNumber: input.orderNumber,
    orderTotal,
    currency,
    refundedAmount: effectiveRefunded,
    remainingAmount,
    refunds,
    message,
  };
}
