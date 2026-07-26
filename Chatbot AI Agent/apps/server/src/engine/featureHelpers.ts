/**
 * Extra catalog / order / commerce helpers used by chatbot tools.
 */
import type { StoreProduct, StoreOrder } from "../commerce/types.js";
import { getWorkspaceConfig } from "../workspace/index.js";

const PRODUCT_STOP = new Set([
  "a", "an", "the", "is", "are", "in", "on", "for", "to", "of", "and", "or", "vs",
  "what", "which", "material", "fabric", "made", "from", "stock", "available",
  "notify", "me", "when", "back", "waitlist", "put", "on", "compare", "show",
  "something", "similar", "cheaper", "please", "does", "do", "you", "have",
  "come", "with", "about", "tell", "more", "details", "dress", "dresses",
  "gown", "gowns", "product", "item", "one", "that", "this", "those", "these",
]);

export function tokenizeProductQuery(text: string): string[] {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !PRODUCT_STOP.has(t));
}

export function scoreProductNameMatch(query: string, product: StoreProduct): number {
  const title = String(product.title || "").toLowerCase();
  const q = String(query || "").toLowerCase().trim();
  if (!q || !title) return 0;
  if (title === q) return 100;
  if (title.includes(q) || q.includes(title)) return 80;

  const qTokens = tokenizeProductQuery(q);
  if (!qTokens.length) return 0;
  const titleTokens = new Set(tokenizeProductQuery(title));
  let score = 0;
  let hits = 0;
  for (const t of qTokens) {
    if (titleTokens.has(t)) {
      hits += 1;
      score += t.length >= 4 ? 4 : 2;
    } else if ([...titleTokens].some((x) => x.includes(t) || t.includes(x))) {
      hits += 1;
      score += 1;
    }
  }
  if (hits === 0) return 0;
  // Prefer covering most distinctive tokens (e.g. emilia, maya, sofia)
  score += hits * 2;
  if (product.available === false && /stock|available|notify|waitlist/i.test(q)) {
    score += 1;
  }
  return score;
}

export function pickBestProductsByName(
  products: StoreProduct[],
  query: string,
  opts?: { limit?: number; minScore?: number },
): StoreProduct[] {
  const minScore = opts?.minScore ?? 4;
  const limit = opts?.limit ?? 4;
  return products
    .map((p) => ({ p, score: scoreProductNameMatch(query, p) }))
    .filter((x) => x.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.p);
}

/** Pull likely product name phrases from a customer message. */
export function extractProductNameHints(message: string): string[] {
  const m = String(message || "").trim();
  if (!m) return [];
  const hints: string[] = [];

  const compare =
    m.match(
      /\bcompare\s+(?:the\s+)?(.+?)\s+(?:and|vs\.?|versus)\s+(?:the\s+)?(.+?)(?:\s*\?|$)/i,
    ) ||
    m.match(
      /\b(?:between|difference between)\s+(?:the\s+)?(.+?)\s+(?:and|vs\.?)\s+(?:the\s+)?(.+?)(?:\s*\?|$)/i,
    );
  if (compare) {
    hints.push(compare[1].trim(), compare[2].trim());
  }

  const named =
    m.match(
      /\b(?:the|a|an)\s+([A-Z][\w'-]*(?:\s+[A-Z][\w'-]*){0,5}(?:\s+(?:Dress|Gown|Veil|Sash|Vine))?)/,
    ) ||
    m.match(
      /\b([A-Z][\w'-]+(?:\s+(?:Lace|Satin|Crepe|Pearl|Cathedral|Scarlet|Sheath|Ballgown|Wedding|Hair|Ribbon))?)\s+(?:Dress|Gown|Veil|Sash|Vine)\b/i,
    ) ||
    m.match(
      /\b(Emilia|Sofia|Maya|Luna|Pearl Hair Vine|Scarlet)[^?.!]{0,40}/i,
    );
  if (named) hints.push(named[1].trim());

  // Lowercase catalog-style: "maya crepe sheath dress"
  const lower = m.match(
    /\b((?:emilia|sofia|maya|luna|pearl|scarlet)[\w\s-]{0,40}(?:dress|gown|veil|sash|vine)?)\b/i,
  );
  if (lower) hints.push(lower[1].trim());

  if (!hints.length) {
    const cleaned = m
      .replace(
        /\b(is|are|the|a|an|in stock|out of stock|material|fabric|what|which|notify me when|waitlist for|put me on a waitlist for)\b/gi,
        " ",
      )
      .replace(/[?!.,]/g, " ")
      .trim();
    if (cleaned.length >= 4) hints.push(cleaned);
  }

  return [...new Set(hints.map((h) => h.replace(/\s+/g, " ").trim()).filter(Boolean))];
}

export function scoreSimilarProduct(
  seed: StoreProduct,
  candidate: StoreProduct,
): number {
  if (seed.id === candidate.id) return -1;
  let score = 0;
  if (seed.productType && candidate.productType === seed.productType) score += 5;
  const seedColors = new Set((seed.colors || []).map((c) => c.toLowerCase()));
  const seedStyles = new Set((seed.styles || []).map((s) => s.toLowerCase()));
  const seedMaterials = new Set((seed.materials || []).map((m) => m.toLowerCase()));
  const seedTags = new Set((seed.tags || []).map((t) => t.toLowerCase()));
  for (const c of candidate.colors || []) if (seedColors.has(c.toLowerCase())) score += 2;
  for (const s of candidate.styles || []) if (seedStyles.has(s.toLowerCase())) score += 2;
  for (const m of candidate.materials || []) if (seedMaterials.has(m.toLowerCase())) score += 2;
  for (const t of candidate.tags || []) if (seedTags.has(t.toLowerCase())) score += 1;
  if (seed.price && candidate.price) {
    const diff = Math.abs(seed.price - candidate.price) / Math.max(seed.price, 1);
    if (diff < 0.15) score += 3;
    else if (diff < 0.35) score += 1;
  }
  const seedWords = seed.title.toLowerCase().split(/\s+/);
  const cand = candidate.title.toLowerCase();
  for (const w of seedWords) {
    if (w.length > 3 && cand.includes(w)) score += 1;
  }
  if (candidate.available) score += 1;
  return score;
}

export function compareProductFacts(products: StoreProduct[]): string {
  if (products.length < 2) return "I need at least two products to compare.";
  const lines: string[] = ["Here’s a quick comparison:"];
  for (const p of products.slice(0, 4)) {
    const bits = [
      p.title,
      p.price != null ? `$${Number(p.price).toFixed(2)}` : null,
      p.available ? "in stock" : "out of stock",
      p.colors?.length ? `colors: ${p.colors.join(", ")}` : null,
      p.sizes?.length ? `sizes: ${p.sizes.join(", ")}` : null,
      p.materials?.length ? `material: ${p.materials.join(", ")}` : null,
      p.styles?.length ? `style: ${p.styles.join(", ")}` : null,
    ].filter(Boolean);
    lines.push(`• ${bits.join(" — ")}`);
  }
  lines.push("Want me to narrow by budget or size, or open one with View More on the card?");
  return lines.join("\n");
}

export function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from.getTime());
  let left = days;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) left -= 1;
  }
  return d;
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function estimateDeliveryWindow(input: {
  order?: StoreOrder | null;
  speed?: "standard" | "express" | "international";
}): { message: string; etaStart?: string; etaEnd?: string } {
  const order = input.order;
  if (order?.tracking?.estimate) {
    return {
      message: `For order #${order.orderNumber}, the carrier estimate on file is ${order.tracking.estimate}.${
        order.tracking.number ? ` Tracking: ${order.tracking.number}.` : ""
      }`,
      etaEnd: order.tracking.estimate,
    };
  }

  const speed = input.speed || "standard";
  const base = order?.fulfilledAt
    ? new Date(order.fulfilledAt)
    : order?.createdAt
      ? new Date(order.createdAt)
      : new Date();
  const ranges: Record<string, [number, number]> = {
    standard: [5, 8],
    express: [2, 3],
    international: [10, 21],
  };
  const [lo, hi] = ranges[speed] || ranges.standard;
  const start = addBusinessDays(base, lo);
  const end = addBusinessDays(base, hi);
  const label =
    speed === "express"
      ? "express"
      : speed === "international"
        ? "international"
        : "standard";
  const orderBit = order ? ` for order #${order.orderNumber}` : "";
  return {
    message: `With ${label} shipping${orderBit}, delivery is typically ${formatDate(start)} – ${formatDate(end)} (business days). Tracking updates once the package ships.`,
    etaStart: start.toISOString(),
    etaEnd: end.toISOString(),
  };
}

export function estimateShippingCost(input: {
  destinationCountry?: string;
  speed?: "standard" | "express" | "international";
  orderTotal?: number;
}): { message: string; amount?: number; currency: string } {
  const country = (input.destinationCountry || "US").toUpperCase();
  const speed = input.speed || (country === "US" || country === "USA" ? "standard" : "international");
  const total = Number(input.orderTotal) || 0;

  let amount = 0;
  let note = "";
  if (speed === "express" && (country === "US" || country === "USA")) {
    amount = 24.95;
    note = "Express (2–3 business days within the US)";
  } else if (country === "US" || country === "USA" || country === "UNITED STATES") {
    amount = total >= 150 ? 0 : 9.95;
    note =
      total >= 150
        ? "Standard US shipping is free on orders $150+"
        : "Standard US shipping (5–8 business days)";
  } else {
    amount = 29.95;
    note = "International shipping (10–21 business days)";
  }

  const money = amount === 0 ? "free" : `$${amount.toFixed(2)}`;
  return {
    amount,
    currency: "USD",
    message: `Estimated shipping: ${money} — ${note}. Final rates are confirmed at checkout.`,
  };
}

export type DetectedLanguage = "en" | "es" | "fr" | "de" | "pt" | "it" | "ar" | "hi" | "zh";

export function detectLanguage(message: string): DetectedLanguage {
  const m = message.trim();
  if (!m) return "en";
  if (/[\u0600-\u06FF]/.test(m)) return "ar";
  if (/[\u4e00-\u9fff]/.test(m)) return "zh";
  if (/[\u0900-\u097F]/.test(m)) return "hi";
  if (
    /\b(hola|gracias|por favor|quiero|pedido|envío|devolución|ayuda)\b/i.test(m) ||
    /[¿¡]/.test(m)
  )
    return "es";
  if (/\b(bonjour|merci|s'il vous plaît|commande|livraison|retour|aide)\b/i.test(m))
    return "fr";
  if (/\b(hallo|danke|bitte|bestellung|lieferung|rückgabe|hilfe)\b/i.test(m)) return "de";
  if (/\b(olá|obrigad[oa]|por favor|pedido|entrega|devolução|ajuda)\b/i.test(m))
    return "pt";
  if (/\b(ciao|grazie|per favore|ordine|spedizione|reso|aiuto)\b/i.test(m)) return "it";
  return "en";
}

export type UrgencyLevel = "low" | "normal" | "high" | "critical";

export function detectUrgency(message: string): UrgencyLevel {
  const m = message.toLowerCase();
  if (
    /\b(urgent|asap|emergency|immediately|right now|wedding (is )?tomorrow|wedding (is )?today|critical|fraud|stolen card|unauthorized)\b/i.test(
      m,
    )
  ) {
    return "critical";
  }
  if (
    /\b(asap|as soon as possible|need (it|this) (soon|quickly)|running out of time|wedding (this|next) week|very important|escalate)\b/i.test(
      m,
    )
  ) {
    return "high";
  }
  if (/\b(whenever|no rush|not urgent|just curious|browsing)\b/i.test(m)) return "low";
  return "normal";
}

export function languageInstruction(lang: DetectedLanguage): string {
  if (lang === "en") return "";
  const names: Record<DetectedLanguage, string> = {
    en: "English",
    es: "Spanish",
    fr: "French",
    de: "German",
    pt: "Portuguese",
    it: "Italian",
    ar: "Arabic",
    hi: "Hindi",
    zh: "Chinese",
  };
  return `The customer is writing in ${names[lang]}. Reply in ${names[lang]} unless they switch languages. Keep tool facts accurate; only translate the wording.`;
}

export type KnownCoupon = {
  code: string;
  description: string;
  percentOff?: number;
  minSubtotal?: number;
  freeShipping?: boolean;
};

/** Demo-only coupons for the custom sandbox store — never invent these on Shopify. */
const DEMO_COUPONS: KnownCoupon[] = [
  {
    code: "BRIDAL10",
    description: "10% off full-price dresses",
    percentOff: 10,
    minSubtotal: 200,
  },
  {
    code: "WELCOME15",
    description: "15% off your first order",
    percentOff: 15,
  },
  {
    code: "FREESHIP",
    description: "Free standard US shipping",
    freeShipping: true,
  },
];

/**
 * Coupons the bot may mention. Priority:
 * 1) Workspace config / `KNOWN_COUPONS_JSON` (merchant or future Agentra)
 * 2) Demo list only when custom sandbox (`allowDemoSandboxData`)
 * 3) Otherwise empty — do not invent store promos
 */
export function getKnownCoupons(): KnownCoupon[] {
  const config = getWorkspaceConfig();
  if (config.commerce.knownCoupons?.length) {
    return config.commerce.knownCoupons;
  }
  if (config.allowDemoSandboxData) return DEMO_COUPONS;
  return [];
}

/** @deprecated use getKnownCoupons() — kept for tests that import the demo list shape */
export const KNOWN_COUPONS = DEMO_COUPONS;
