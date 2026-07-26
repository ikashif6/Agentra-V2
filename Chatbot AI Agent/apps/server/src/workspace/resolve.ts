import fs from "node:fs";
import path from "node:path";
import { env } from "../config/env.js";
import { mergeFeatureFlags } from "./features.js";
import type {
  ChannelInstructions,
  StoreOwnerInstructions,
  WorkspaceConfig,
  WorkspaceConfigProvider,
  WorkspaceCoupon,
  WorkspaceFeatureFlags,
} from "./types.js";

function parseCouponsFromEnv(): WorkspaceCoupon[] {
  const raw = String(process.env.KNOWN_COUPONS_JSON || "").trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as WorkspaceCoupon[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((c) => c && typeof c.code === "string" && c.code.trim())
      .map((c) => ({
        code: String(c.code).trim().toUpperCase(),
        description: String(c.description || c.code).trim(),
        percentOff: c.percentOff,
        minSubtotal: c.minSubtotal,
        freeShipping: c.freeShipping,
      }));
  } catch {
    return [];
  }
}

function parseOwnerFromEnv(): StoreOwnerInstructions | undefined {
  const text = String(process.env.STORE_OWNER_INSTRUCTIONS || "").trim();
  if (!text) return undefined;
  return { text };
}

function parseChannelFromEnv(): ChannelInstructions[] | undefined {
  const raw = String(process.env.CHANNEL_INSTRUCTIONS_JSON || "").trim();
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as ChannelInstructions[];
    if (!Array.isArray(parsed)) return undefined;
    return parsed.filter((c) => c && typeof c.channel === "string");
  } catch {
    return undefined;
  }
}

function parseFeatureOverrides(): Partial<WorkspaceFeatureFlags> | undefined {
  const raw = String(process.env.CHATBOT_FEATURES_JSON || "").trim();
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as Partial<WorkspaceFeatureFlags>;
  } catch {
    return undefined;
  }
}

/** Brand-neutral defaults — never ship a merchant brand baked into the engine. */
export function buildConfigFromEnv(workspaceId: string): WorkspaceConfig {
  const commerceProvider = String(
    process.env.COMMERCE_PROVIDER || env.commerceProvider || "custom",
  )
    .trim()
    .toLowerCase();
  const allowDemo = commerceProvider === "custom";
  return {
    workspaceId,
    branding: {
      storeName: env.storeName,
      agentName: env.agentName,
      widgetColor: env.widgetColor,
      storePublicDomain: env.storePublicDomain || undefined,
      contactEmail: String(process.env.STORE_CONTACT_EMAIL || "").trim() || undefined,
      contactPhone: String(process.env.STORE_CONTACT_PHONE || "").trim() || undefined,
      welcomeMessage:
        String(process.env.STORE_WELCOME_MESSAGE || "").trim() || undefined,
    },
    businessHours: {
      timezone: env.businessHoursTz,
      days: env.businessHoursDays,
      start: env.businessHoursStart,
      end: env.businessHoursEnd,
      agentsAvailable: env.agentsAvailable,
    },
    features: mergeFeatureFlags(parseFeatureOverrides()),
    commerce: {
      knownCoupons: parseCouponsFromEnv(),
      returnWindowDays: env.returnWindowDays,
    },
    knowledge: { mode: "local_files" },
    ownerInstructions: parseOwnerFromEnv(),
    channelInstructions: parseChannelFromEnv(),
    allowDemoSandboxData: allowDemo,
    source: "local_env",
  };
}

function deepMergeConfig(
  base: WorkspaceConfig,
  overlay: Partial<WorkspaceConfig>,
): WorkspaceConfig {
  return {
    ...base,
    ...overlay,
    workspaceId: overlay.workspaceId || base.workspaceId,
    branding: { ...base.branding, ...(overlay.branding || {}) },
    businessHours: { ...base.businessHours, ...(overlay.businessHours || {}) },
    features: mergeFeatureFlags({
      ...base.features,
      ...(overlay.features || {}),
    }),
    commerce: {
      ...base.commerce,
      ...(overlay.commerce || {}),
      knownCoupons:
        overlay.commerce?.knownCoupons ?? base.commerce.knownCoupons,
    },
    knowledge: { ...base.knowledge, ...(overlay.knowledge || {}) },
    ownerInstructions:
      overlay.ownerInstructions !== undefined
        ? { ...base.ownerInstructions, ...overlay.ownerInstructions }
        : base.ownerInstructions,
    channelInstructions:
      overlay.channelInstructions ?? base.channelInstructions,
    allowDemoSandboxData:
      overlay.allowDemoSandboxData ?? base.allowDemoSandboxData,
    source: overlay.source || base.source,
  };
}

function tryLoadLocalFile(workspaceId: string): Partial<WorkspaceConfig> | null {
  const file = path.join(
    env.dataDir,
    "workspace",
    workspaceId,
    "config.json",
  );
  try {
    if (!fs.existsSync(file)) return null;
    const raw = fs.readFileSync(file, "utf8");
    const parsed = JSON.parse(raw) as Partial<WorkspaceConfig>;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Local provider: env + optional data/workspace/{id}/config.json.
 * This is the production standalone path until Agentra is connected.
 */
export class LocalWorkspaceConfigProvider implements WorkspaceConfigProvider {
  getConfig(workspaceId: string): WorkspaceConfig {
    const base = buildConfigFromEnv(workspaceId);
    const file = tryLoadLocalFile(workspaceId);
    if (!file) return base;
    return deepMergeConfig(base, { ...file, source: "local_file" });
  }
}

/**
 * Fetches WorkspaceConfig from Agentra chatbot-bridge APIs.
 * Engine / tools / prompts stay unchanged — only the config source swaps.
 * Keeps a sync cache so existing sync call sites keep working.
 */
export class AgentraWorkspaceConfigProvider implements WorkspaceConfigProvider {
  private cache = new Map<string, WorkspaceConfig>();

  constructor(
    private readonly apiBase = String(
      process.env.AGENTRA_API_URL || "http://localhost:5000/api/v1",
    ).replace(/\/$/, ""),
    private readonly secret = String(
      process.env.CHATBOT_BRIDGE_SECRET || process.env.ENGINE_SHARED_SECRET || "",
    ).trim(),
  ) {}

  getConfig(workspaceId: string): WorkspaceConfig {
    const hit = this.cache.get(workspaceId);
    if (hit) {
      void this.refresh(workspaceId).catch(() => undefined);
      return hit;
    }
    // First call before warm: return env baseline, refresh in background.
    const fallback = buildConfigFromEnv(workspaceId);
    void this.refresh(workspaceId).catch(() => undefined);
    return { ...fallback, source: "agentra" };
  }

  async warm(workspaceId: string): Promise<WorkspaceConfig> {
    return this.refresh(workspaceId);
  }

  private async refresh(workspaceId: string): Promise<WorkspaceConfig> {
    if (!this.secret) {
      throw new Error("CHATBOT_BRIDGE_SECRET is required for AgentraWorkspaceConfigProvider");
    }
    const res = await fetch(
      `${this.apiBase}/chatbot-bridge/workspaces/${encodeURIComponent(workspaceId)}/config`,
      {
        headers: {
          Accept: "application/json",
          "x-chatbot-bridge-secret": this.secret,
        },
      },
    );
    const json = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      message?: string;
      data?: { config?: WorkspaceConfig };
    };
    if (!res.ok || !json?.data?.config) {
      throw new Error(json?.message || `Agentra config fetch failed (${res.status})`);
    }
    const config = { ...json.data.config, source: "agentra" as const };
    this.cache.set(workspaceId, config);
    return config;
  }
}

/** Enable Agentra provider when AGENTRA_WORKSPACE_PROVIDER=agentra (or 1/true). */
export function maybeConnectAgentraWorkspaceProvider() {
  const mode = String(process.env.AGENTRA_WORKSPACE_PROVIDER || "").toLowerCase();
  if (!["1", "true", "yes", "agentra"].includes(mode)) return false;
  const provider = new AgentraWorkspaceConfigProvider();
  setWorkspaceConfigProvider(provider);
  const workspaceId = String(process.env.WORKSPACE_ID || "default");
  void provider.warm(workspaceId).catch((err) => {
    console.warn("[chatbot] agentra workspace warm failed:", err?.message || err);
  });
  return true;
}

let activeProvider: WorkspaceConfigProvider = new LocalWorkspaceConfigProvider();
const cache = new Map<string, { config: WorkspaceConfig; at: number }>();
const CACHE_MS = 5_000;

/** Replace the provider when Agentra is connected (engine stays unchanged). */
export function setWorkspaceConfigProvider(provider: WorkspaceConfigProvider) {
  activeProvider = provider;
  cache.clear();
}

export function getWorkspaceConfigProvider(): WorkspaceConfigProvider {
  return activeProvider;
}

export function clearWorkspaceConfigCache() {
  cache.clear();
}

/**
 * Resolve workspace config for the current request / tool / prompt.
 * Sync-friendly: local provider is sync; Agentra provider may be async later.
 */
export function getWorkspaceConfig(
  workspaceId: string = env.workspaceId,
): WorkspaceConfig {
  const hit = cache.get(workspaceId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.config;

  const result = activeProvider.getConfig(workspaceId);
  if (result && typeof (result as Promise<WorkspaceConfig>).then === "function") {
    // Async providers should call getWorkspaceConfigAsync; fall back to env.
    const config = buildConfigFromEnv(workspaceId);
    cache.set(workspaceId, { config, at: Date.now() });
    return config;
  }
  const config = result as WorkspaceConfig;
  cache.set(workspaceId, { config, at: Date.now() });
  return config;
}

export async function getWorkspaceConfigAsync(
  workspaceId: string = env.workspaceId,
): Promise<WorkspaceConfig> {
  const result = activeProvider.getConfig(workspaceId);
  const config = await Promise.resolve(result);
  cache.set(workspaceId, { config, at: Date.now() });
  return config;
}

export function getChannelInstructions(
  config: WorkspaceConfig,
  channel?: string | null,
): string | undefined {
  if (!channel || !config.channelInstructions?.length) return undefined;
  const hit = config.channelInstructions.find(
    (c) => c.channel.toLowerCase() === String(channel).toLowerCase(),
  );
  return hit?.text?.trim() || undefined;
}

export function formatOwnerBehaviourLayer(config: WorkspaceConfig, channel?: string | null): string {
  const parts: string[] = [];
  const owner = config.ownerInstructions;
  if (owner) {
    if (owner.tone) parts.push(`Tone / brand voice: ${owner.tone}`);
    if (owner.responseLength) parts.push(`Response length preference: ${owner.responseLength}`);
    if (owner.greetingStyle) parts.push(`Greeting style: ${owner.greetingStyle}`);
    if (owner.recommendationStyle) {
      parts.push(`Recommendation style: ${owner.recommendationStyle}`);
    }
    if (owner.wordsToUse?.length) {
      parts.push(`Prefer these words when natural: ${owner.wordsToUse.join(", ")}`);
    }
    if (owner.wordsToAvoid?.length) {
      parts.push(`Avoid these words: ${owner.wordsToAvoid.join(", ")}`);
    }
    if (owner.generalServiceNotes) {
      parts.push(`Service notes: ${owner.generalServiceNotes}`);
    }
    if (owner.text?.trim()) parts.push(owner.text.trim());
  }
  const channelText = getChannelInstructions(config, channel);
  if (channelText) {
    parts.push(`Channel-specific wording (${channel}): ${channelText}`);
  }
  return parts.join("\n");
}
