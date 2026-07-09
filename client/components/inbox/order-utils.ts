import type { StoreOrder, StoreOrderAddress } from "@/lib/types";

export function formatMoney(amount?: number, currency?: string) {
  if (amount == null) return "";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
    }).format(amount);
  } catch {
    return `${amount} ${currency ?? ""}`.trim();
  }
}

export function financialTone(status?: string) {
  const s = (status || "").toLowerCase();
  if (s === "paid") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (s === "refunded" || s === "cancelled" || s === "failed")
    return "bg-red-50 text-red-700 border-red-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

export function fulfillmentTone(status?: string) {
  const s = (status || "").toLowerCase();
  if (s === "fulfilled" || s === "shipped" || s === "completed") {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }
  if (s === "partial") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-amber-50 text-amber-800 border-amber-200";
}

export function orderIsCancelled(order: StoreOrder) {
  const fin = (order.financialStatus || "").toLowerCase();
  const ful = (order.fulfillmentStatus || "").toLowerCase();
  return fin === "cancelled" || fin === "refunded" || ful === "cancelled";
}

export function orderIsFulfilled(order: StoreOrder) {
  const ful = (order.fulfillmentStatus || "").toLowerCase();
  return ful === "fulfilled" || ful === "shipped" || ful === "completed";
}

export function formatOrderDate(value?: string) {
  if (!value) return "";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatOrderListDate(value?: string) {
  if (!value) return "";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatConversionDate(value?: string) {
  if (!value) return "";
  return new Date(value).toLocaleString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatSessionTimestamp(value?: string) {
  if (!value) return "";
  return new Date(value).toLocaleString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatLandingPath(landing?: string | null) {
  if (!landing) return null;
  try {
    if (landing.startsWith("http://") || landing.startsWith("https://")) {
      const url = new URL(landing);
      return `${url.pathname}${url.search}`;
    }
    return landing;
  } catch {
    return landing;
  }
}

export function orderItemCount(order: StoreOrder) {
  if (order.itemCount != null) return order.itemCount;
  return (order.lineItems ?? []).reduce((sum, item) => sum + (item.quantity ?? 1), 0);
}

export function formatFinancialLabel(status?: string) {
  const s = (status || "").toLowerCase();
  if (s === "pending") return "Payment pending";
  if (s === "paid") return "Paid";
  if (s === "refunded") return "Refunded";
  if (s === "cancelled") return "Cancelled";
  return status || "Unknown";
}

export function formatFulfillmentLabel(status?: string) {
  const s = (status || "").toLowerCase();
  if (!s || s === "unfulfilled") return "Unfulfilled";
  if (s === "fulfilled") return "Fulfilled";
  if (s === "partial") return "Partially fulfilled";
  return status || "Unfulfilled";
}

export function formatAddress(address?: StoreOrderAddress) {
  if (!address) return "";
  return [
    address.name,
    address.address1,
    address.address2,
    [address.city, address.province, address.zip].filter(Boolean).join(", "),
    address.country,
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatShippingAddressLines(address?: StoreOrderAddress) {
  if (!address) return [];
  return [
    address.name,
    address.address1,
    address.address2,
    address.city,
    address.province,
    address.zip,
    address.country,
  ].filter(Boolean);
}

export function billingMatchesShipping(
  shipping?: StoreOrderAddress,
  billing?: StoreOrderAddress,
) {
  if (!billing) return true;
  if (!shipping) return false;
  const keys = ["address1", "address2", "city", "province", "zip", "country"] as const;
  return keys.every(
    (key) => (shipping[key] || "").trim().toLowerCase() === (billing[key] || "").trim().toLowerCase(),
  );
}

export function addressMapUrl(address?: StoreOrderAddress) {
  const query = [address?.address1, address?.city, address?.province, address?.country]
    .filter(Boolean)
    .join(", ");
  if (!query) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function customerAdminUrl(order: StoreOrder) {
  const customerId = order.customer?.externalId;
  if (!customerId || !order.adminUrl) return null;
  return order.adminUrl.replace(/\/orders\/[^/]+$/, `/customers/${customerId}`);
}

export function orderBalance(order: StoreOrder) {
  const total = order.totalPrice ?? 0;
  const fin = (order.financialStatus || "").toLowerCase();
  if (fin === "paid") return 0;
  return total;
}

export function orderAmountPaid(order: StoreOrder) {
  const total = order.totalPrice ?? 0;
  const balance = orderBalance(order);
  return Math.max(0, total - balance);
}

function orderPaymentGap(order: StoreOrder) {
  const subtotal = order.subtotalPrice;
  const total = order.totalPrice;
  if (subtotal == null || total == null) return undefined;
  const gap = Math.round((total - subtotal) * 100) / 100;
  return gap > 0.001 ? gap : undefined;
}

export function orderShippingAmount(order: StoreOrder) {
  if (order.totalShipping != null) return order.totalShipping;
  const lines = order.shippingLines ?? [];
  if (lines.length) {
    return lines.reduce((acc, line) => acc + (line.price ?? 0), 0);
  }
  const tax = orderTaxAmount(order);
  const gap = orderPaymentGap(order);
  if (gap != null && tax != null) {
    return Math.round((gap - tax) * 100) / 100;
  }
  return undefined;
}

export function orderTaxAmount(order: StoreOrder) {
  if (order.totalTax != null) return order.totalTax;
  const lines = order.taxLines ?? [];
  if (lines.length) {
    return lines.reduce((acc, line) => acc + (line.price ?? 0), 0);
  }
  const shipping = order.totalShipping ?? (order.shippingLines?.reduce((acc, line) => acc + (line.price ?? 0), 0));
  const gap = orderPaymentGap(order);
  if (gap != null && shipping != null) {
    return Math.round((gap - shipping) * 100) / 100;
  }
  return undefined;
}

export function formatTaxLineLabel(line: { title?: string; rate?: number }) {
  const title = line.title || "Tax";
  if (line.rate != null && line.rate > 0 && line.rate <= 1) {
    const pct = Number((line.rate * 100).toFixed(2));
    const pctLabel = Number.isInteger(pct) ? String(pct) : pct.toFixed(2).replace(/\.?0+$/, "");
    return `${title} ${pctLabel}%`;
  }
  return title;
}

export function formatOrderTaxDetail(order: StoreOrder) {
  const lines = order.taxLines ?? [];
  if (!lines.length) return undefined;
  return lines.map((line) => formatTaxLineLabel(line)).join(", ");
}

export function formatOrderShippingDetail(order: StoreOrder) {
  const title = order.shippingLines?.[0]?.title || order.shippingMethod || "Shipping";
  const grams =
    order.totalWeightGrams ??
    (order.lineItems ?? []).reduce(
      (sum, item) => sum + (item.grams ?? 0) * (item.quantity ?? 1),
      0,
    );
  if (!grams) return title;
  const kg = (grams / 1000).toFixed(3);
  return `${title} (${kg} kg: Items ${kg} kg, Package 0.0 kg)`;
}
