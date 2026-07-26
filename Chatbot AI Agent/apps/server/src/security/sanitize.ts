const LEAK_PATTERNS: Array<[RegExp, string]> = [
  [/gpt-[0-9][\w.-]*/gi, ""],
  [/claude[-\s]?[0-9][\w.-]*/gi, ""],
  [/llama[-\s]?[0-9][\w.-]*/gi, ""],
  [/\bgroq\b/gi, ""],
  [/\bopenai\b/gi, ""],
  [/\banthropic\b/gi, ""],
  [/system prompt/gi, ""],
  [/tool definitions?/gi, ""],
  [/api[_ ]?key/gi, ""],
  [/<function[=:\s][^>]*>/gi, ""],
  [/<\/?function[^>]*>/gi, ""],
  [/\(?\s*I('ll| will)? (call|use|invoke) (the )?[a-zA-Z0-9_]+ tool\.?\s*\)?/gi, ""],
  [/\(?\s*I('ll| will)? call (the )?recommendProducts[^.]*\.?\s*\)?/gi, ""],
  [/\(?\s*I('ll| will)? call (the )?searchProducts[^.]*\.?\s*\)?/gi, ""],
  [/\b(recommendProducts|searchProducts|findOrder|getOrderStatus|getTrackingDetails|createReturnRequest|requestCancellation|requestAddressChange|requestHumanHandoff|searchKnowledgeBase)\b/gi, ""],
  [/\(I'll check our product recommendations\)/gi, ""],
  [/I'll call the .+ tool\.?/gi, ""],
  [/\[[^\]]*\]\([^)]+\)/g, ""],
  [/https?:\/\/[a-z0-9.-]*myshopify\.com\/\S+/gi, ""],
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, ""],
  [/\s*Your ticket ID is\s*\.?\s*/gi, " "],
  [/\s{2,}/g, " "],
];

export function sanitizeCustomerText(text: string): string {
  let out = String(text || "");
  for (const [re, replacement] of LEAK_PATTERNS) {
    out = out.replace(re, replacement);
  }
  out = out
    .replace(/\(\s*\)/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return out;
}

/** True when the model stalled with a "I'll look that up" style promise and no tools ran. */
export function looksLikeDeferredAction(text: string): boolean {
  return /\b(let me (see|check|look|search|find)|i('ll| will) (check|look|search|find|call|get back)|checking (our|the)|i('ll| will) (recommend|pull up))\b/i.test(
    text || "",
  );
}

export function containsSensitiveRequest(text: string): boolean {
  return /(card number|cvv|cvc|password|pin\b|routing number|ssn|social security)/i.test(
    text,
  );
}

export function hasProductPreferences(slots: Record<string, string | undefined>): boolean {
  return Boolean(
    slots.productType ||
      slots.color ||
      slots.size ||
      slots.style ||
      slots.material ||
      slots.budget ||
      slots.occasion ||
      slots.productQuery,
  );
}

/** Customer is fine browsing without specific prefs. */
export function wantsProductBrowse(message: string): boolean {
  // Do NOT match bare "recommend" — that should ask preferences first.
  return /\b(sure|anything|popular|just show|show me some|surprise( me)?|any(thing)?|no idea|idk|i don'?t know|dont know|don't know|not sure|whatever|you (pick|choose)|up to you)\b/i.test(
    message,
  );
}

/** Drop sticky budget/color/size filters — open-ended browse or explicit reset. */
export function shouldClearProductPreferences(message: string): boolean {
  if (wantsProductBrowse(message)) return true;
  return /\b(never ?mind|forget (the |my )?(budget|filters?|color|size)|start over|something else entirely|ignore (the |my )?(budget|filters?|color|size)|any budget|no budget)\b/i.test(
    message,
  );
}

export function clearProductPreferenceSlots<T extends Record<string, string | undefined>>(
  slots: T,
): T {
  const next = { ...slots };
  delete next.budget;
  delete next.color;
  delete next.size;
  delete next.style;
  delete next.material;
  delete next.occasion;
  delete next.productType;
  delete next.productQuery;
  return next;
}
