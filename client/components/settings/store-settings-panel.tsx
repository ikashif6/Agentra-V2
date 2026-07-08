"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
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
import { PLATFORM_OPTIONS } from "@/components/onboarding/onboarding-config";
import { PlatformBrandIcon } from "@/components/onboarding/platform-brand-icons";
import SettingsPanelShell from "./settings-panel-shell";

type WizardStep = "choose" | "connect" | "sync";

const PROVIDER_COPY: Record<
  StoreProvider,
  { title: string; subtitle: string; steps: string[] }
> = {
  shopify: {
    title: "Connect Shopify",
    subtitle: "Link your Shopify admin so orders and customers appear in Agentra.",
    steps: [
      "In Shopify admin, go to Settings → Apps and sales channels → Develop apps.",
      "Create a custom app with read access to customers and orders.",
      "Copy the Admin API access token and paste it below.",
    ],
  },
  woocommerce: {
    title: "Connect WooCommerce",
    subtitle: "Use REST API keys from your WordPress store.",
    steps: [
      "In WordPress, open WooCommerce → Settings → Advanced → REST API.",
      "Add a key with Read permissions for orders and customers.",
      "Paste the consumer key and secret below.",
    ],
  },
  custom: {
    title: "Connect custom store",
    subtitle: "Point Agentra at your own storefront or headless API.",
    steps: [
      "Enter the public URL of your store or API base.",
      "Optionally add an API key if your endpoint requires authentication.",
      "We will verify the connection and generate a webhook secret for events.",
    ],
  },
};

export default function StoreSettingsPanel() {
  const [store, setStore] = useState<StoreIntegration | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<WizardStep>("choose");
  const [provider, setProvider] = useState<StoreProvider | null>(null);
  const [replacing, setReplacing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await storeApi.getStatus();
      setStore(data.data.store);
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
      syncSettings: { syncOrders: true, syncCustomers: true, syncProducts: false },
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
        replacing={replacing}
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
      <div className="space-y-4">
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
            const selected = provider === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setProvider(option.id as StoreProvider)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-all",
                  selected
                    ? "border-primary bg-primary/5 shadow-[inset_0_0_0_1px_rgba(216,90,48,0.2)]"
                    : "border-border/80 hover:border-primary/30 hover:bg-muted/30",
                )}
              >
                <div
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-card",
                    selected && "border-primary/30 bg-primary/5",
                  )}
                >
                  <PlatformBrandIcon platform={option.id} className="size-5 [&_svg]:size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{option.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {option.id === "custom"
                      ? "Headless, bespoke, or in-house stack"
                      : `Official ${option.label} integration`}
                  </p>
                </div>
                {selected ? <Check className="size-4 shrink-0 text-primary" /> : null}
              </button>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          {replacing ? (
            <Button variant="outline" onClick={() => setReplacing(false)}>
              Cancel
            </Button>
          ) : null}
          <Button disabled={!provider} onClick={() => setStep("connect")}>
            Continue setup
          </Button>
        </div>
      </div>
    </SettingsPanelShell>
  );
}

function ProviderConnectForm({
  provider,
  replacing,
  onBack,
  onConnected,
}: {
  provider: StoreProvider;
  replacing?: boolean;
  onBack: () => void;
  onConnected: (store: StoreIntegration) => void;
}) {
  const copy = PROVIDER_COPY[provider];
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [shopDomain, setShopDomain] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [storeUrl, setStoreUrl] = useState("");
  const [consumerKey, setConsumerKey] = useState("");
  const [consumerSecret, setConsumerSecret] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [syncOrders, setSyncOrders] = useState(true);
  const [syncCustomers, setSyncCustomers] = useState(true);
  const [syncProducts, setSyncProducts] = useState(false);

  const buildCredentials = () => {
    if (provider === "shopify") {
      return { shopDomain, accessToken };
    }
    if (provider === "woocommerce") {
      return { storeUrl, consumerKey, consumerSecret };
    }
    return { storeUrl, apiKey: apiKey || undefined };
  };

  const canSubmit = () => {
    if (provider === "shopify") return shopDomain.trim() && accessToken.trim();
    if (provider === "woocommerce") {
      return storeUrl.trim() && consumerKey.trim() && consumerSecret.trim();
    }
    return storeUrl.trim();
  };

  const onSubmit = async () => {
    if (!canSubmit()) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const { data } = await storeApi.connect({
        provider,
        credentials: buildCredentials(),
        syncSettings: { syncOrders, syncCustomers, syncProducts },
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
      <div className="space-y-6">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to providers
        </button>

        <div className="rounded-xl bg-muted/30 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Before you connect
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

        <div className="space-y-4">
          {provider === "shopify" ? (
            <>
              <Field label="Shopify store domain" hint="e.g. your-brand.myshopify.com">
                <Input
                  value={shopDomain}
                  onChange={(e) => setShopDomain(e.target.value)}
                  placeholder="your-brand.myshopify.com"
                />
              </Field>
              <Field label="Admin API access token" hint="Starts with shpat_">
                <Input
                  type="password"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="shpat_..."
                />
              </Field>
            </>
          ) : null}

          {provider === "woocommerce" ? (
            <>
              <Field label="Store URL" hint="Your WordPress site URL">
                <Input
                  value={storeUrl}
                  onChange={(e) => setStoreUrl(e.target.value)}
                  placeholder="https://shop.example.com"
                />
              </Field>
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
            </>
          ) : null}

          {provider === "custom" ? (
            <>
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
            </>
          ) : null}
        </div>

        <Separator />

        <div className="space-y-3">
          <p className="text-sm font-semibold text-foreground">What to sync</p>
          <SyncToggle
            label="Orders"
            description="Attach order history to customer conversations"
            checked={syncOrders}
            onChange={setSyncOrders}
          />
          <SyncToggle
            label="Customers"
            description="Match shoppers to tickets automatically"
            checked={syncCustomers}
            onChange={setSyncCustomers}
          />
          <SyncToggle
            label="Products"
            description="Surface catalog details in the inbox (optional)"
            checked={syncProducts}
            onChange={setSyncProducts}
          />
        </div>

        {formError ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {formError}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onBack}>
            Cancel
          </Button>
          <Button disabled={!canSubmit() || submitting} onClick={onSubmit}>
            {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Verify & connect
          </Button>
        </div>
      </div>
    </SettingsPanelShell>
  );
}

function ConnectedStoreView({
  store,
  onRefresh,
  onDisconnect,
  onChangeProvider,
}: {
  store: StoreIntegration;
  onRefresh: () => Promise<void>;
  onDisconnect: () => void;
  onChangeProvider: () => void;
}) {
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

  const onTest = async () => {
    setTesting(true);
    try {
      const { data } = await storeApi.testConnection();
      toast.success("Connection verified");
      onRefresh();
      if (data.data.store) {
        setSyncSettings(data.data.store.syncSettings);
      }
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
      await storeApi.syncNow();
      toast.success("Sync completed");
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
      await storeApi.updateSettings({ syncSettings });
      toast.success("Sync preferences saved");
      onRefresh();
    } catch (err: unknown) {
      const { message } = getApiError(err, "Failed to save settings");
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const onDisconnectClick = async () => {
    if (!confirm("Disconnect this store? Order and customer sync will stop.")) return;
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
      <div className="space-y-6">
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
              {store.connectedAt ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Connected {new Date(store.connectedAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
                  {store.lastSyncAt
                    ? `. Last sync ${new Date(store.lastSyncAt).toLocaleString()}`
                    : ""}
                </p>
              ) : null}
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

        {store.custom?.webhookSecret ? (
          <div className="rounded-xl bg-muted/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Webhook secret
            </p>
            <p className="mt-1 break-all font-mono text-sm text-foreground">
              {store.custom.webhookSecret}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Use this when configuring outbound webhooks from your custom store.
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
          <Button variant="outline" size="sm" disabled={testing} onClick={onTest}>
            {testing ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
            Test connection
          </Button>
          <Button variant="outline" size="sm" disabled={syncing} onClick={onSync}>
            {syncing ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Store className="mr-2 size-4" />}
            Sync now
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
