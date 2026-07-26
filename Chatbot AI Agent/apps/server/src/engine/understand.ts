import type {
  ConversationGoal,
  ConversationSlots,
  LastTurnOutcome,
} from "@chatbot/shared";

const GOAL_HINTS: Array<{ goal: ConversationGoal; patterns: RegExp[] }> = [
  { goal: "handoff", patterns: [/talk to (a )?(human|agent|person)/i, /real person/i, /speak to (someone|support)/i] },
  { goal: "policy", patterns: [/policy|policies|how (long|does).*(return|refund|ship)|what.*(return|refund|shipping|cancel).*(policy|work|rule)/i] },
  { goal: "tracking", patterns: [/where.*(order|package|shipment)/i, /\btrack(ing)?\b/i] },
  {
    goal: "payment_issue",
    patterns: [
      /\bpayment (issue|problem|failed|error)\b/i,
      /\bcard (was )?declin/i,
      /\bcharged twice\b/i,
      /\bdouble.?charg/i,
      /\bcan'?t (pay|checkout)\b/i,
      /\bpayment (pending|stuck)\b/i,
    ],
  },
  {
    goal: "discount_help",
    patterns: [
      /\bcoupon\b/i,
      /\bpromo(tion)? code\b/i,
      /\bdiscount code\b/i,
      /\b(any|have).*(discount|promo|coupon)\b/i,
      /\bapply (a )?(code|coupon|discount)\b/i,
    ],
  },
  {
    goal: "shipping_cost",
    patterns: [
      /\bshipping (cost|price|rate|fee)\b/i,
      /\bhow much.*(ship|shipping|delivery)\b/i,
      /\b(cost|price) (of|for) shipping\b/i,
      /\bfree shipping\b/i,
    ],
  },
  {
    goal: "delivery_estimate",
    patterns: [
      /\b(when|eta|estimate).*(arriv|deliver|get here|receive)\b/i,
      /\bdelivery (date|estimate|eta|time)\b/i,
      /\bhow long.*(ship|deliver|arriv)\b/i,
      /\bwhen will (it|my order|my package) (arriv|get|be here|deliver)/i,
    ],
  },
  {
    goal: "lost_delivery",
    patterns: [
      /\blost (package|parcel|shipment|order)\b/i,
      /\bpackage (was |is )?lost\b/i,
      /\btracking says delivered\b/i,
      /\bmarked (as )?delivered but\b/i,
    ],
  },
  {
    goal: "late_delivery",
    patterns: [
      /\blate (delivery|shipment|package|order)\b/i,
      /\b(taking|took) too long\b/i,
      /\bstill (in transit|on the way|not (here|arrived))\b/i,
      /\bdelayed (shipment|delivery|package)\b/i,
      /\bwhere is my (late )?package\b/i,
    ],
  },
  {
    goal: "refund_status",
    patterns: [
      /refund status/i,
      /where('?s| is) my refund/i,
      /when.*(will|does|did).*refund/i,
      /get(ting)? (my )?refund\b/i,
      /\b(did|has|have)\b.{0,40}\brefund/i,
      /\b(was|were)\b.{0,60}\brefunded\b/i,
      /\border\b.{0,40}\brefunded\b/i,
      /\brefund\b.{0,40}\b(done|issued|processed|sent|posted|received|come through|go through|gone through)\b/i,
      /\b(was|were) (i|we) refunded\b/i,
      /\bany (update|news) on (my |the )?refund\b/i,
      /\bcheck (my |the )?refund\b/i,
      /\b(have|has) (my |the )?refund (been )?(issued|processed|sent)\b/i,
      /\bmoney back\b/i,
    ],
  },
  {
    goal: "initiate_refund",
    patterns: [
      /\bi want (a |my )?refund\b/i,
      /\brequest(ing)? (a )?refund\b/i,
      /\b(can|could|please) (i |you )?(get|give|process|issue|do) (me )?(a )?refund\b/i,
      /\brefund (my|this|the) order\b/i,
      /\b(process|issue|initiate) (a |my )?refund\b/i,
      /\bget (me )?refunded\b/i,
    ],
  },
  {
    goal: "exchange_request",
    patterns: [
      /\bexchange\b/i,
      /\bswap (for|to|into)\b/i,
      /\bdifferent (size|color)\b/i,
      /\bwrong size.*(exchange|swap|different)\b/i,
      /\bexchange (for|to) (a )?(different )?(size|color)\b/i,
    ],
  },
  {
    goal: "partial_return",
    patterns: [
      /\bpartial return\b/i,
      /\breturn (just|only) (one|some|this|these|an?)\b/i,
      /\breturn (one|two|some|a few) (of the )?items?\b/i,
      /\breturn (part|portion) of (the |my )?order\b/i,
      /\bnot (the )?whole order\b.*\breturn\b/i,
    ],
  },
  { goal: "return_request", patterns: [/\breturn\b(?! policy)/i, /send(ing)? back/i, /start a return/i] },
  { goal: "cancellation", patterns: [/cancel(ling)? (my )?(order|it)/i, /\bcancel\b/i] },
  { goal: "address_change", patterns: [/change.*(address|shipping)/i, /update.*(address|shipping)/i] },
  { goal: "damaged_item", patterns: [/damaged/i, /broken/i] },
  { goal: "incorrect_item", patterns: [/wrong item/i, /incorrect/i] },
  { goal: "missing_item", patterns: [/missing/i, /didn'?t (receive|get|arrive)/i, /haven'?t received/i, /not received/i, /never (arrived|received)/i] },
  {
    goal: "reorder",
    patterns: [
      /\breorder\b/i,
      /\border (the )?same (thing|items?|products?) again\b/i,
      /\bbuy (it|them|this|that) again\b/i,
      /\border again\b/i,
    ],
  },
  {
    goal: "abandoned_cart",
    patterns: [
      /\babandoned cart\b/i,
      /\b(left|forgot).*(in )?(my )?cart\b/i,
      /\b(finish|complete|resume).*(checkout|cart|purchase)\b/i,
      /\b(my|the) cart (is )?waiting\b/i,
      /\bresend (my |the )?checkout( link)?\b/i,
    ],
  },
  {
    goal: "custom_product_request",
    patterns: [
      /\bcustom (dress|gown|order|product|request|piece)\b/i,
      /\bmade[- ]to[- ]order\b/i,
      /\bbespoke\b/i,
      /\bcustomi[sz]e\b/i,
      /\balteration(s)?\b/i,
      /\bspecial (order|request)\b/i,
    ],
  },
  {
    goal: "product_compare",
    patterns: [
      /\bcompare\b/i,
      /\bvs\.?\b/i,
      /\bdifference between\b/i,
      /\bwhich (is|one('?s)?) better\b/i,
      /\bside[- ]by[- ]side\b/i,
    ],
  },
  {
    goal: "similar_products",
    patterns: [
      /\bsimilar\b/i,
      /\balternatives?\b/i,
      /\blike (this|that|these|it)\b/i,
      /\bsomething (else|similar|like)\b/i,
      /\bother options?\b.*\blike\b/i,
      /\bmore like (this|that)\b/i,
    ],
  },
  {
    goal: "place_order",
    patterns: [
      /\border (this|it|that) for me\b/i,
      /\bbuy (this|it|that|one)\b/i,
      /\bpurchase (this|it|that)\b/i,
      /\b(send|give|share) (me )?(a )?checkout( link)?\b/i,
      /\bcheckout( link)?\b/i,
      /\badd (it|this|that) to (my )?cart\b/i,
      /\bi('?ll| will)? (take|get) (it|this|that)\b/i,
    ],
  },
  { goal: "product_recommend", patterns: [/recommend/i, /suggest/i, /looking for/i, /show me/i, /product recommendation/i] },
  {
    goal: "product_availability",
    patterns: [
      /\b(what|which)\s+colors?\b/i,
      /\bcolors?\s+(do you have|available|are there|come in)\b/i,
      /\bavailable\s+colors?\b/i,
      /\b(what|which)\s+sizes?\b/i,
      /\bsizes?\s+(do you have|available|are there)\b/i,
      /\bin stock\b/i,
      /\bavailability\b/i,
    ],
  },
  { goal: "product_search", patterns: [/search|find.*(dress|veil|product)/i, /do you have|anything in\b|got any/i] },
  {
    goal: "size_fit",
    patterns: [
      /between\s+sizes/i,
      /how (should|do|to|can) (i |we )?(choose|pick|select|find|determine).{0,60}\bsize/i,
      /\b(sizing|size)\s+(guide|advice|help|chart|recommendation)\b/i,
      /what size (should|do) i\b/i,
      /how (does|do|is) (your |the )?(size|sizing|fit)\b/i,
      /\btrue to size\b/i,
      /\bsize up\b|\bsize down\b/i,
      /\b(size|fit|sizing)\b/i,
    ],
  },
  { goal: "order_status", patterns: [/order status/i, /status of (my )?order/i] },
  { goal: "order_lookup", patterns: [/order\s*#?\s*\d+/i, /my order/i] },
  { goal: "store_info", patterns: [/hours|business hours|store (info|location|contact)/i] },
  {
    goal: "back_in_stock",
    patterns: [
      /notify me\b/i,
      /let me know when\b/i,
      /when.*(back in stock|available again|restock)/i,
      /back[- ]?in[- ]?stock/i,
      /waitlist\b/i,
      /out of stock.*(notify|email|tell|alert)/i,
      /(notify|email|alert|remind).*(back|stock|available)/i,
      /remind me when\b/i,
    ],
  },
  { goal: "contact", patterns: [/call me|email me|contact me/i] },
];

function normalizeSize(raw: string): string {
  const s = String(raw || "").trim().toLowerCase();
  if (s === "2xl" || s === "extra extra large") return "xxl";
  if (s === "3xl") return "xxxl";
  if (s === "4xl") return "xxxxl";
  if (s === "extra large" || s === "extra-large") return "xl";
  if (s === "large") return "l";
  if (s === "medium") return "m";
  if (s === "small") return "s";
  if (s === "extra small" || s === "extra-small") return "xs";
  return s;
}

const ORDER_GOALS = new Set<ConversationGoal>([
  "order_lookup",
  "order_status",
  "tracking",
  "return_request",
  "refund_status",
  "initiate_refund",
  "cancellation",
  "address_change",
  "exchange_request",
  "partial_return",
  "late_delivery",
  "lost_delivery",
  "delivery_estimate",
  "reorder",
  "payment_issue",
]);

export function isChitchatAck(message: string): boolean {
  return /^(thanks|thank you|thx|ok|okay|k|cool|great|perfect|got it|alright|nothing|nope|nm|never ?mind|bye|goodbye)[.!]?$/i.test(
    message.trim(),
  );
}

export function isOffTopic(message: string): boolean {
  const m = message.trim();
  if (!m) return false;
  // Prompt injection / internal leakage — not a product ask
  if (
    /\bsystem prompt\b/i.test(m) ||
    /\bignore (your |all )?(previous |prior )?(instructions|rules|prompt)\b/i.test(m) ||
    /\b(jailbreak|dan mode|developer mode)\b/i.test(m) ||
    /\b(reveal|show|print|dump|leak|share)\b.{0,40}\b(system prompt|hidden prompt|instructions|api key|secrets?)\b/i.test(
      m,
    ) ||
    /\b(what|which)\s+(ai\s+)?model\b/i.test(m) ||
    /are you (an? )?(ai|bot|chatgpt|gpt|claude|groq)/i.test(m) ||
    /who (made|built|trained) you/i.test(m) ||
    /\b(openai|anthropic|groq|llm)\b/i.test(m)
  ) {
    return true;
  }
  if (
    /\b(weather|temperature|forecast|stock market|bitcoin|crypto|lottery|joke|riddle|poem|homework|math problem)\b/i.test(
      m,
    )
  ) {
    return true;
  }
  if (
    /\b(who (will|wins)|sports score|football|nba|nfl|cricket match)\b/i.test(m) &&
    !/\border|return|ship|product|dress|store\b/i.test(m)
  ) {
    return true;
  }
  return false;
}

/** Customer wants the lookup form shown again. */
export function wantsRetryForm(message: string): boolean {
  return /^(show( it)? again|try again|show (the )?form|look ?up again|another (try|order)|retry)\b/i.test(
    message.trim(),
  );
}

/** “yes / sure / ok” after we offered to try the lookup again. */
export function acceptsRetryAfterFailure(
  message: string,
  last?: LastTurnOutcome | null,
): boolean {
  if (!last) return false;
  const m = message.trim();
  if (
    !/^(yes|yeah|yep|yup|sure|ok|okay|please|alright|go ahead|try( again)?|let'?s try)([.!])?$/i.test(
      m,
    )
  ) {
    return false;
  }
  if (last.type === "order_not_found" || last.type === "tool_error") return true;
  if (
    last.type === "clarify" &&
    /couldn.?t match|no matching|not found|try again|different details|email/i.test(
      last.summary || "",
    )
  ) {
    return true;
  }
  return false;
}

export function wantsLookupRetry(
  message: string,
  last?: LastTurnOutcome | null,
): boolean {
  return wantsRetryForm(message) || acceptsRetryAfterFailure(message, last);
}

/** Asking about a previous failure (e.g. “is that not correct?”). */
export function isAboutLastFailure(
  message: string,
  last?: LastTurnOutcome | null,
): boolean {
  if (!last || (last.type !== "order_not_found" && last.type !== "tool_error")) {
    return false;
  }
  const m = message.trim();
  if (wantsLookupRetry(m, last) || looksLikeOrderToolAction(m)) return false;
  return (
    /^(is (it|that|this) )?(not )?correct\??$/i.test(m) ||
    /^(why|what|huh|really)\??$/i.test(m) ||
    /\b(wrong|incorrect|match|matching|not found|failed|error|email|number)\b/i.test(m)
  );
}

/**
 * Specific product-attribute ask (material, colors, sizes, etc.).
 */
export function detectProductAttributeAsk(
  message: string,
): "material" | "colors" | "sizes" | "details" | null {
  const m = message.trim();
  if (!m) return null;
  const claim = detectProductAvailabilityClaim(m);
  if (claim?.facet === "color") return "colors";
  if (claim?.facet === "size") return "sizes";
  if (
    /\b(material|fabric|composition|textile|made (of|from)|what('s| is) it made)\b/i.test(m) ||
    /\b(what|which)\s+material\b/i.test(m)
  ) {
    return "material";
  }
  if (
    /\b(what|which)\s+colors?\b/i.test(m) ||
    /\bcolors?\s+(do you have|available|are there|come in)\b/i.test(m) ||
    /\bavailable\s+colors?\b/i.test(m)
  ) {
    return "colors";
  }
  if (
    /\b(what|which)\s+sizes?\b/i.test(m) ||
    /\bsizes?\s+(do you have|available|are there)\b/i.test(m)
  ) {
    return "sizes";
  }
  if (
    /\b(tell me more|more details|product details|what about (it|this|that)|describe (it|this|that)|\bspecs?\b)/i.test(
      m,
    )
  ) {
    return "details";
  }
  return null;
}

const COLOR_WORDS =
  "white|ivory|blush|champagne|cream|beige|pearl|black|red|blue|pink|gold|silver|nude|taupe|sage|emerald|navy|burgundy|rose|lavender|lilac|mint|grey|gray|brown|green|purple|yellow|orange|coral|teal|aqua|mocha|nude|off[- ]?white|offwhite";

/**
 * Customer claims a color/size is missing (or asks if it has it) — must verify via catalog, never agree blindly.
 */
export function detectProductAvailabilityClaim(message: string): {
  facet: "color" | "size";
  value: string;
  assertsMissing: boolean;
} | null {
  const m = message.trim();
  if (!m) return null;

  const sizeMissing =
    m.match(
      new RegExp(
        `\\b(?:doesn'?t|does not|don'?t|do not)\\s+have\\s+(size\\s+)?(xxxl|xxl|xl|xs|s|m|l|\\d{1,2})\\b`,
        "i",
      ),
    ) ||
    m.match(
      new RegExp(
        `\\bno\\s+(size\\s+)?(xxxl|xxl|xl|xs|s|m|l|\\d{1,2})\\b`,
        "i",
      ),
    ) ||
    m.match(
      new RegExp(
        `\\b(?:isn'?t|is not|not)\\s+(?:available\\s+)?(?:in\\s+)?(size\\s+)?(xxxl|xxl|xl|xs|s|m|l|\\d{1,2})\\b`,
        "i",
      ),
    );
  if (sizeMissing) {
    const value = String(sizeMissing[2] || sizeMissing[1] || "").trim();
    if (value) return { facet: "size", value: value.toLowerCase(), assertsMissing: true };
  }

  const colorMissing =
    m.match(
      new RegExp(
        `\\b(?:doesn'?t|does not|don'?t|do not)\\s+have\\s+(${COLOR_WORDS})\\b`,
        "i",
      ),
    ) ||
    m.match(new RegExp(`\\bno\\s+(${COLOR_WORDS})\\b`, "i")) ||
    m.match(
      new RegExp(
        `\\b(?:isn'?t|is not|not)\\s+(?:available\\s+)?(?:in\\s+)?(${COLOR_WORDS})\\b`,
        "i",
      ),
    ) ||
    m.match(
      new RegExp(
        `\\b(?:without|missing)\\s+(${COLOR_WORDS})\\b`,
        "i",
      ),
    ) ||
    m.match(
      new RegExp(
        `\\b(${COLOR_WORDS})\\s+(?:isn'?t|is not|not)\\s+(?:an?\\s+)?(?:option|available|listed)\\b`,
        "i",
      ),
    );
  if (colorMissing) {
    return {
      facet: "color",
      value: String(colorMissing[1]).toLowerCase().replace(/\s+/g, " ").trim(),
      assertsMissing: true,
    };
  }

  // “does it come in white?” / “is white available?”
  const colorAsk =
    m.match(
      new RegExp(
        `\\b(?:come|comes|available|have|has|in)\\s+(?:in\\s+)?(${COLOR_WORDS})\\b`,
        "i",
      ),
    ) ||
    m.match(new RegExp(`\\bis\\s+(${COLOR_WORDS})\\s+available\\b`, "i"));
  if (
    colorAsk &&
    /\b(come|comes|available|have|has|does|is|in)\b/i.test(m) &&
    /\?/u.test(m)
  ) {
    return {
      facet: "color",
      value: String(colorAsk[1]).toLowerCase().replace(/\s+/g, " ").trim(),
      assertsMissing: false,
    };
  }

  return null;
}

export function isProductAttributeQuestion(message: string): boolean {
  return detectProductAttributeAsk(message) != null;
}

/**
 * General sizing advice (between sizes, how to choose a size) — not a follow-up
 * about colors/sizes of a previously shown product.
 */
export function isSizeFitGuidanceAsk(message: string): boolean {
  const m = message.trim();
  if (!m) return false;
  if (/between\s+sizes/i.test(m)) return true;
  if (
    /how (should|do|to|can) (i |we )?(choose|pick|select|find|determine).{0,60}\bsize/i.test(
      m,
    )
  ) {
    return true;
  }
  if (/\b(sizing|size)\s+(guide|advice|help|chart|recommendation)\b/i.test(m)) {
    return true;
  }
  if (/what size (should|do) i\b/i.test(m)) return true;
  if (/if i('?m| am) between/i.test(m) && /\bsize/i.test(m)) return true;
  if (/how (does|do|is) (your |the )?(size|sizing|fit)\b/i.test(m)) return true;
  if (
    /\b(true to size|size up|size down)\b/i.test(m) &&
    !/\b(this|that|the)\s+(first|second|third|one|dress|gown|veil|product)\b/i.test(m)
  ) {
    return true;
  }
  return false;
}

/**
 * Asking for another customer's / unverified third-party order data.
 */
export function isCrossCustomerOrderAsk(message: string): boolean {
  const m = message.trim();
  if (!m) return false;
  if (
    /\b(another|other|someone else'?s?|somebody else'?s?|a different)\s+customer'?s?\b/i.test(
      m,
    )
  ) {
    return true;
  }
  if (
    /\b(another|other|someone else'?s?|somebody else'?s?)\s+(person'?s?|people'?s?|buyer'?s?|shopper'?s?)\s+order/i.test(
      m,
    )
  ) {
    return true;
  }
  if (/\border\s+(for|of)\s+(another|other|someone else)/i.test(m)) return true;
  if (
    /\b(not mine|isn'?t mine|isnt mine|someone else'?s|another (person|customer))\b/i.test(
      m,
    ) &&
    /\border\b/i.test(m)
  ) {
    return true;
  }
  if (
    /\border\b/i.test(m) &&
    /\bwithout\s+(verif|authenticat|proving|their email|the email)/i.test(m)
  ) {
    return true;
  }
  return false;
}

export function crossCustomerOrderReply(): string {
  return "I can’t access or share another customer’s order information. Order details require verification using the order number and the associated email or phone number used at checkout. If this is your order, share those details and I’ll look it up.";
}

export function isProductFollowUp(message: string): boolean {
  const m = message.trim();
  if (!m) return false;
  // General sizing guidance must not attach to the last recommended product
  if (isSizeFitGuidanceAsk(m)) return false;
  if (isProductAttributeQuestion(m) || detectProductAvailabilityClaim(m)) return true;
  if (
    /\b(what|which)\s+colors?\b/i.test(m) ||
    /\bcolors?\s+(do you have|available|are there|come in)\b/i.test(m) ||
    /\bavailable\s+colors?\b/i.test(m) ||
    /\b(what|which)\s+sizes?\b/i.test(m) ||
    /\bsizes?\s+(do you have|available|are there)\b/i.test(m) ||
    /\bin\s+(stock|what colors?|which colors?)\b/i.test(m)
  ) {
    return true;
  }
  if (
    /\b(that|this|the)\s+(first|second|third|1st|2nd|3rd|last|other)?\s*(one|dress|veil|gown|product|option|item)\b/i.test(
      m,
    ) ||
    /\b(first|second|third|1st|2nd|3rd)\s+(one|dress|veil|gown|product|option)\b/i.test(m)
  ) {
    return true;
  }
  if (
    /\b(dress|veil|gown|product|option|recommendation)\b/i.test(m) &&
    /\b(color|size|price|available|stock|buy|order this|tell me more|details|material|fabric)\b/i.test(
      m,
    )
  ) {
    return true;
  }
  return false;
}

/** Resolve “the first one” / “second product” to a 0-based index. */
export function resolveProductIndex(message: string): number | null {
  const m = message.trim();
  if (/\b(first|1st)\b/i.test(m) || /\bthat first one\b/i.test(m)) return 0;
  if (/\b(second|2nd)\b/i.test(m)) return 1;
  if (/\b(third|3rd)\b/i.test(m)) return 2;
  if (/\b(last|other)\s+one\b/i.test(m)) return -1;
  if (/\b(that|this)\s+one\b/i.test(m)) return 0;
  return null;
}

export function isOrderClarifyFollowUp(
  message: string,
  opts?: { hasVerifiedOrder?: boolean },
): boolean {
  const m = message.trim();
  if (!m) return false;
  if (wantsOrderCardAgain(m) || wantsRetryForm(m)) return false;
  // Product questions must never be treated as order clarifications
  if (isProductFollowUp(m)) return false;

  // Bare follow-ups when we already have an order on the table
  if (
    opts?.hasVerifiedOrder &&
    /^(why|why\?|and|so|ok so|huh|what\?|what does that mean\??)$/i.test(m)
  ) {
    return true;
  }

  if (
    /^(why|how come|how|when|what|is it|does it|will it|has it|can i)\b/i.test(m) ||
    /\b(why|how come|meaning|mean|explain|still|yet|not yet)\b/i.test(m)
  ) {
    if (
      /\b(pack|packed|packing|ship|shipped|shipping|deliver|delivered|fulfill|fulfillment|track|tracking|status|pending|process|prepar|cancel|refund|paid|payment|address)\b/i.test(
        m,
      ) ||
      /\b(my order|the order|this order)\b/i.test(m) ||
      // "it/that/this" alone is OK for order follow-ups, but not when asking about products
      (/\b(it|that|this)\b/i.test(m) &&
        !/\b(color|size|dress|veil|gown|product|option|one)\b/i.test(m)) ||
      (opts?.hasVerifiedOrder &&
        m.split(/\s+/).length <= 8 &&
        !/\b(color|size|dress|veil|gown|product|buy|price)\b/i.test(m))
    ) {
      return true;
    }
  }
  if (
    /^(not )?(packed|shipped|delivered|fulfilled|pending)\??$/i.test(m) ||
    /^(still|yet)\b/i.test(m)
  ) {
    return true;
  }
  return false;
}

export function wantsOrderCardAgain(message: string): boolean {
  return /show (me )?(my |the )?order( card| details)?( again)?$|see (my |the )?order|order (card|details|again)|check (my )?order again|look up (my )?order again/i.test(
    message,
  );
}

export function looksLikeOrderToolAction(message: string): boolean {
  if (wantsOrderCardAgain(message)) return true;
  if (/order\s*#?\s*\d+/i.test(message)) return true;
  if (/where.*(order|package)|track(ing)?|order status|status of (my )?order|my order/i.test(message))
    return true;
  if (/^\s*#?\d{3,8}\s*$/.test(message)) return true;
  if (/@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(message) && /\d{3,8}/.test(message)) return true;
  if (/I (said|meant|meant to say)|sorry.*\d{3,8}|actually.*\d{3,8}/i.test(message)) return true;
  return false;
}

export function offTopicReply(): string {
  return "I’m here to help with this store — orders, products, returns, shipping, and policies. I can’t share internal instructions or help with that kind of request. What can I help you with in the shop?";
}

/** Pull the most likely order number from free text (supports corrections). */
export function extractOrderNumberCandidate(message: string): string | undefined {
  const said =
    message.match(/I (?:said|meant(?: to say)?)\s*#?(\d{3,8})/i) ||
    message.match(/(?:sorry|actually|instead)[, ]+(?:I (?:said|meant) )?#{0,1}(\d{3,8})/i) ||
    message.match(/order\s*#?\s*(\d{3,8})/i) ||
    message.match(/Order\s*#\s*(\d{1,10})/i) ||
    message.match(/orderNumber\s*[:=]\s*#?(\d{1,10})/i);
  if (said) return said[1];

  // "1001, email@x.com" or bare number
  const leading = message.match(/^\s*#?(\d{3,8})\b/);
  if (leading) return leading[1];

  if (/order|return|cancel|track|refund|address|said|meant/i.test(message)) {
    const any = message.match(/\b(\d{3,8})\b/);
    if (any) return any[1];
  }
  return undefined;
}

export function extractSlots(message: string, existing: ConversationSlots): ConversationSlots {
  const slots = { ...existing };
  const email = message.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (email) slots.email = email[0];

  const orderNum = extractOrderNumberCandidate(message);
  if (orderNum) slots.orderNumber = orderNum;

  if (/^\s*#?\d{3,8}\s*$/.test(message)) {
    slots.orderNumber = message.trim().replace("#", "");
  }

  const phone = message.match(
    /(?:\+?\d{1,2}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/,
  );
  if (phone && phone[0].replace(/\D/g, "").length >= 10) {
    slots.phone = phone[0];
  }

  const budget =
    message.match(/\$\s?(\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?\b/) ||
    message.match(/\$\s?(\d{2,7})(?:\.\d{1,2})?\b/) ||
    message.match(/\b(\d{1,3})\s*k\b(?:\s*(?:budget|max|maximum|limit))?/i) ||
    message.match(/\b(?:budget|max(?:imum)?(?:\s*budget)?|under|upto|up to)\s*(?:is\s*|of\s*)?\$?\s*(\d{1,3})\s*k\b/i) ||
    message.match(/\b(?:budget|max(?:imum)?(?:\s*budget)?|under|upto|up to)\s*(?:is\s*|of\s*)?\$?\s*(\d{2,7})\b/i);
  if (budget) {
    let amount = budget[1].replace(/,/g, "");
    if (/k\b/i.test(budget[0]) && Number(amount) < 1000) {
      amount = String(Number(amount) * 1000);
    }
    if (Number.isFinite(Number(amount)) && Number(amount) > 0) slots.budget = amount;
  }

  const sizeToken =
    "(?:xxxxl|xxxl|xxl|xs|s|m|l|xl|2xl|3xl|4xl|[0-9]{1,2}|extra\\s*-?\\s*extra\\s*-?\\s*large|extra\\s*-?\\s*large|extra\\s*-?\\s*small|large|medium|small)";
  const size =
    message.match(new RegExp(`\\bsize\\s*(?:is\\s*|[=:]\\s*)?(${sizeToken})\\b`, "i")) ||
    message.match(new RegExp(`\\bin\\s+(${sizeToken})\\b`, "i")) ||
    message.match(new RegExp(`\\b(${sizeToken})\\s*-?\\s*size\\b`, "i")) ||
    message.match(new RegExp(`^\\s*(${sizeToken})\\s*[.!?]*\\s*$`, "i"));
  if (size) slots.size = normalizeSize(size[1]);

  const colorWord =
    "(?:ivory|white|champagne|black|blush|pearl|gold|silver|cream|beige|nude|red|navy|pink|blue|green|rose|taupe|mocha)";
  const colorMatches = [
    ...message.matchAll(new RegExp(`\\b(${colorWord})\\b`, "gi")),
  ].map((m) => m[1].toLowerCase());
  if (colorMatches.length) {
    slots.color = [...new Set(colorMatches)].join(",");
  }

  if (/\b(dresses|dress|gowns|gown)\b/i.test(message)) slots.productType = "dress";
  if (/\bveils?\b/i.test(message)) slots.productType = "veil";
  if (/\b(accessor(?:y|ies)|hair vines?)\b/i.test(message)) slots.productType = "accessory";
  if (/\blace\b/i.test(message)) slots.material = "lace";
  if (/\bsatin\b/i.test(message)) slots.material = "satin";
  if (/\bcrepe\b/i.test(message)) slots.material = "crepe";
  if (/\b(ballgown|a-?line|sheath|fitted|minimal)\b/i.test(message)) {
    slots.style = message
      .match(/\b(ballgown|a-?line|sheath|fitted|minimal)\b/i)?.[1]
      ?.toLowerCase();
  }

  // New product prefs without a size → don't keep an old size filter stuck
  const touchedProductPrefs =
    Boolean(colorMatches.length) ||
    /\b(dresses|dress|gowns|gown|veils?|accessor(?:y|ies)|hair vines?|lace|satin|crepe|ballgown|a-?line|sheath|fitted|minimal)\b/i.test(
      message,
    ) ||
    Boolean(budget);
  if (touchedProductPrefs && !size) {
    delete slots.size;
  }

  const addr1 =
    message.match(/Address(?:\s*1)?\s*:\s*(.+)/i) ||
    message.match(/address1\s*[:=]\s*(.+)/i) ||
    message.match(/street(?: address)?\s*[:=]\s*(.+)/i) ||
    message.match(/new address is[, ]+([^,\n]+)/i);
  if (addr1) slots.addressLine1 = addr1[1].trim();

  const addr2 = message.match(/Address\s*2\s*:\s*(.+)/i);
  if (addr2) slots.addressLine2 = addr2[1].trim();

  const city =
    message.match(/City\s*:\s*(.+)/i) ||
    message.match(/city is\s+([^,\n]+)/i);
  if (city) slots.city = city[1].trim();

  const state = message.match(/(?:State|Province)\s*:\s*(.+)/i);
  if (state) slots.state = state[1].trim();

  const zip =
    message.match(/(?:ZIP|Postal(?:\s*\/\s*ZIP)?(?:\s*code)?)\s*:\s*(\S+)/i) ||
    message.match(/postal(?:\s*code)?\s*(?:is\s+)?(\d{4,10})/i);
  if (zip) slots.zip = zip[1].trim();

  const country =
    message.match(/Country\s*:\s*([A-Za-z]{2,})/i) ||
    message.match(/\bcountry\s*(?:is\s+)?([A-Za-z]{2,})\b/i);
  if (country) slots.country = country[1].trim().toUpperCase();

  const returnReasonField = message.match(/returnReason\s*[:=]\s*(.+)/i);
  if (returnReasonField) slots.returnReason = returnReasonField[1].trim();

  const exchangeReasonField = message.match(/exchangeReason\s*[:=]\s*(.+)/i);
  if (exchangeReasonField) slots.exchangeReason = exchangeReasonField[1].trim();

  const partialItemsField = message.match(/partialReturnItems\s*[:=]\s*(.+)/i);
  if (partialItemsField) slots.partialReturnItems = partialItemsField[1].trim();

  const customDescField = message.match(/customRequestDescription\s*[:=]\s*(.+)/i);
  if (customDescField) slots.customRequestDescription = customDescField[1].trim();

  const desiredSizeField = message.match(/desiredSize\s*[:=]\s*(.+)/i);
  if (desiredSizeField) slots.desiredSize = desiredSizeField[1].trim();

  const desiredColorField = message.match(/desiredColor\s*[:=]\s*(.+)/i);
  if (desiredColorField) slots.desiredColor = desiredColorField[1].trim();

  const issueField = message.match(/issueDescription\s*[:=]\s*(.+)/i);
  if (issueField) slots.issueDescription = issueField[1].trim();

  // Widget forms often serialize as `field: value` lines — capture known slots
  for (const line of message.split(/\r?\n/)) {
    const kv = line.match(
      /^\s*(orderNumber|email|phone|returnReason|exchangeReason|partialReturnItems|partialReturnReason|customRequestDescription|desiredSize|desiredColor|issueDescription|addressLine1|addressLine2|address1|city|state|zip|country|name|budget|size|color)\s*[:=]\s*(.+)\s*$/i,
    );
    if (!kv) continue;
    const key = kv[1].toLowerCase();
    const value = kv[2].trim();
    if (!value) continue;
    if (key === "address1") slots.addressLine1 = value;
    else if (key === "name") slots.name = value;
    else if (key === "returnreason") slots.returnReason = value;
    else if (key === "exchangereason") slots.exchangeReason = value;
    else if (key === "partialreturnitems") slots.partialReturnItems = value;
    else if (key === "partialreturnreason") slots.partialReturnReason = value;
    else if (key === "customrequestdescription") slots.customRequestDescription = value;
    else if (key === "desiredsize") slots.desiredSize = value;
    else if (key === "desiredcolor") slots.desiredColor = value;
    else if (key === "issuedescription") slots.issueDescription = value;
    else slots[key] = value;
  }

  return slots;
}

/** Short acks that should not be treated as an issue description. */
export function isBareAck(message: string): boolean {
  return /^(yes|yeah|yep|yup|sure|ok|okay|please|alright|go ahead|no|nope|nah|thanks|thank you)[.!]?$/i.test(
    message.trim(),
  );
}

/**
 * Pull an issue description from free text (or form serialization)
 * when the customer is reporting damage / missing / incorrect items.
 */
export function extractIssueDescription(
  message: string,
  existing?: string,
  opts?: { allowFreeText?: boolean },
): string | undefined {
  if (existing && existing.trim()) return existing.trim();
  const m = String(message || "").trim();
  if (!m) return undefined;

  const fromField = m.match(/issueDescription\s*[:=]\s*(.+)/i);
  if (fromField?.[1]?.trim()) return fromField[1].trim();

  if (isBareAck(m)) return undefined;

  // Explicit issue language — always capture
  if (
    /\b(missing|damaged|broken|incorrect|wrong item|didn'?t (receive|get|arrive)|haven'?t received|never (arrived|received)|not received|empty (box|package)|incomplete)\b/i.test(
      m,
    )
  ) {
    return m.slice(0, 500);
  }

  // Free-text reply after we already asked for the description
  if (
    opts?.allowFreeText &&
    m.length >= 4 &&
    !/^order\s*#?\s*\d+/i.test(m) &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m) &&
    !/orderNumber\s*[:=]|^\s*#?\d{3,8}\s*,/i.test(m)
  ) {
    return m.slice(0, 500);
  }

  return undefined;
}

/**
 * Pull a return/exchange reason from free text when the customer is in that flow.
 */
export function extractReturnReason(
  message: string,
  existing?: string,
  opts?: { allowFreeText?: boolean },
): string | undefined {
  if (existing && String(existing).trim()) return existing;
  const m = String(message || "").trim();
  if (!m || isBareAck(m)) return undefined;

  const field = m.match(/returnReason\s*[:=]\s*(.+)/i);
  if (field?.[1]?.trim()) return field[1].trim().slice(0, 500);

  const exchangeField = m.match(/exchangeReason\s*[:=]\s*(.+)/i);
  if (exchangeField?.[1]?.trim()) return exchangeField[1].trim().slice(0, 500);

  if (
    opts?.allowFreeText &&
    m.length >= 3 &&
    !/^order\s*#?\s*\d+/i.test(m) &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m) &&
    !/orderNumber\s*[:=]|^\s*#?\d{3,8}\s*,/i.test(m) &&
    !/^(yes|yeah|yep|yup|sure|ok|okay|please|alright|go ahead|confirm|create the return|start the return)\b/i.test(
      m,
    )
  ) {
    return m.slice(0, 500);
  }

  return undefined;
}

export function isDamageRelatedGoal(goal: string): boolean {
  return goal === "damaged_item" || goal === "incorrect_item" || goal === "missing_item";
}

export function inferGoal(
  message: string,
  previousGoal: ConversationGoal,
  opts?: { hasVerifiedOrder?: boolean; lastOutcome?: LastTurnOutcome | null },
): ConversationGoal {
  // Off-topic / injection first — never let “show me …” steal product_recommend
  if (isOffTopic(message)) {
    return "general";
  }
  // Privacy: never let “show me …” become product_recommend for someone else’s order
  if (isCrossCustomerOrderAsk(message)) {
    return "order_lookup";
  }
  if (isSizeFitGuidanceAsk(message)) {
    return "size_fit";
  }
  for (const hint of GOAL_HINTS) {
    if (hint.patterns.some((re) => re.test(message))) {
      return hint.goal;
    }
  }
  if (isChitchatAck(message)) {
    return "general";
  }
  if (wantsRetryForm(message) || isAboutLastFailure(message, opts?.lastOutcome)) {
    return previousGoal && ORDER_GOALS.has(previousGoal) ? previousGoal : "order_lookup";
  }
  if (acceptsRetryAfterFailure(message, opts?.lastOutcome)) {
    return "order_lookup";
  }
  if (
    isOrderClarifyFollowUp(message, { hasVerifiedOrder: opts?.hasVerifiedOrder }) &&
    (ORDER_GOALS.has(previousGoal) || opts?.hasVerifiedOrder)
  ) {
    return previousGoal === "order_lookup" || previousGoal === "general"
      ? "order_status"
      : previousGoal;
  }
  if (/actually[, ]|instead|never ?mind|switch|I (said|meant)/i.test(message)) {
    for (const hint of GOAL_HINTS) {
      if (hint.patterns.some((re) => re.test(message))) return hint.goal;
    }
    if (extractOrderNumberCandidate(message)) return "order_lookup";
    return "general";
  }
  return previousGoal || "general";
}

export function understandMessage(input: {
  message: string;
  slots: ConversationSlots;
  goal: ConversationGoal;
  hasVerifiedOrder?: boolean;
  lastOutcome?: LastTurnOutcome | null;
  verifiedOrderNumber?: string | null;
}): {
  goal: ConversationGoal;
  slots: ConversationSlots;
  switchedTopic: boolean;
  isClarifyFollowUp: boolean;
  isOffTopic: boolean;
  isCrossCustomerPrivacyAsk: boolean;
  wantsOrderCardAgain: boolean;
  wantsRetryForm: boolean;
  isAboutLastFailure: boolean;
  orderNumberChanged: boolean;
  identityChanged: boolean;
} {
  const prevOrder = input.slots.orderNumber || input.verifiedOrderNumber || undefined;
  const prevEmail = input.slots.email;
  const slots = extractSlots(input.message, input.slots);
  const allowFreeTextIssue =
    isDamageRelatedGoal(input.goal) ||
    (input.lastOutcome?.type === "form_shown" &&
      /issueDescription|issue|report|damage/i.test(input.lastOutcome.summary || ""));
  // Capture descriptions from form dumps (`issueDescription: …`) and free-text
  // replies while already in a damage/missing/incorrect flow.
  {
    const desc = extractIssueDescription(input.message, slots.issueDescription, {
      allowFreeText: allowFreeTextIssue,
    });
    if (desc) slots.issueDescription = desc;
  }

  const orderNumberChanged = Boolean(
    slots.orderNumber && prevOrder && slots.orderNumber !== prevOrder,
  );
  const identityChanged = Boolean(
    (slots.email && prevEmail && slots.email.toLowerCase() !== prevEmail.toLowerCase()) ||
      orderNumberChanged,
  );

  const offTopic = isOffTopic(input.message);
  const crossCustomerPrivacy = isCrossCustomerOrderAsk(input.message);
  const clarify =
    Boolean(input.hasVerifiedOrder) &&
    !identityChanged &&
    isOrderClarifyFollowUp(input.message, {
      hasVerifiedOrder: input.hasVerifiedOrder,
    });
  const cardAgain = wantsOrderCardAgain(input.message);
  const retryForm = wantsLookupRetry(input.message, input.lastOutcome);
  const aboutFail = isAboutLastFailure(input.message, input.lastOutcome);

  const sizeFitGuidance = isSizeFitGuidanceAsk(input.message);
  const productFollowUp = isProductFollowUp(input.message);
  let goal = inferGoal(input.message, input.goal, {
    hasVerifiedOrder: input.hasVerifiedOrder && !identityChanged,
    lastOutcome: input.lastOutcome,
  });
  // Color/size questions about shown products override sticky order goals —
  // but never override sizing guidance, policies, or privacy refusals.
  if (
    productFollowUp &&
    !sizeFitGuidance &&
    !crossCustomerPrivacy &&
    ![
      "product_recommend",
      "product_search",
      "product_availability",
      "place_order",
      "size_fit",
      "policy",
      "store_info",
    ].includes(goal)
  ) {
    goal = "product_availability";
  }
  if (sizeFitGuidance) goal = "size_fit";
  if (crossCustomerPrivacy) goal = "order_lookup";

  // Free-text return/exchange reason after we asked for it
  const allowFreeTextReturn =
    goal === "return_request" ||
    goal === "exchange_request" ||
    goal === "partial_return" ||
    input.goal === "return_request" ||
    input.goal === "exchange_request" ||
    input.goal === "partial_return" ||
    (input.lastOutcome?.type === "form_shown" &&
      /returnReason|exchangeReason|return reason|exchange/i.test(
        input.lastOutcome.summary || "",
      ));
  if (allowFreeTextReturn) {
    if (goal === "exchange_request" || input.goal === "exchange_request") {
      const reason = extractReturnReason(input.message, slots.exchangeReason || slots.returnReason, {
        allowFreeText: true,
      });
      if (reason) {
        slots.exchangeReason = reason;
        if (!slots.returnReason) slots.returnReason = reason;
      }
    } else {
      const reason = extractReturnReason(input.message, slots.returnReason, {
        allowFreeText: true,
      });
      if (reason) slots.returnReason = reason;
    }
  }

  if (/^\s*#?\d{3,8}\s*$/.test(input.message) && !slots.orderNumber) {
    slots.orderNumber = input.message.trim().replace("#", "");
  }

  const switchedTopic =
    (goal !== input.goal && goal !== "general") ||
    (ORDER_GOALS.has(input.goal) && goal === "general") ||
    (input.goal !== "general" && offTopic) ||
    identityChanged ||
    (productFollowUp && ORDER_GOALS.has(input.goal));

  return {
    goal,
    slots,
    switchedTopic,
    isClarifyFollowUp:
      clarify &&
      !cardAgain &&
      !retryForm &&
      !productFollowUp &&
      !["product_recommend", "product_search", "product_availability", "place_order"].includes(
        goal,
      ),
    isOffTopic: offTopic,
    isCrossCustomerPrivacyAsk: crossCustomerPrivacy,
    wantsOrderCardAgain: cardAgain,
    wantsRetryForm: retryForm,
    isAboutLastFailure: aboutFail,
    orderNumberChanged,
    identityChanged,
  };
}
