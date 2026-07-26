import type { ChatMessage, ToolResult } from "@chatbot/shared";
import { makeMessage } from "../storage/store.js";
import { env } from "../config/env.js";
import { sanitizeCustomerText } from "../security/sanitize.js";

export function buildAssistantMessages(
  text: string | undefined,
  toolResults: ToolResult[],
): ChatMessage[] {
  const messages: ChatMessage[] = [];
  const uiResult = [...toolResults].reverse().find((r) => r.ui);
  const justCancelled = toolResults.some(
    (r) =>
      r.ok &&
      typeof r.data === "object" &&
      r.data &&
      (r.data as { justCancelled?: boolean }).justCancelled === true,
  );
  let body = sanitizeCustomerText(
    (text || defaultTextFromTools(toolResults)).trim(),
  );

  if (uiResult?.ui?.contentType === "product_cards") {
    const products = uiResult.ui.products || [];
    const search =
      (uiResult.ui as { search?: Record<string, unknown> }).search ||
      (uiResult.data as { search?: Record<string, unknown> } | undefined)?.search;
    body = productIntroText(body, products.length, search);
    if (!products.length) {
      messages.push(
        makeMessage({
          role: "assistant",
          contentType: "text",
          body,
          senderName: env.agentName,
        }),
      );
    } else {
      messages.push(
        makeMessage({
          role: "assistant",
          contentType: "product_cards",
          body,
          senderName: env.agentName,
          products,
        }),
      );
    }
  } else if (uiResult?.ui?.contentType === "order_card") {
    const order = uiResult.ui.order!;
    body = orderIntroText(body, order, { justCancelled });
    messages.push(
      makeMessage({
        role: "assistant",
        contentType: "order_card",
        body,
        senderName: env.agentName,
        order,
      }),
    );
  } else if (uiResult?.ui?.contentType === "input_form") {
    messages.push(
      makeMessage({
        role: "assistant",
        contentType: "text",
        body,
        senderName: env.agentName,
      }),
    );
    messages.push(
      makeMessage({
        role: "assistant",
        contentType: "input_form",
        senderName: env.agentName,
        form: uiResult.ui.form,
      }),
    );
  } else if (uiResult?.ui?.contentType === "choices") {
    // Single message: text + choices. A separate empty "choices" row renders as a blank bubble.
    messages.push(
      makeMessage({
        role: "assistant",
        contentType: "text",
        body,
        senderName: env.agentName,
        choices: uiResult.ui.choices,
        actionButtons: uiResult.ui.actionButtons,
      }),
    );
  } else if (uiResult?.ui?.contentType === "rating") {
    messages.push(
      makeMessage({
        role: "assistant",
        contentType: "rating",
        body: body || uiResult.ui.rating?.prompt || "How was this chat?",
        senderName: env.agentName,
        rating: uiResult.ui.rating,
      }),
    );
  } else if (uiResult?.ui?.contentType === "system_event") {
    const eventType = uiResult.ui.systemEvent?.type;
    const eventText = (uiResult.ui.systemEvent?.text || "").trim();
    // Connecting spinner only — no extra “summary prepared” chat bubble
    if (eventType === "handoff_connecting") {
      messages.push(
        makeMessage({
          role: "system",
          contentType: "system_event",
          body: eventText || "Connecting with an agent…",
          systemEvent: uiResult.ui.systemEvent,
        }),
      );
    } else {
      if (body && body !== eventText) {
        messages.push(
          makeMessage({
            role: "assistant",
            contentType: "text",
            body,
            senderName: env.agentName,
          }),
        );
      }
      messages.push(
        makeMessage({
          role: "system",
          contentType: "system_event",
          body: uiResult.ui.systemEvent?.text,
          systemEvent: uiResult.ui.systemEvent,
        }),
      );
    }
  } else {
    messages.push(
      makeMessage({
        role: "assistant",
        contentType: "text",
        body: body || "Happy to help — what can I do for you?",
        senderName: env.agentName,
      }),
    );
  }

  return messages;
}

/** Natural paraphrase fallback when the model isn’t available for policy answers. */
export function paraphrasePolicy(docs: Array<{ title: string; body: string }>): string {
  const body = docs[0]?.body || "";
  if (!body) return "I can share our store policies — what would you like to know about?";

  // Light cleanup + human framing (facts preserved; not a verbatim dump with title prefix)
  const cleaned = body
    .replace(/\s+/g, " ")
    .replace(/\s,—/g, " —")
    .replace(/\s+,/g, ",")
    .trim();

  if (/return|refund/i.test(docs[0].title + cleaned)) {
    return `Here’s how returns and refunds work: ${cleaned} If you want, I can also check a specific order for you.`;
  }
  if (/ship/i.test(docs[0].title + cleaned)) {
    return `Here’s our shipping info: ${cleaned} Want help tracking a shipment?`;
  }
  if (/cancel/i.test(docs[0].title + cleaned)) {
    return `About cancellations: ${cleaned} I can check whether your order can still be cancelled if you share the details.`;
  }
  return `${cleaned} Anything else you’d like me to clarify?`;
}

export function humanFallbackReply(message: string, goal: string): string {
  const m = message.trim().toLowerCase();
  // Only exact short tokens — not "why is it not packed"
  if (!m || /^(why|ok|okay|hmm+|huh|idk|sup)[.?!]*$/i.test(m)) {
    return "Happy to help — were you asking about an order, a return, or something else?";
  }
  if (/^(nothing|nope|nm|never ?mind)[.?!]*$/i.test(m)) {
    return "No worries — I’m here if you need help with an order, a return, or finding a product.";
  }
  if (/^(hi|hello|hey)\b/.test(m)) {
    return "Hi! What can I help you with today?";
  }
  if (goal === "policy") {
    return "I can explain our policies — are you asking about returns, shipping, or something else?";
  }
  return "Got it — what would you like help with?";
}

function formatMoney(amount: unknown): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return String(amount ?? "");
  return `$${n.toLocaleString("en-US", {
    maximumFractionDigits: n % 1 ? 2 : 0,
  })}`;
}

function sizeLabel(size: unknown): string {
  const s = String(size || "").toLowerCase();
  const map: Record<string, string> = {
    xs: "XS",
    s: "S",
    m: "M",
    l: "L",
    xl: "XL",
    xxl: "XXL",
    xxxl: "XXXL",
  };
  return map[s] || String(size).toUpperCase();
}

function describeSearchParts(search?: Record<string, unknown> | null): {
  size?: string;
  color?: string;
  productType?: string;
  style?: string;
  material?: string;
  budget?: string;
  occasion?: string;
  query?: string;
} {
  if (!search) return {};
  const colorRaw = search.color ? String(search.color) : "";
  const colorParts = colorRaw
    .split(/[,|/]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    size: search.size ? sizeLabel(search.size) : undefined,
    color: colorParts.length
      ? colorParts.length === 1
        ? colorParts[0]
        : colorParts.slice(0, -1).join(", ") + " or " + colorParts[colorParts.length - 1]
      : undefined,
    productType: search.productType ? String(search.productType) : undefined,
    style: search.style ? String(search.style) : undefined,
    material: search.material ? String(search.material) : undefined,
    budget: search.budgetMax != null ? formatMoney(search.budgetMax) : undefined,
    occasion: search.occasion ? String(search.occasion) : undefined,
    query: search.query ? String(search.query) : undefined,
  };
}

/** Warm, CSR-style product intro — not a robotic “here are options for X”. */
function buildProductIntro(
  count: number,
  search?: Record<string, unknown> | null,
): string {
  const p = describeSearchParts(search);
  const prefs: string[] = [];
  if (p.size) prefs.push(`size ${p.size}`);
  if (p.color) prefs.push(p.color);
  if (p.material) prefs.push(p.material);
  if (p.style) prefs.push(p.style);
  if (p.productType) prefs.push(p.productType);
  if (p.occasion) prefs.push(p.occasion);

  const prefPhrase = prefs.length
    ? prefs.length === 1
      ? prefs[0]
      : prefs.length === 2
        ? `${prefs[0]} and ${prefs[1]}`
        : `${prefs.slice(0, -1).join(", ")}, and ${prefs[prefs.length - 1]}`
    : "";

  if (count === 0) {
    if (prefPhrase && p.budget) {
      return `I checked for ${prefPhrase} within about ${p.budget}, but nothing lined up right now. Want to loosen the budget, try another size, or browse a different style?`;
    }
    if (prefPhrase) {
      return `I looked for ${prefPhrase}, but I don’t have a strong match at the moment. Want to try a different size, color, or style?`;
    }
    if (p.budget) {
      return `I couldn’t find a good match within about ${p.budget} right now. Want to adjust the budget or tell me a style you like?`;
    }
    return "I couldn’t find a good match just yet — want to share a size, color, or budget so I can narrow it down?";
  }

  if (count === 1) {
    if (prefPhrase && p.budget) {
      return `I found one that fits ${prefPhrase} and stays under ${p.budget} — take a look:`;
    }
    if (prefPhrase) {
      return `Here’s one that looked like a strong match for ${prefPhrase}:`;
    }
    if (p.budget) {
      return `Here’s one option that stays under ${p.budget}:`;
    }
    return "Here’s one option I think you’ll like:";
  }

  if (prefPhrase && p.budget) {
    return `I pulled a few that work for ${prefPhrase} and stay under ${p.budget} — see what you think:`;
  }
  if (prefPhrase) {
    return `I picked a few that match ${prefPhrase} — take a look:`;
  }
  if (p.budget) {
    return `Here are a few within about ${p.budget} — happy to refine if you want:`;
  }
  if (p.query) {
    return `I found a few that looked relevant — take a look:`;
  }
  return "I picked a few options that looked like a good fit — see what you think:";
}

function productIntroText(
  text: string,
  count: number,
  search?: Record<string, unknown> | null,
): string {
  const fallback = buildProductIntro(count, search);

  // Empty catalog match: never trust the model claiming it “found options”
  if (count === 0) {
    if (
      !text ||
      /here (are|is)|found|options|take a look|catch(?:es)? your eye|great (options|picks)|under your budget/i.test(
        text,
      )
    ) {
      return fallback;
    }
    // Allow a short honest AI line if it already admits nothing matched
    const cleanedEmpty = sanitizeCustomerText(text)
      .replace(/https?:\/\/\S+/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (
      cleanedEmpty &&
      cleanedEmpty.length <= 180 &&
      /couldn'?t find|no match|nothing|don'?t have|out of|not (finding|seeing)|within (your )?budget/i.test(
        cleanedEmpty,
      )
    ) {
      return /[.!?]$/.test(cleanedEmpty) ? cleanedEmpty : `${cleanedEmpty}.`;
    }
    return fallback;
  }

  if (!text) return fallback;

  const cleaned = sanitizeCustomerText(text)
    .replace(/\[([^\]]*)\]\([^)]+\)/g, "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/[*_`#>]+/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  // Preserve factual attribute answers (material/colors/sizes) — never rewrite to a recommend intro
  if (
    /don'?t have|isn'?t (listed|available)|not (listed|available)|aren'?t listed|doesn'?t list|no .* listed|available in:|comes in sizes:|made of:|here'?s what we have listed|actually,|catalog colors:|catalog sizes:/i.test(
      cleaned,
    )
  ) {
    return /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
  }

  // Preserve product-compare grounded copy
  if (
    /here'?s a quick comparison|comparison:|vs\.|versus|difference between/i.test(
      cleaned,
    )
  ) {
    return cleaned;
  }

  // Long dumps / markdown / multi-product essays → keep the warm intro
  if (
    !cleaned ||
    cleaned.length > 180 ||
    /view it here|myshopify\.com|demo\.agentraa\.com\/products|thebuildclub\.space\/products/i.test(text) ||
    ((text.match(/\$\s?\d/g) || []).length >= 2 && text.length > 160)
  ) {
    return fallback;
  }

  // Robotic / generic model lines → prefer CSR-style intro
  if (
    /good fit|few options|here are (a )?few|here'?s one option|options for under|options for size|great options|under your budget/i.test(
      cleaned,
    )
  ) {
    return fallback;
  }

  return /[:.!?]$/.test(cleaned) ? cleaned : `${cleaned}:`;
}

function orderIntroText(
  text: string,
  order: {
    orderNumber?: string;
    outcome?: string | null;
    cancellationStatus?: string;
    financialStatus?: string;
    fulfillmentStatus?: string;
    shipmentStatus?: string;
    stepper?: { current?: string };
    tracking?: { number?: string };
  },
  opts?: { justCancelled?: boolean },
): string {
  const cancelled =
    order.outcome === "cancelled" ||
    String(order.cancellationStatus || "").toLowerCase() === "cancelled";

  // Cancel action just succeeded this turn — confirm the action, never “already cancelled”
  if (opts?.justCancelled) {
    const n = order.orderNumber || "";
    if (text && /i('?ve| have) now cancelled|just cancelled|cancelled (your |the )?order/i.test(text) && !/already cancel/i.test(text)) {
      return sanitizeCustomerText(text);
    }
    return `I’ve now cancelled order #${n}. It won’t ship.`;
  }

  if (cancelled) {
    const wrong =
      !text ||
      !/cancel/i.test(text) ||
      /hasn'?t been cancel|not (been )?cancel|still (unfulfill|being prepared)|marked as pending|sent in error|no refund status/i.test(
        text,
      );
    if (wrong) {
      return `I found order #${order.orderNumber}. It’s cancelled, so it won’t ship. If you got a cancellation email, that matches this order.`;
    }
    return sanitizeCustomerText(text);
  }

  if (text && text.length < 220 && !/myshopify/i.test(text)) {
    return sanitizeCustomerText(text);
  }

  const fulfillment = String(order.fulfillmentStatus || "").toLowerCase();
  const shipment = String(order.shipmentStatus || "").toLowerCase();
  const payment = String(order.financialStatus || "").replace(/_/g, " ");
  if (fulfillment === "unfulfilled" || order.stepper?.current === "placed") {
    return `I found order #${order.orderNumber}. Payment shows as ${payment}, and it hasn’t been packed or shipped yet — it’s still being prepared.`;
  }
  if (/shipped|in_transit/.test(shipment)) {
    return `I found order #${order.orderNumber}. It’s on the way${order.tracking?.number ? ` (tracking ${order.tracking.number})` : ""}.`;
  }
  return `I found order #${order.orderNumber}. Fulfillment is ${fulfillment.replace(/_/g, " ") || "updating"}, shipment is ${shipment.replace(/_/g, " ") || "updating"} (payment: ${payment}).`;
}

function defaultTextFromTools(results: ToolResult[]): string {
  if (!results.length) return "Happy to help — what can I do for you?";
  const failed = results.find((r) => !r.ok);
  if (failed) {
    return (
      failed.error ||
      "I couldn’t finish that just now. Want me to connect you with a teammate?"
    );
  }
  const last = [...results].reverse().find((r) => {
    const data = r.data as { silent?: boolean } | undefined;
    return !(data && typeof data === "object" && data.silent);
  }) || results[results.length - 1];
  if (last.ui?.systemEvent?.type === "handoff_connecting") {
    return "";
  }
  // Prefer grounded tool messages (e.g. material not listed) over generic product intros
  if (typeof last.data === "object" && last.data && "message" in (last.data as object)) {
    const msg = String((last.data as { message?: string }).message || "").trim();
    if (msg) return msg;
  }
  if (last.ui?.contentType === "product_cards") {
    const n = last.ui.products?.length || 0;
    return n
      ? `Here ${n === 1 ? "is one option" : "are a few options"} that looked like a good fit:`
      : "I couldn’t find a match. Want to try a different color, size, or budget?";
  }
  if (last.ui?.contentType === "order_card" && last.ui.order) {
    return orderIntroText("", last.ui.order);
  }
  if (last.data && typeof last.data === "object" && "documents" in (last.data as object)) {
    const docs = (last.data as { documents: Array<{ title: string; body: string }> })
      .documents;
    if (docs?.length) return paraphrasePolicy(docs);
  }
  return "Here’s what I found.";
}
