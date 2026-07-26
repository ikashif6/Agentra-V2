import type { ChatMessage, ConversationState } from "@chatbot/shared";

export function recentContext(
  messages: ChatMessage[],
  limit = 12,
): Array<{ role: "user" | "assistant"; content: string }> {
  return messages
    .filter((m) => m.role === "customer" || m.role === "assistant" || m.role === "agent")
    .slice(-limit)
    .map((m) => ({
      role: m.role === "customer" ? ("user" as const) : ("assistant" as const),
      content: m.body || describeMessage(m),
    }));
}

function describeMessage(m: ChatMessage): string {
  if (m.contentType === "product_cards") {
    return `[products: ${(m.products || []).map((p) => p.title).join(", ")}]`;
  }
  if (m.contentType === "order_card") {
    const o = m.order;
    return `[order #${o?.orderNumber}: financial=${o?.financialStatus}, fulfillment=${o?.fulfillmentStatus}, shipment=${o?.shipmentStatus}, refund=${o?.refundStatus}, stepper=${o?.stepper?.current || "n/a"}]`;
  }
  if (m.contentType === "input_form") return `[form: ${m.form?.title}]`;
  if (m.contentType === "choices") {
    return `[choices: ${(m.choices || []).map((c) => c.label).join(", ")}]`;
  }
  return m.systemEvent?.text || "";
}

export function clearFlowIfSwitched(
  state: ConversationState,
  switchedTopic: boolean,
): ConversationState {
  if (!switchedTopic) return state;
  return {
    ...state,
    activeFlow: null,
    flowStep: null,
    pendingAction: null,
  };
}
