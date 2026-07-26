"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  Check,
  CheckCircle2,
  Copy,
  Loader2,
  RefreshCw,
  Store,
  Unplug,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { storeApi } from "@/lib/api";
import { getApiError } from "@/lib/api-error";
import type { StoreIntegration, StoreProvider } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/contexts/ConfirmContext";
import { PLATFORM_OPTIONS } from "@/components/onboarding/onboarding-config";
import { PlatformBrandIcon } from "@/components/onboarding/platform-brand-icons";
import SettingsPanelShell from "./settings-panel-shell";

type WizardStep = "choose" | "connect";

type StoreConfig = {
  shopifyConfigured: boolean;
  customWebhookUrl?: string;
};

const PROVIDER_COPY: Record<
  StoreProvider,
  { title: string; subtitle: string; steps: string[] }
> = {
  shopify: {
    title: "Connect Shopify",
    subtitle: "Authorize Agentra from your Shopify admin — no tokens to copy.",
    steps: [
      "Enter your *.myshopify.com domain or your public storefront URL.",
      "Click Connect Shopify and approve access in the Shopify window.",
      "You're done — orders sync automatically into the inbox.",
    ],
  },
  woocommerce: {
    title: "Connect WooCommerce",
    subtitle: "Approve Agentra from your WooCommerce store in one step.",
    steps: [
      "Enter your store URL (e.g. https://shop.example.com).",
      "Click Authorize with WooCommerce and approve read access.",
      "Keys are exchanged automatically and orders start syncing.",
    ],
  },
  custom: {
    title: "Connect custom store",
    subtitle: "Point Agentra at your own storefront or headless API.",
    steps: [
      "Enter the base URL of your store API.",
      "Optionally add an API key if your endpoints require auth.",
      "Implement the Agentra order contract shown after connecting.",
    ],
  },
};

type StoreSettingsPanelProps = {
  /** When set (e.g. `/setup?step=store`), OAuth returns here instead of Settings. */
  returnTo?: string;
};

export default function StoreSettingsPanel({ returnTo }: StoreSettingsPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [store, setStore] = useState<StoreIntegration | null>(null);
  const [config, setConfig] = useState<StoreConfig>({ shopifyConfigured: false });
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<WizardStep>("choose");
  const [provider, setProvider] = useState<StoreProvider | null>(null);
  const [replacing, setReplacing] = useState(false);
  const handledRedirect = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await storeApi.getStatus();
      setStore(data.data.store);
      setConfig({
        shopifyConfigured: Boolean(data.data.shopifyConfigured),
        customWebhookUrl: data.data.customWebhookUrl,
      });
    } catch (err: unknown) {
      const { message } = getApiError(err, "Failed to load store settings");
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Handle the OAuth redirect back from Shopify / WooCommerce.
  useEffect(() => {
    if (handledRedirect.current) return;
    const status = searchParams.get("store");
    if (!status) return;
    handledRedirect.current = true;

    if (status === "connected") {
      toast.success(
        searchParams.get("name")
          ? `${searchParams.get("name")} connected`
          : "Store connected",
      );
      load();
    } else if (status === "error") {
      toast.error(searchParams.get("message") || "Could not connect store");
    } else if (status === "pending") {
      toast.info("Finishing connection…");
      // Woo posts keys server-to-server; poll a few times for completion.
      let tries = 0;
      const timer = setInterval(async () => {
        tries += 1;
        await load();
        const { data } = await storeApi.getStatus().catch(() => ({ data: null }));
        if (data?.data?.store?.status === "connected" || tries >= 6) {
          clearInterval(timer);
          if (data?.data?.store?.status === "connected") toast.success("Store connected");
        }
      }, 2500);
    }

    if (returnTo) {
      router.replace(returnTo, { scroll: false });
    } else {
      const params = new URLSearchParams(searchParams.toString());
      ["store", "name", "message"].forEach((k) => params.delete(k));
      router.replace(`/settings?${params.toString()}`, { scroll: false });
    }
  }, [searchParams, router, load, returnTo]);

  const onConnected = (next: StoreIntegration) => {
    setStore(next);
    setStep("choose");
    setProvider(null);
    setReplacing(false);
  };

  const onDisconnected = () => {
    setStore({
      provider: null,
      status: "disconnected",
      syncSettings: { syncOrders: true, syncCustomers: true, syncProducts: true },
    });
    setStep("choose");
    setProvider(null);
    setReplacing(false);
  };

  if (loading) {
    return (
      <SettingsPanelShell title="Store" description="Connect your e-commerce platform">
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      </SettingsPanelShell>
    );
  }

  if (store?.status === "connected" && store.provider && !replacing) {
    return (
      <ConnectedStoreView
        store={store}
        config={config}
        onRefresh={load}
        onDisconnect={onDisconnected}
        onChangeProvider={() => setReplacing(true)}
      />
    );
  }

  if (step === "connect" && provider) {
    return (
      <ProviderConnectForm
        provider={provider}
        config={config}
        replacing={replacing}
        returnTo={returnTo}
        onBack={() => {
          setStep("choose");
          setProvider(null);
          if (replacing) setReplacing(false);
        }}
        onConnected={onConnected}
      />
    );
  }

  return (
    <SettingsPanelShell
      title="Store"
      description="Choose where you sell so Agentra can pull orders and customer context into support."
    >
      <div className="mx-auto max-w-4xl space-y-6">
        {replacing ? (
          <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            Connecting a new provider will replace your current store link.
          </p>
        ) : null}
        <p className="text-sm text-muted-foreground">
          Select your commerce platform to start setup. You can switch providers later.
        </p>

        <div className="grid gap-3 sm:grid-cols-3">
          {PLATFORM_OPTIONS.map((option) => {
            const selectProvider = () => {
              setProvider(option.id as StoreProvider);
              setStep("connect");
            };
            return (
              <button
                key={option.id}
                type="button"
                onClick={selectProvider}
                className={cn(
                  "group relative flex w-full flex-col items-center gap-3 rounded-2xl border px-4 py-6 text-center transition-all",
                  "border-border/80 hover:border-primary/50 hover:bg-primary/5 hover:shadow-sm hover:ring-1 hover:ring-primary/20",
                )}
              >
                <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-card transition-colors group-hover:border-primary/30 group-hover:bg-primary/5">
                  <PlatformBrandIcon platform={option.id} className="size-7 [&_svg]:size-7" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{option.label}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {option.id === "custom"
                      ? "Headless, bespoke, or in-house stack"
                      : `One-click ${option.label} connection`}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-5">
          <p className="text-xs text-muted-foreground">
            Your credentials are encrypted and only used to sync your store.
          </p>
          {replacing ? (
            <Button variant="outline" onClick={() => setReplacing(false)}>
              Cancel
            </Button>
          ) : null}
        </div>
      </div>
    </SettingsPanelShell>
  );
}

function ProviderConnectForm({
  provider,
  config,
  replacing,
  returnTo,
  onBack,
  onConnected,
}: {
  provider: StoreProvider;
  config: StoreConfig;
  replacing?: boolean;
  returnTo?: string;
  onBack: () => void;
  onConnected: (store: StoreIntegration) => void;
}) {
  const copy = PROVIDER_COPY[provider];
  const [submitting, setSubmitting] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);

  const [shopDomain, setShopDomain] = useState("");
  const [storeUrl, setStoreUrl] = useState("");
  const [consumerKey, setConsumerKey] = useState("");
  const [consumerSecret, setConsumerSecret] = useState("");
  const [apiKey, setApiKey] = useState("");

  // ── One-click OAuth (Shopify) ───────────────────────────────────────────────
  const startShopify = async () => {
    if (!shopDomain.trim()) return;
    setRedirecting(true);
    setFormError(null);
    try {
      const { data } = await storeApi.shopifyOAuthUrl(shopDomain.trim(), returnTo);
      window.location.href = data.data.url;
    } catch (err: unknown) {
      const { message } = getApiError(err, "Could not start Shopify connection");
      setFormError(message);
      setRedirecting(false);
    }
  };

  // ── One-click authorize (WooCommerce) ───────────────────────────────────────
  const startWoo = async () => {
    if (!storeUrl.trim()) return;
    setRedirecting(true);
    setFormError(null);
    try {
      const { data } = await storeApi.wooOAuthUrl(storeUrl.trim(), returnTo);
      window.location.href = data.data.url;
    } catch (err: unknown) {
      const { message } = getApiError(err, "Could not start WooCommerce authorization");
      setFormError(message);
      setRedirecting(false);
    }
  };

  // ── Manual credential entry (fallback / custom) ─────────────────────────────
  const buildCredentials = () => {
    if (provider === "woocommerce") return { storeUrl, consumerKey, consumerSecret };
    return { storeUrl, apiKey: apiKey || undefined };
  };

  const canSubmitManual = () => {
    if (provider === "woocommerce")
      return storeUrl.trim() && consumerKey.trim() && consumerSecret.trim();
    return storeUrl.trim();
  };

  const onSubmitManual = async () => {
    if (!canSubmitManual()) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const { data } = await storeApi.connect({
        provider,
        credentials: buildCredentials(),
      });
      toast.success(replacing ? "Store switched successfully" : "Store connected");
      onConnected(data.data.store);
    } catch (err: unknown) {
      const { message } = getApiError(err, "Could not connect store");
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SettingsPanelShell title={copy.title} description={copy.subtitle}>
      <div className="mx-auto max-w-2xl space-y-6">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Back to providers
        </button>

        <div className="rounded-xl bg-muted/30 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            How it works
          </p>
          <ol className="mt-3 space-y-2">
            {copy.steps.map((item, i) => (
              <li key={item} className="flex gap-2 text-sm text-muted-foreground">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-card text-xs font-semibold text-primary shadow-sm">
                  {i + 1}
                </span>
                {item}
              </li>
            ))}
          </ol>
        </div>

        {/* Shopify — one-click OAuth */}
        {provider === "shopify" ? (
          <div className="space-y-4">
            <Field
              label="Shopify store domain"
              hint="*.myshopify.com or your storefront URL (e.g. shop.yourbrand.com)"
            >
              <Input
                value={shopDomain}
                onChange={(e) => setShopDomain(e.target.value)}
                placeholder="your-brand.myshopify.com or shop.yourbrand.com"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && shopDomain.trim()) {
                    e.preventDefault();
                    startShopify();
                  }
                }}
              />
            </Field>

            <Button
              className="h-auto w-full bg-[#5E8E3E] py-3 text-white hover:bg-[#527d36]"
              disabled={!shopDomain.trim() || redirecting}
              onClick={startShopify}
            >
              {redirecting ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <PlatformBrandIcon platform="shopify" monochrome className="mr-2" />
              )}
              Connect Shopify
            </Button>
          </div>
        ) : null}

        {/* WooCommerce — one-click authorize */}
        {provider === "woocommerce" ? (
          <div className="space-y-4">
            <Field label="Store URL" hint="Your WordPress site URL">
              <Input
                value={storeUrl}
                onChange={(e) => setStoreUrl(e.target.value)}
                placeholder="https://shop.example.com"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && storeUrl.trim() && !showManual) {
                    e.preventDefault();
                    startWoo();
                  }
                }}
              />
            </Field>

            {!showManual ? (
              <>
                <Button
                  className="w-full bg-[#7F54B3] text-white hover:bg-[#6f489d]"
                  disabled={!storeUrl.trim() || redirecting}
                  onClick={startWoo}
                >
                  {redirecting ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <PlatformBrandIcon platform="woocommerce" monochrome className="mr-2" />
                  )}
                  Authorize with WooCommerce
                </Button>
                <button
                  type="button"
                  onClick={() => setShowManual(true)}
                  className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline"
                >
                  Enter REST API keys manually instead
                </button>
              </>
            ) : (
              <div className="space-y-4">
                <Field label="Consumer key">
                  <Input
                    value={consumerKey}
                    onChange={(e) => setConsumerKey(e.target.value)}
                    placeholder="ck_..."
                  />
                </Field>
                <Field label="Consumer secret">
                  <Input
                    type="password"
                    value={consumerSecret}
                    onChange={(e) => setConsumerSecret(e.target.value)}
                    placeholder="cs_..."
                  />
                </Field>
                <button
                  type="button"
                  onClick={() => setShowManual(false)}
                  className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline"
                >
                  Use one-click authorize instead
                </button>
              </div>
            )}
          </div>
        ) : null}

        {/* Custom — manual */}
        {provider === "custom" ? (
          <div className="space-y-4">
            <Field label="Store or API URL">
              <Input
                value={storeUrl}
                onChange={(e) => setStoreUrl(e.target.value)}
                placeholder="https://api.yourstore.com"
              />
            </Field>
            <Field label="API key (optional)" hint="Bearer token if your endpoint requires auth">
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Optional"
              />
            </Field>
            <div className="rounded-xl bg-muted/30 p-4 text-xs text-muted-foreground space-y-2">
              <p>
                After connecting, implement these endpoints on your base URL:
              </p>
              <ul className="list-disc space-y-1 pl-4">
                <li>
                  <code className="rounded bg-card px-1 py-0.5 font-mono text-foreground">
                    GET /agentra/orders?email=
                  </code>{" "}
                  — list orders for inbox lookup
                </li>
                <li>
                  <code className="rounded bg-card px-1 py-0.5 font-mono text-foreground">
                    GET /agentra/orders/:id
                  </code>{" "}
                  — live order detail refresh
                </li>
                <li>
                  <code className="rounded bg-card px-1 py-0.5 font-mono text-foreground">
                    PATCH /agentra/orders/:id
                  </code>{" "}
                  — edit note or addresses
                </li>
                <li>
                  <code className="rounded bg-card px-1 py-0.5 font-mono text-foreground">
                    GET /agentra/capabilities
                  </code>{" "}
                  — optional; returns supported actions and features
                </li>
                <li>
                  <code className="rounded bg-card px-1 py-0.5 font-mono text-foreground">
                    POST /agentra/orders/:id/actions
                  </code>{" "}
                  — cancel, fulfill, refund, hold, mark_paid, send_invoice, duplicate, archive, and more
                </li>
              </ul>
              <p className="pt-1">
                Order payloads may include <code className="font-mono">conversion</code>,{" "}
                <code className="font-mono">attribution</code>, or{" "}
                <code className="font-mono">sessions</code> for marketing insights in the inbox.
              </p>
              <p>Push new or updated orders to the webhook shown after you connect.</p>
            </div>
          </div>
        ) : null}

        {formError ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {formError}
          </p>
        ) : null}

        {/* Manual submit button (custom always; shopify/woo when in manual mode) */}
        {(provider === "custom" ||
          (provider === "woocommerce" && showManual)) && (
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onBack}>
              Cancel
            </Button>
            <Button disabled={!canSubmitManual() || submitting} onClick={onSubmitManual}>
              {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Verify &amp; connect
            </Button>
          </div>
        )}
      </div>
    </SettingsPanelShell>
  );
}

function ConnectedStoreView({
  store,
  config,
  onRefresh,
  onDisconnect,
  onChangeProvider,
}: {
  store: StoreIntegration;
  config: StoreConfig;
  onRefresh: () => Promise<void>;
  onDisconnect: () => void;
  onChangeProvider: () => void;
}) {
  const confirm = useConfirm();
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncSettings, setSyncSettings] = useState(store.syncSettings);

  const storeLabel =
    store.shopify?.shopName ||
    store.woocommerce?.storeName ||
    store.custom?.storeName ||
    "Connected store";

  const storeUrl =
    store.shopify?.shopDomain ||
    store.woocommerce?.storeUrl ||
    store.custom?.storeUrl ||
    "";

  const providerLabel =
    store.provider === "shopify"
      ? "Shopify"
      : store.provider === "woocommerce"
        ? "WooCommerce"
        : "Custom";

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Could not copy");
    }
  };

  const onTest = async () => {
    setTesting(true);
    try {
      const { data } = await storeApi.testConnection();
      toast.success("Connection verified");
      onRefresh();
      if (data.data.store) setSyncSettings(data.data.store.syncSettings);
    } catch (err: unknown) {
      const { message } = getApiError(err, "Connection test failed");
      toast.error(message);
    } finally {
      setTesting(false);
    }
  };

  const onSync = async () => {
    setSyncing(true);
    try {
      const { data } = await storeApi.syncNow();
      const orders = data.data?.synced;
      const products = data.data?.productsSynced;
      toast.success(
        typeof products === "number"
          ? `Synced ${orders ?? 0} orders and ${products} products`
          : typeof orders === "number"
            ? `Synced ${orders} orders`
            : "Sync completed",
      );
      onRefresh();
    } catch (err: unknown) {
      const { message } = getApiError(err, "Sync failed");
      toast.error(message);
    } finally {
      setSyncing(false);
    }
  };

  const onSaveSettings = async () => {
    setSaving(true);
    try {
      const { data } = await storeApi.updateSettings({ syncSettings });
      const productsSynced = data?.data?.productsSynced;
      toast.success(
        typeof productsSynced === "number"
          ? `Preferences saved. Synced ${productsSynced} products.`
          : "Sync preferences saved",
      );
      onRefresh();
    } catch (err: unknown) {
      const { message } = getApiError(err, "Failed to save settings");
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const onDisconnectClick = async () => {
    const ok = await confirm({
      title: "Disconnect store?",
      description: "Synced orders will be removed from this workspace. You can reconnect later.",
      confirmLabel: "Disconnect",
    });
    if (!ok) return;
    setDisconnecting(true);
    try {
      await storeApi.disconnect();
      toast.success("Store disconnected");
      onDisconnect();
    } catch (err: unknown) {
      const { message } = getApiError(err, "Failed to disconnect");
      toast.error(message);
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <SettingsPanelShell title="Store" description="Your commerce platform is linked to this workspace">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-muted/30 p-4">
          <div className="flex items-start gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2 className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{storeLabel}</p>
              <p className="text-xs text-muted-foreground">
                {providerLabel}
                {storeUrl ? `, ${storeUrl}` : ""}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {store.connectedAt ? (
                  <p className="text-xs text-muted-foreground">
                    Connected{" "}
                    {new Date(store.connectedAt).toLocaleDateString(undefined, {
                      dateStyle: "medium",
                    })}
                    {store.lastSyncAt
                      ? `. Last sync ${new Date(store.lastSyncAt).toLocaleString()}`
                      : ""}
                  </p>
                ) : null}
                {store.webhooksRegistered ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                    <Check className="size-3" /> Real-time sync on
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          {store.provider ? (
            <PlatformBrandIcon platform={store.provider} className="size-8 [&_svg]:size-8" />
          ) : null}
        </div>

        {store.lastError ? (
          <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            Last error: {store.lastError}
          </p>
        ) : null}

        {store.provider === "custom" && (config.customWebhookUrl || store.custom?.webhookSecret) ? (
          <div className="space-y-3 rounded-xl bg-muted/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Real-time order webhook
            </p>
            {config.customWebhookUrl ? (
              <CopyRow
                label="Webhook URL"
                value={config.customWebhookUrl}
                onCopy={() => copyText(config.customWebhookUrl!, "Webhook URL")}
              />
            ) : null}
            {store.custom?.webhookSecret ? (
              <CopyRow
                label="Signing secret"
                value={store.custom.webhookSecret}
                onCopy={() => copyText(store.custom!.webhookSecret!, "Secret")}
              />
            ) : null}
            <p className="text-xs text-muted-foreground">
              POST new/updated orders here, signed with{" "}
              <code className="font-mono">x-agentra-signature</code> (base64 HMAC-SHA256 of the body
              using the secret).
            </p>
          </div>
        ) : null}

        <div className="space-y-3">
          <p className="text-sm font-semibold text-foreground">Sync preferences</p>
          <SyncToggle
            label="Orders"
            description="Keep order data available in the inbox"
            checked={syncSettings.syncOrders}
            onChange={(v) => setSyncSettings((s) => ({ ...s, syncOrders: v }))}
          />
          <SyncToggle
            label="Customers"
            description="Link shoppers to support tickets"
            checked={syncSettings.syncCustomers}
            onChange={(v) => setSyncSettings((s) => ({ ...s, syncCustomers: v }))}
          />
          <SyncToggle
            label="Products"
            description="Include product catalog metadata"
            checked={syncSettings.syncProducts}
            onChange={(v) => setSyncSettings((s) => ({ ...s, syncProducts: v }))}
          />
          <div className="flex justify-end">
            <Button variant="outline" size="sm" disabled={saving} onClick={onSaveSettings}>
              {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Save preferences
            </Button>
          </div>
        </div>

        <Separator />

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={syncing} onClick={onSync}>
            {syncing ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 size-4" />
            )}
            Sync now
          </Button>
          <Button variant="outline" size="sm" disabled={testing} onClick={onTest}>
            {testing ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Store className="mr-2 size-4" />
            )}
            Test connection
          </Button>
          <Button variant="outline" size="sm" onClick={onChangeProvider}>
            Switch provider
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 hover:text-red-700"
            disabled={disconnecting}
            onClick={onDisconnectClick}
          >
            {disconnecting ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Unplug className="mr-2 size-4" />
            )}
            Disconnect
          </Button>
        </div>
      </div>
    </SettingsPanelShell>
  );
}

function CopyRow({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: () => void;
}) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-medium text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md bg-card px-2 py-1.5 font-mono text-xs text-foreground">
          {value}
        </code>
        <Button type="button" variant="outline" size="icon" className="size-8 shrink-0" onClick={onCopy}>
          <Copy className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function SyncToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 p-3 hover:bg-muted/20">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 rounded border-border text-primary focus:ring-primary/30"
      />
      <span>
        <span className="block text-sm font-medium text-foreground">{label}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}
