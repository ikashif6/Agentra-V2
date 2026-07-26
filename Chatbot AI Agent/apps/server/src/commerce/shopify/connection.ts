import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../../config/env.js";

export interface ShopifyConnection {
  shop: string;
  accessToken: string;
  scope?: string;
  obtainedAt: string;
  method: "env" | "oauth" | "client_credentials";
}

function connectionPath() {
  return path.join(env.dataDir, "shopify", "connection.json");
}

export async function loadSavedConnection(): Promise<ShopifyConnection | null> {
  try {
    const raw = await fs.readFile(connectionPath(), "utf8");
    const data = JSON.parse(raw) as ShopifyConnection;
    if (data?.shop && data?.accessToken) return data;
  } catch {
    // none
  }
  return null;
}

export async function saveConnection(
  connection: ShopifyConnection,
): Promise<void> {
  await fs.mkdir(path.dirname(connectionPath()), { recursive: true });
  await fs.writeFile(connectionPath(), JSON.stringify(connection, null, 2));
}

/** Resolve shop + token from env or saved OAuth/client-credentials connection. */
export async function resolveShopifyAuth(): Promise<{
  shop: string;
  accessToken: string;
  source: string;
}> {
  if (env.shopifyShop && env.shopifyAccessToken) {
    return {
      shop: env.shopifyShop,
      accessToken: env.shopifyAccessToken,
      source: "env",
    };
  }

  const saved = await loadSavedConnection();
  if (saved) {
    return {
      shop: saved.shop,
      accessToken: saved.accessToken,
      source: saved.method,
    };
  }

  if (env.shopifyShop && env.shopifyClientId && env.shopifyClientSecret) {
    const token = await tryClientCredentials(env.shopifyShop);
    if (token) {
      await saveConnection({
        shop: env.shopifyShop,
        accessToken: token.access_token,
        scope: token.scope,
        obtainedAt: new Date().toISOString(),
        method: "client_credentials",
      });
      return {
        shop: env.shopifyShop,
        accessToken: token.access_token,
        source: "client_credentials",
      };
    }
  }

  throw new Error(
    "Shopify is not connected. Set SHOPIFY_ADMIN_TOKEN / SHOPIFY_ACCESS_TOKEN, or visit /shopify/install to OAuth-install the app.",
  );
}

async function tryClientCredentials(
  shop: string,
): Promise<{ access_token: string; scope?: string } | null> {
  try {
    const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: env.shopifyClientId,
        client_secret: env.shopifyClientSecret,
        grant_type: "client_credentials",
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.warn(
        `[shopify] client_credentials failed (${res.status}): ${text.slice(0, 180)}`,
      );
      return null;
    }
    return (await res.json()) as { access_token: string; scope?: string };
  } catch (err) {
    console.warn("[shopify] client_credentials error:", err);
    return null;
  }
}

export function buildInstallUrl(shop = env.shopifyShop): string {
  if (!shop || !env.shopifyClientId) {
    throw new Error("SHOPIFY_STORE_DOMAIN and SHOPIFY_CLIENT_ID are required");
  }
  const params = new URLSearchParams({
    client_id: env.shopifyClientId,
    scope: env.shopifyScopes,
    redirect_uri: env.shopifyRedirectUri,
    state: `cb_${Date.now().toString(36)}`,
  });
  return `https://${shop}/admin/oauth/authorize?${params}`;
}

export async function exchangeOAuthCode(input: {
  shop: string;
  code: string;
}): Promise<ShopifyConnection> {
  const res = await fetch(`https://${input.shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: env.shopifyClientId,
      client_secret: env.shopifyClientSecret,
      code: input.code,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OAuth token exchange failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as { access_token: string; scope?: string };
  const connection: ShopifyConnection = {
    shop: input.shop,
    accessToken: data.access_token,
    scope: data.scope,
    obtainedAt: new Date().toISOString(),
    method: "oauth",
  };
  await saveConnection(connection);
  return connection;
}

export async function shopifyAdminFetch<T>(
  apiPath: string,
  init?: RequestInit,
): Promise<T> {
  const auth = await resolveShopifyAuth();
  const res = await fetch(
    `https://${auth.shop}/admin/api/${env.shopifyApiVersion}${apiPath}`,
    {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": auth.accessToken,
        ...(init?.headers || {}),
      },
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}
