import { Router } from "express";
import { env } from "../../config/env.js";
import {
  buildInstallUrl,
  exchangeOAuthCode,
  loadSavedConnection,
  resolveShopifyAuth,
  shopifyAdminFetch,
} from "../../commerce/shopify/connection.js";
import { resetStoreAdapter } from "../../commerce/factory.js";

export const shopifyRouter = Router();

shopifyRouter.get("/install", (req, res) => {
  try {
    const shop = String(req.query.shop || env.shopifyShop || "")
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "");
    if (!shop) {
      res.status(400).send("Missing shop. Use /shopify/install?shop=your-store.myshopify.com");
      return;
    }
    res.redirect(buildInstallUrl(shop));
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : "Install failed");
  }
});

shopifyRouter.get("/callback", async (req, res) => {
  try {
    const shop = String(req.query.shop || "")
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "");
    const code = String(req.query.code || "");
    if (!shop || !code) {
      res.status(400).send("Missing shop or code");
      return;
    }
    await exchangeOAuthCode({ shop, code });
    resetStoreAdapter();
    res.send(
      `<html><body style="font-family:system-ui;padding:40px">
        <h2>Shopify connected</h2>
        <p>Store <strong>${shop}</strong> is linked. You can close this tab and use the chatbot.</p>
        <p><a href="/v1/shopify/status">Check status</a></p>
      </body></html>`,
    );
  } catch (err) {
    res
      .status(500)
      .send(err instanceof Error ? err.message : "OAuth callback failed");
  }
});

shopifyRouter.get("/status", async (_req, res) => {
  try {
    const saved = await loadSavedConnection();
    let live: { ok: boolean; productCount?: number; error?: string } = {
      ok: false,
    };
    try {
      const auth = await resolveShopifyAuth();
      const data = await shopifyAdminFetch<{ products: unknown[] }>(
        "/products.json?limit=1",
      );
      live = { ok: true, productCount: data.products?.length ?? 0 };
      res.json({
        success: true,
        data: {
          shop: auth.shop,
          source: auth.source,
          connected: true,
          live,
          saved: saved
            ? { shop: saved.shop, method: saved.method, obtainedAt: saved.obtainedAt }
            : null,
          hasEnvToken: Boolean(env.shopifyAccessToken),
          hasClientCredentials: Boolean(
            env.shopifyClientId && env.shopifyClientSecret,
          ),
        },
      });
    } catch (err) {
      live = {
        ok: false,
        error: err instanceof Error ? err.message : "Not connected",
      };
      res.json({
        success: true,
        data: {
          shop: env.shopifyShop || null,
          connected: false,
          live,
          saved: saved
            ? { shop: saved.shop, method: saved.method, obtainedAt: saved.obtainedAt }
            : null,
          installUrl: env.shopifyShop
            ? `http://localhost:${env.port}/shopify/install`
            : null,
        },
      });
    }
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : "Status failed",
    });
  }
});
