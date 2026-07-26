import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

function req(name: string, fallback = ""): string {
  return process.env[name]?.trim() || fallback;
}

function first(...names: string[]): string {
  for (const name of names) {
    const v = process.env[name]?.trim();
    if (v) return v;
  }
  return "";
}

function bool(name: string, fallback = false): boolean {
  const v = process.env[name];
  if (v == null || v === "") return fallback;
  return ["1", "true", "yes", "on"].includes(v.toLowerCase());
}

function normalizeShop(shop: string): string {
  return shop
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")
    .replace(/\/admin.*/, "");
}

export const env = {
  port: Number(req("PORT", "5600")),
  host: req("HOST", "0.0.0.0"),
  workspaceId: req("WORKSPACE_ID", "default"),
  nodeEnv: req("NODE_ENV", "development"),
  aiProvider: req("AI_PROVIDER", "groq") as "groq" | "openai" | "anthropic",
  groqApiKey: req("GROQ_API_KEY"),
  groqModel: req("GROQ_MODEL", "llama-3.3-70b-versatile"),
  openaiApiKey: req("OPENAI_API_KEY"),
  openaiModel: req("OPENAI_MODEL", "gpt-4o-mini"),
  anthropicApiKey: req("ANTHROPIC_API_KEY"),
  anthropicModel: req("ANTHROPIC_MODEL", "claude-sonnet-4-20250514"),
  commerceProvider: req("COMMERCE_PROVIDER", "custom") as
    | "custom"
    | "shopify"
    | "woocommerce"
    | "agentra",
  shopifyShop: normalizeShop(
    first("SHOPIFY_SHOP", "SHOPIFY_STORE_DOMAIN"),
  ),
  shopifyAccessToken: first(
    "SHOPIFY_ACCESS_TOKEN",
    "SHOPIFY_ADMIN_TOKEN",
  ),
  shopifyApiVersion: req("SHOPIFY_API_VERSION", "2024-10"),
  shopifyAllowWrites: bool("SHOPIFY_ALLOW_WRITES", false),
  shopifyClientId: first("SHOPIFY_CLIENT_ID", "SHOPIFY_API_KEY"),
  shopifyClientSecret: first("SHOPIFY_CLIENT_SECRET", "SHOPIFY_API_SECRET"),
  shopifyRedirectUri: req(
    "SHOPIFY_REDIRECT_URI",
    "http://localhost:5600/shopify/callback",
  ),
  shopifyScopes: req(
    "SHOPIFY_SCOPES",
    "read_orders,read_products,read_customers,read_fulfillments",
  ),
  /** Max order total eligible for chat-initiated refunds (default $100). Larger orders need a ticket/human. */
  refundMaxAmount: Number(req("REFUND_MAX_AMOUNT", "100")) || 100,
  resendApiKey: req("RESEND_API_KEY"),
  resendFromEmail: first("RESEND_FROM_EMAIL", "EMAIL_FROM") || "noreply@agentraa.com",
  resendFromName: req("RESEND_FROM_NAME", "Agentraa"),
  smtpHost: req("SMTP_HOST"),
  smtpPort: Number(req("SMTP_PORT", "587")) || 587,
  smtpUser: req("SMTP_USER"),
  smtpPass: req("SMTP_PASS"),
  /** @deprecated prefer resendFromEmail / resendFromName */
  emailFrom: first("EMAIL_FROM", "RESEND_FROM_EMAIL") || "noreply@agentraa.com",
  wooUrl: req("WOOCOMMERCE_URL"),
  wooKey: req("WOOCOMMERCE_CONSUMER_KEY"),
  wooSecret: req("WOOCOMMERCE_CONSUMER_SECRET"),
  storeName: req("STORE_NAME", "Store"),
  agentName: req("AGENT_NAME", "Store Assistant"),
  widgetColor: req("WIDGET_COLOR", "#d85a30"),
  businessHoursTz: req("BUSINESS_HOURS_TZ", "America/New_York"),
  businessHoursDays: req("BUSINESS_HOURS_DAYS", "1,2,3,4,5")
    .split(",")
    .map((d) => Number(d.trim()))
    .filter((n) => !Number.isNaN(n)),
  businessHoursStart: req("BUSINESS_HOURS_START", "09:00"),
  businessHoursEnd: req("BUSINESS_HOURS_END", "17:00"),
  agentsAvailable: bool("AGENTS_AVAILABLE", true),
  /** Public storefront host (no protocol), e.g. shop.example.com */
  storePublicDomain: first("STORE_PUBLIC_DOMAIN", "SHOP_PUBLIC_DOMAIN").replace(
    /^https?:\/\//,
    "",
  ).replace(/\/$/, ""),
  /** Days after delivery (or fulfillment) when chat can start a return */
  returnWindowDays: Math.max(1, Number(req("RETURN_WINDOW_DAYS", "14")) || 14),
  dataDir: path.resolve(__dirname, "../../data"),
};
