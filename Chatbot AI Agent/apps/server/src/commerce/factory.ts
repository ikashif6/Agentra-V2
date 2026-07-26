import { env } from "../config/env.js";
import { createCustomAdapter } from "./custom/index.js";
import { createShopifyAdapter } from "./shopify/index.js";
import { createWooCommerceAdapter } from "./woocommerce/index.js";
import { createAgentraAdapter } from "./agentra/index.js";
import type { StoreAdapter } from "./types.js";

let cached: StoreAdapter | null = null;
let cachedKey = "";
const agentraCache = new Map<string, StoreAdapter>();

export function getStoreAdapter(workspaceId?: string): StoreAdapter {
  const provider = String(
    process.env.COMMERCE_PROVIDER || env.commerceProvider || "custom",
  ).toLowerCase();
  const ws = String(workspaceId || env.workspaceId || "default");

  if (provider === "agentra") {
    const hit = agentraCache.get(ws);
    if (hit) return hit;
    const adapter = createAgentraAdapter(ws);
    agentraCache.set(ws, adapter);
    return adapter;
  }

  const key = `${provider}`;
  if (cached && cachedKey === key && cached.provider === provider) return cached;
  cached = null;
  cachedKey = key;
  switch (provider) {
    case "shopify":
      cached = createShopifyAdapter();
      break;
    case "woocommerce":
      cached = createWooCommerceAdapter();
      break;
    default:
      cached = createCustomAdapter();
  }
  return cached;
}

export function resetStoreAdapter() {
  cached = null;
  cachedKey = "";
  agentraCache.clear();
}
