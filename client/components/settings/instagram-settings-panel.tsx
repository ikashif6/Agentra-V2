"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Inbox,
  Instagram,
  Loader2,
  MessagesSquare,
  Reply,
  ShieldCheck,
  Ticket,
  Unplug,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { instagramChannelApi } from "@/lib/api";
import { getApiError } from "@/lib/api-error";
import type { InstagramChannelIntegration } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChannelBrandIcon } from "@/components/onboarding/channel-brand-icons";
import SettingsPanelShell from "./settings-panel-shell";

const DEFAULT_INSTAGRAM: InstagramChannelIntegration = {
  status: "disconnected",
  pendingAccounts: [],
};

const CAPABILITIES = [
  {
    icon: Ticket,
    title: "Auto-created tickets",
    description: "Every new Instagram DM opens a ticket in your inbox.",
  },
  {
    icon: Reply,
    title: "Reply from Agentra",
    description: "Answer from the shared inbox — it's delivered on Instagram.",
  },
  {
    icon: UserRound,
    title: "Customer context",
    description: "The sender's name and photo are pulled in automatically.",
  },
] as const;

const HOW_IT_WORKS = [
  "Sign in with Facebook and approve access",
  "Pick the Instagram account linked to your Page",
  "New DMs start landing in your inbox",
] as const;

function formatConnectedAt(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function InstagramSettingsPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [instagram, setInstagram] = useState<InstagramChannelIntegration>(DEFAULT_INSTAGRAM);
  const [configured, setConfigured] = useState(true);
  const [oauthRedirectUri, setOauthRedirectUri] = useState("");
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const clearOAuthParams = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("instagram");
    params.delete("message");
    params.delete("account");
    router.replace(`/settings?${params.toString()}`, { scroll: false });
  }, [router, searchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await instagramChannelApi.getStatus();
      setInstagram(data.data.instagram ?? DEFAULT_INSTAGRAM);
      setConfigured(Boolean(data.data.configured));
      setOauthRedirectUri(data.data.oauthRedirectUri ?? "");
    } catch (err: unknown) {
      const { message } = getApiError(err, "Failed to load Instagram settings");
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const result = searchParams.get("instagram");
    if (!result) return;

    if (result === "connected") {
      const account = searchParams.get("account");
      toast.success(account ? `Connected to @${account}` : "Instagram account connected");
      clearOAuthParams();
      void load();
      return;
    }

    if (result === "select_account") {
      toast.message("Choose the Instagram account you want to use");
      clearOAuthParams();
      void load();
      return;
    }

    if (result === "error") {
      toast.error(searchParams.get("message") || "Instagram connection failed");
      clearOAuthParams();
      void load();
    }
  }, [searchParams, clearOAuthParams, load]);

  const startConnect = async () => {
    setConnecting(true);
    try {
      const { data } = await instagramChannelApi.getOAuthUrl(window.location.origin);
      window.location.assign(data.data.url);
    } catch (err: unknown) {
      const { message } = getApiError(err, "Could not start Instagram connection");
      toast.error(message);
      setConnecting(false);
    }
  };

  const connectAccount = async (igUserId: string) => {
    setSelectingId(igUserId);
    try {
      const { data } = await instagramChannelApi.connectAccount(igUserId);
      setInstagram(data.data.instagram);
      toast.success(`Connected to @${data.data.instagram.igUsername ?? "account"}`);
    } catch (err: unknown) {
      const { message } = getApiError(err, "Could not connect Instagram account");
      toast.error(message);
    } finally {
      setSelectingId(null);
    }
  };

  const disconnect = async () => {
    setDisconnecting(true);
    try {
      const { data } = await instagramChannelApi.disconnect();
      setInstagram(data.data.instagram ?? DEFAULT_INSTAGRAM);
      toast.success("Instagram disconnected");
    } catch (err: unknown) {
      const { message } = getApiError(err, "Could not disconnect Instagram");
      toast.error(message);
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <SettingsPanelShell title="Instagram" description="Direct messages inbox">
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      </SettingsPanelShell>
    );
  }

  if (!configured) {
    return (
      <SettingsPanelShell title="Instagram" description="Direct messages inbox">
        <div className="mx-auto max-w-lg space-y-4 text-sm text-muted-foreground">
          <p>To enable Instagram DMs, add a Meta app to your server environment:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li><code className="text-foreground">META_APP_ID</code></li>
            <li><code className="text-foreground">META_APP_SECRET</code></li>
            <li><code className="text-foreground">META_WEBHOOK_VERIFY_TOKEN</code></li>
          </ul>
          <p>
            Create an app at{" "}
            <a
              href="https://developers.facebook.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              Meta for Developers
              <ExternalLink className="size-3.5" />
            </a>
            , add the <strong className="text-foreground">Instagram</strong> product, then set the OAuth redirect URI to:
          </p>
          {oauthRedirectUri ? (
            <code className="block rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-xs text-foreground">
              {oauthRedirectUri}
            </code>
          ) : null}
        </div>
      </SettingsPanelShell>
    );
  }

  if (instagram.status === "connected" && instagram.igUsername) {
    const connectedAt = formatConnectedAt(instagram.connectedAt);
    return (
      <SettingsPanelShell title="Instagram" description="Direct messages inbox">
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="overflow-hidden rounded-2xl border border-border/70">
            <div className="flex items-center gap-4 border-b border-border/60 bg-emerald-500/5 p-5">
              <div className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/70 bg-card">
                {instagram.igPictureUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={instagram.igPictureUrl} alt="" className="size-14 object-cover" />
                ) : (
                  <ChannelBrandIcon channel="instagram" className="size-7" />
                )}
                <span className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full bg-card">
                  <ChannelBrandIcon channel="instagram" className="size-4" />
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                    Connected
                  </span>
                </div>
                <p className="mt-0.5 truncate text-base font-semibold text-foreground">
                  @{instagram.igUsername}
                </p>
                <p className="text-xs text-muted-foreground">
                  Instagram{instagram.pageName ? ` · via ${instagram.pageName}` : ""}
                  {connectedAt ? ` · linked ${connectedAt}` : ""}
                </p>
              </div>
              <Link
                href="/inbox"
                className="hidden shrink-0 items-center gap-1.5 rounded-lg border border-border/70 bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary sm:inline-flex"
              >
                <Inbox className="size-4" />
                Open inbox
              </Link>
            </div>

            <div className="grid gap-px bg-border/60 sm:grid-cols-3">
              {CAPABILITIES.map((cap) => (
                <div key={cap.title} className="bg-card p-4">
                  <cap.icon className="size-5 text-primary" />
                  <p className="mt-2 text-sm font-medium text-foreground">{cap.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {cap.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            New Instagram DMs to{" "}
            <span className="font-medium text-foreground">@{instagram.igUsername}</span> arrive in
            your inbox as Instagram tickets. Replies you send there go straight back to the customer
            on Instagram.
          </p>

          <div className="flex flex-wrap items-center gap-3 border-t border-border/60 pt-5">
            <Button type="button" variant="outline" onClick={() => void startConnect()} disabled={connecting}>
              {connecting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Switch account
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => void disconnect()}
              disabled={disconnecting}
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

  if (instagram.status === "pending" && (instagram.pendingAccounts?.length ?? 0) > 0) {
    return (
      <SettingsPanelShell title="Instagram" description="Choose an account">
        <div className="mx-auto max-w-xl space-y-5">
          <div>
            <h4 className="text-base font-semibold text-foreground">
              Which Instagram account should Agentra manage?
            </h4>
            <p className="mt-1 text-sm text-muted-foreground">
              We found more than one Instagram account linked to your Pages. Pick the one you use
              for customer DMs — you can switch later.
            </p>
          </div>
          <div className="space-y-2.5">
            {instagram.pendingAccounts?.map((account) => (
              <button
                key={account.igUserId}
                type="button"
                onClick={() => void connectAccount(account.igUserId)}
                disabled={selectingId !== null}
                className={cn(
                  "flex w-full items-center gap-4 rounded-xl border border-border/70 bg-card p-4 text-left transition-colors",
                  "hover:border-primary/40 hover:bg-primary/5 disabled:opacity-60",
                )}
              >
                <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-muted/30">
                  {account.igPictureUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={account.igPictureUrl} alt="" className="size-11 object-cover" />
                  ) : (
                    <ChannelBrandIcon channel="instagram" className="size-5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">@{account.igUsername}</p>
                  {account.pageName ? (
                    <p className="truncate text-xs text-muted-foreground">via {account.pageName}</p>
                  ) : null}
                </div>
                {selectingId === account.igUserId ? (
                  <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
                ) : (
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                )}
              </button>
            ))}
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => void startConnect()} disabled={connecting}>
            {connecting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Use a different account
          </Button>
        </div>
      </SettingsPanelShell>
    );
  }

  return (
    <SettingsPanelShell title="Instagram" description="Direct messages inbox">
      <div className="mx-auto max-w-2xl">
        <div className="flex flex-col items-center rounded-2xl border border-border/70 bg-gradient-to-b from-primary/5 to-transparent px-6 py-10 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl border border-border/70 bg-card shadow-sm">
            <ChannelBrandIcon channel="instagram" className="size-9" />
          </div>
          <h4 className="mt-5 text-xl font-semibold text-foreground">
            Manage Instagram DMs from Agentra
          </h4>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            Connect your Instagram professional account so direct messages become tickets your
            whole team can answer — without leaving Agentra.
          </p>
          <Button type="button" className="mt-6" size="lg" onClick={() => void startConnect()} disabled={connecting}>
            {connecting ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Instagram className="mr-2 size-4" />
            )}
            Continue with Facebook
          </Button>
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5" />
            Your Instagram account must be a Professional account linked to a Facebook Page
          </p>
          {instagram.lastError ? (
            <p className="mt-5 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {instagram.lastError}
            </p>
          ) : null}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {CAPABILITIES.map((cap) => (
            <div key={cap.title} className="rounded-xl border border-border/70 bg-card p-4">
              <cap.icon className="size-5 text-primary" />
              <p className="mt-2 text-sm font-medium text-foreground">{cap.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                {cap.description}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-xl border border-border/70 bg-muted/20 p-5">
          <div className="flex items-center gap-2">
            <MessagesSquare className="size-4 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">How it works</p>
          </div>
          <ol className="mt-3 space-y-2.5">
            {HOW_IT_WORKS.map((step, index) => (
              <li key={step} className="flex items-start gap-3 text-sm text-muted-foreground">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </SettingsPanelShell>
  );
}
