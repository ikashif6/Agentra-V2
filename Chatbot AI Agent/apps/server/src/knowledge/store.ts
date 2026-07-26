import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";

export interface KnowledgeDoc {
  id: string;
  title: string;
  tags: string[];
  body: string;
}

const DEFAULT_DOCS: KnowledgeDoc[] = [
  {
    id: "shipping",
    title: "Shipping policy",
    tags: ["shipping", "delivery", "timeline"],
    body: "Standard shipping timelines and rates are set by the store. Tracking is typically emailed when an order ships. Ask in chat for an estimate when available — final rates are confirmed at checkout.",
  },
  {
    id: "returns",
    title: "Returns and refunds",
    tags: ["returns", "refunds", "exchange"],
    body: "Return eligibility follows the store’s return policy (window, condition, and excluded items). The chat assistant can check eligibility and start a return for verified eligible orders after confirming details. Refunds go to the original payment method after the return is received, on the store’s stated timeline. The assistant can check refund status but cannot process a new refund — connect with a human agent for that.",
  },
  {
    id: "fulfillment",
    title: "Order packing and fulfillment",
    tags: ["packing", "packed", "fulfillment", "processing", "preparing", "unfulfilled"],
    body: "After payment, orders stay unfulfilled while the warehouse prepares them — that is the Placed stage (not packed yet). Once items are packed, fulfillment moves forward. Tracking appears only after the order ships. Payment status and fulfillment status update separately. Orders can usually be cancelled or have the shipping address changed while still unfulfilled.",
  },
  {
    id: "cancellations",
    title: "Cancellations",
    tags: ["cancel", "cancellation"],
    body: "Orders can usually be cancelled before fulfillment. Once packed or shipped, cancellation is typically not available and a return may be required after delivery.",
  },
  {
    id: "sizing",
    title: "Size and fit",
    tags: ["size", "fit", "sizing"],
    body: "Use the size chart on the product page when available. If you are between sizes, we generally recommend choosing the larger size unless the product notes run large. Share your measurements for a more precise suggestion. Available sizes come from the catalog — ask about a specific product for exact options.",
  },
  {
    id: "care",
    title: "Product care",
    tags: ["care", "cleaning"],
    body: "Follow the care instructions on the product label or product page. When unsure, ask in chat and we can check the listed product details.",
  },
  {
    id: "damaged",
    title: "Damaged or incorrect items",
    tags: ["damaged", "incorrect", "missing"],
    body: "If an item arrives damaged, incorrect, or missing, contact us with your order number and photos when possible. We will arrange a replacement or refund after verification.",
  },
  {
    id: "contact",
    title: "Store contact",
    tags: ["contact", "hours", "support"],
    body: "Support is available by chat during business hours. Outside hours, leave your email or phone and we will follow up. For out-of-stock items, ask to be notified — we’ll collect your email and alert you when the product is back.",
  },
  {
    id: "discounts",
    title: "Discounts and coupons",
    tags: ["discount", "coupon", "promo", "code"],
    body: "Promo codes are applied at checkout. The chat assistant only confirms codes that have been configured for this store — it must never invent discount or coupon codes. If no codes are configured in chat, ask the customer to check the site banner or enter their code at checkout, or offer a human agent for current promotions.",
  },
];

async function loadDocs(workspaceId: string): Promise<KnowledgeDoc[]> {
  const configMode = String(process.env.KNOWLEDGE_MODE || "").toLowerCase();
  const useAgentra =
    configMode === "agentra" ||
    String(process.env.AGENTRA_WORKSPACE_PROVIDER || "").toLowerCase() === "agentra" ||
    String(process.env.COMMERCE_PROVIDER || "").toLowerCase() === "agentra";

  if (useAgentra) {
    try {
      const base = String(process.env.AGENTRA_API_URL || "http://localhost:5000/api/v1").replace(
        /\/$/,
        "",
      );
      const secret = String(
        process.env.CHATBOT_BRIDGE_SECRET || process.env.ENGINE_SHARED_SECRET || "",
      ).trim();
      const res = await fetch(
        `${base}/chatbot-bridge/workspaces/${encodeURIComponent(workspaceId)}/knowledge`,
        {
          headers: {
            Accept: "application/json",
            "x-chatbot-bridge-secret": secret,
          },
        },
      );
      const json = (await res.json().catch(() => ({}))) as {
        data?: { documents?: KnowledgeDoc[] };
      };
      if (res.ok && Array.isArray(json?.data?.documents) && json.data.documents.length) {
        return json.data.documents;
      }
    } catch {
      // fall through to local files
    }
  }

  const file = path.join(env.dataDir, "knowledge", workspaceId, "documents.json");
  try {
    const raw = await fs.readFile(file, "utf8");
    const docs = JSON.parse(raw) as KnowledgeDoc[];
    if (Array.isArray(docs) && docs.length) return docs;
  } catch {
    // seed defaults
  }
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(DEFAULT_DOCS, null, 2));
  return DEFAULT_DOCS;
}

export async function searchKnowledgeBase(
  workspaceId: string,
  query: string,
  limit = 3,
): Promise<KnowledgeDoc[]> {
  const docs = await loadDocs(workspaceId);
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const scored = docs
    .map((doc) => {
      const hay = `${doc.title} ${doc.tags.join(" ")} ${doc.body}`.toLowerCase();
      const score = terms.reduce((acc, t) => {
        if (t.length < 3) return acc;
        return acc + (hay.includes(t) ? 1 : 0);
      }, 0);
      return { doc, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  if (!scored.length && /return|refund|shipping|cancel|size|care|damage|contact|hour|pack|fulfill|process/i.test(query)) {
    return docs
      .filter((d) =>
        /return|refund|shipping|cancel|size|care|damage|contact|hour|pack|fulfill|process/i.test(
          `${d.title} ${d.tags.join(" ")}`,
        ),
      )
      .slice(0, limit);
  }
  return scored.slice(0, limit).map((x) => x.doc);
}
