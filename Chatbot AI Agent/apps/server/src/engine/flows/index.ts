/** Interruptible flow helpers — soft guidance only, never hard locks. */

export type FlowId =
  | "return"
  | "exchange"
  | "partial_return"
  | "cancellation"
  | "address_change"
  | "contact"
  | "handoff"
  | "damage_report"
  | "order_lookup"
  | "back_in_stock"
  | "custom_product";

export function suggestedFlowForGoal(goal: string): FlowId | null {
  switch (goal) {
    case "return_request":
      return "return";
    case "exchange_request":
      return "exchange";
    case "partial_return":
      return "partial_return";
    case "cancellation":
      return "cancellation";
    case "address_change":
      return "address_change";
    case "contact":
    case "ticket":
      return "contact";
    case "handoff":
      return "handoff";
    case "damaged_item":
    case "incorrect_item":
    case "missing_item":
      return "damage_report";
    case "tracking":
    case "order_status":
    case "order_lookup":
    case "refund_status":
    case "late_delivery":
    case "lost_delivery":
    case "delivery_estimate":
    case "reorder":
    case "payment_issue":
      return "order_lookup";
    case "back_in_stock":
      return "back_in_stock";
    case "custom_product_request":
      return "custom_product";
    default:
      return null;
  }
}

export function missingSlotsForFlow(
  flow: FlowId,
  slots: Record<string, string | undefined>,
  verifiedOrderId?: string | null,
): string[] {
  const missing: string[] = [];

  if (
    [
      "return",
      "exchange",
      "partial_return",
      "cancellation",
      "address_change",
      "damage_report",
      "order_lookup",
    ].includes(flow)
  ) {
    if (!slots.orderNumber && !verifiedOrderId) missing.push("orderNumber");
    if (!slots.email && !slots.phone) missing.push("email");
  }

  // Address / return details only after the order is verified AND eligible
  if (flow === "address_change" && verifiedOrderId) {
    if (!slots.addressLine1) missing.push("addressLine1");
    if (!slots.city) missing.push("city");
    if (!slots.zip) missing.push("zip");
    if (!slots.country) missing.push("country");
  }

  if (flow === "return" && verifiedOrderId) {
    if (!slots.returnReason) missing.push("returnReason");
  }

  if (flow === "exchange" && verifiedOrderId) {
    if (!slots.exchangeReason && !slots.returnReason) missing.push("exchangeReason");
  }

  if (flow === "partial_return" && verifiedOrderId) {
    if (!slots.partialReturnItems) missing.push("partialReturnItems");
    if (!slots.returnReason && !slots.partialReturnReason) missing.push("returnReason");
  }

  if (flow === "contact" || flow === "handoff") {
    if (!slots.email && !slots.phone) missing.push("email");
  }

  if (flow === "back_in_stock") {
    if (!slots.email && !slots.phone) missing.push("email");
  }

  if (flow === "custom_product") {
    if (!slots.email && !slots.phone) missing.push("email");
    if (!slots.customRequestDescription && !slots.issueDescription) {
      missing.push("customRequestDescription");
    }
  }

  if (flow === "damage_report" && !slots.issueDescription) {
    missing.push("issueDescription");
  }

  return missing;
}
