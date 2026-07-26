import { Router } from "express";
import type { Request, Response } from "express";

export const healthRouter = Router();

/** Public liveness — safe for load balancers and unauthenticated probes. */
healthRouter.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "ecommerce-chatbot",
    time: new Date().toISOString(),
  });
});

function hasDiagnosticsAccess(req: Request, token: string): boolean {
  if (!token) return false;
  const header = String(req.header("x-health-token") || "").trim();
  const query = String(req.query.token || "").trim();
  return header === token || query === token;
}

async function buildDiagnostics() {
  const { env } = await import("../../config/env.js");
  const hasAi =
    (env.aiProvider === "groq" && Boolean(env.groqApiKey)) ||
    (env.aiProvider === "openai" && Boolean(env.openaiApiKey)) ||
    (env.aiProvider === "anthropic" && Boolean(env.anthropicApiKey));

  let shopify: { connected: boolean; shop?: string; source?: string } = {
    connected: false,
  };
  if (env.commerceProvider === "shopify") {
    try {
      const { resolveShopifyAuth } = await import(
        "../../commerce/shopify/connection.js"
      );
      const auth = await resolveShopifyAuth();
      shopify = { connected: true, shop: auth.shop, source: auth.source };
    } catch {
      shopify = { connected: false, shop: env.shopifyShop || undefined };
    }
  }

  return {
    ok: true,
    service: "ecommerce-chatbot",
    time: new Date().toISOString(),
    aiProvider: env.aiProvider,
    aiConfigured: hasAi,
    commerceProvider: env.commerceProvider,
    shopify,
  };
}

/**
 * Internal diagnostics (AI provider, commerce, Shopify).
 * Requires HEALTH_DIAGNOSTICS_TOKEN via `x-health-token` header or `?token=`.
 * If the token is unset, diagnostics stay disabled (401).
 */
healthRouter.get("/health/diagnostics", async (req: Request, res: Response) => {
  const token = String(process.env.HEALTH_DIAGNOSTICS_TOKEN || "").trim();
  if (!hasDiagnosticsAccess(req, token)) {
    res.status(401).json({
      success: false,
      message: "Diagnostics require a valid health token",
    });
    return;
  }
  res.json(await buildDiagnostics());
});
