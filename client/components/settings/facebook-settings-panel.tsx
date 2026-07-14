"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronRight,
  CheckCircle2,
  ExternalLink,
  Inbox,
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
import { facebookChannelApi } from "@/lib/api";
import { getApiError } from "@/lib/api-error";
import type { FacebookChannelIntegration } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChannelBrandIcon } from "@/components/onboarding/channel-brand-icons";
import SettingsPanelShell from "./settings-panel-shell";

const DEFAULT_FACEBOOK: FacebookChannelIntegration = {
  status: "disconnected",
  pendingPages: [],
};

const CAPABILITIES = [
  {
    icon: Ticket,
    title: "Auto-created tickets",
    description: "Every new Messenger chat opens a ticket in your inbox.",
  },
  {
    icon: Reply,
    title: "Reply from Agentra",
    description: "Answer from the shared inbox — it's delivered on Messenger.",
  },
  {
    icon: UserRound,
    title: "Customer context",
    description: "The sender's name and photo are pulled in automatically.",
  },
] as const;

const HOW_IT_WORKS = [
  "Sign in with Facebook and approve access",
  "Pick the Page you use for customer chats",
  "New messages start landing in your inbox",
] as const;

function formatConnectedAt(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

type FacebookSettingsPanelProps = {
  returnTo?: string;
};

export default function FacebookSettingsPanel({ returnTo }: FacebookSettingsPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [facebook, setFacebook] = useState<FacebookChannelIntegration>(DEFAULT_FACEBOOK);
  const [configured, setConfigured] = useState(true);
  const [oauthRedirectUri, setOauthRedirectUri] = useState("");
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [selectingPageId, setSelectingPageId] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const clearOAuthParams = useCallback(() => {
    if (returnTo) {
      router.replace(returnTo, { scroll: false });
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.delete("facebook");
    params.delete("message");
    params.delete("page");
    router.replace(`/settings?${params.toString()}`, { scroll: false });
  }, [router, searchParams, returnTo]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await facebookChannelApi.getStatus();
      setFacebook(data.data.facebook ?? DEFAULT_FACEBOOK);
      setConfigured(Boolean(data.data.configured));
      setOauthRedirectUri(data.data.oauthRedirectUri ?? "");
    } catch (err: unknown) {
      const { message } = getApiError(err, "Failed to load Facebook settings");
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const result = searchParams.get("facebook");
    if (!result) return;

    if (result === "connected") {
      const page = searchParams.get("page");
      toast.success(page ? `Connected to ${page}` : "Facebook Page connected");
      clearOAuthParams();
      void load();
      return;
    }

    if (result === "select_page") {
      toast.message("Choose the Facebook Page you want to use for Messenger");
      clearOAuthParams();
      void load();
      return;
    }

    if (result === "error") {
      toast.error(searchParams.get("message") || "Facebook connection failed");
      clearOAuthParams();
      void load();
    }
  }, [searchParams, clearOAuthParams, load]);

  const startConnect = async () => {
    setConnecting(true);
    try {
      const { data } = await facebookChannelApi.getOAuthUrl(
        window.location.origin,
        returnTo,
      );
      window.location.assign(data.data.url);
    } catch (err: unknown) {
      const { message } = getApiError(err, "Could not start Facebook connection");
      toast.error(message);
      setConnecting(false);
    }
  };

  const connectPage = async (pageId: string) => {
    setSelectingPageId(pageId);
    try {
      const { data } = await facebookChannelApi.connectPage(pageId);
      setFacebook(data.data.facebook);
      toast.success(`Connected to ${data.data.facebook.pageName}`);
    } catch (err: unknown) {
      const { message } = getApiError(err, "Could not connect Facebook Page");
      toast.error(message);
    } finally {
      setSelectingPageId(null);
    }
  };

  const disconnect = async () => {
    setDisconnecting(true);
    try {
      const { data } = await facebookChannelApi.disconnect();
      setFacebook(data.data.facebook ?? DEFAULT_FACEBOOK);
      toast.success("Facebook disconnected");
    } catch (err: unknown) {
      const { message } = getApiError(err, "Could not disconnect Facebook");
      toast.error(message);
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <SettingsPanelShell title="Facebook" description="Messenger and page inbox">
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      </SettingsPanelShell>
    );
  }

  if (!configured) {
    return (
      <SettingsPanelShell title="Facebook" description="Messenger and page inbox">
        <div className="mx-auto max-w-lg space-y-4 text-sm text-muted-foreground">
          <p>
            To enable one-click Facebook connection, add a Meta app to your server environment:
          </p>
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
            , add the <strong className="text-foreground">Facebook Login</strong> and{" "}
            <strong className="text-foreground">Messenger</strong> products, then set the OAuth redirect URI to:
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

  if (facebook.status === "connected" && facebook.pageName) {
    const connectedAt = formatConnectedAt(facebook.connectedAt);
    return (
      <SettingsPanelShell title="Facebook" description="Messenger and page inbox">
        <div className="mx-auto max-w-3xl space-y-6">
          {/* Connected Page identity */}
          <div className="overflow-hidden rounded-2xl border border-border/70">
            <div className="flex items-center gap-4 border-b border-border/60 bg-emerald-500/5 p-5">
              <div className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/70 bg-card">
                {facebook.pagePictureUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={facebook.pagePictureUrl}
                    alt=""
                    className="size-14 object-cover"
                  />
                ) : (
                  <ChannelBrandIcon channel="facebook" className="size-7" />
                )}
                <span className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full bg-card">
                  <ChannelBrandIcon channel="facebook" className="size-4" />
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
                  {facebook.pageName}
                </p>
                <p className="text-xs text-muted-foreground">
                  Facebook Page{connectedAt ? ` · linked ${connectedAt}` : ""}
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

            {/* What's live now */}
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
            New Messenger conversations from{" "}
            <span className="font-medium text-foreground">{facebook.pageName}</span> arrive in your
            inbox as Facebook tickets. Replies you send there are delivered straight back to the
            customer on Messenger.
          </p>

          <div className="flex flex-wrap items-center gap-3 border-t border-border/60 pt-5">
            <Button type="button" variant="outline" onClick={() => void startConnect()} disabled={connecting}>
              {connecting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Switch Page
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

  if (facebook.status === "pending" && (facebook.pendingPages?.length ?? 0) > 0) {
    return (
      <SettingsPanelShell title="Facebook" description="Choose a Page">
        <div className="mx-auto max-w-xl space-y-5">
          <div>
            <h4 className="text-base font-semibold text-foreground">
              Which Page should Agentra manage?
            </h4>
            <p className="mt-1 text-sm text-muted-foreground">
              We found more than one Page on your account. Pick the one you use to chat with
              customers — you can switch later.
            </p>
          </div>
          <div className="space-y-2.5">
            {facebook.pendingPages?.map((page) => (
              <button
                key={page.id}
                type="button"
                onClick={() => void connectPage(page.id)}
                disabled={selectingPageId !== null}
                className={cn(
                  "flex w-full items-center gap-4 rounded-xl border border-border/70 bg-card p-4 text-left transition-colors",
                  "hover:border-primary/40 hover:bg-primary/5 disabled:opacity-60",
                )}
              >
                <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-muted/30">
                  {page.pictureUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={page.pictureUrl} alt="" className="size-11 object-cover" />
                  ) : (
                    <ChannelBrandIcon channel="facebook" className="size-5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{page.name}</p>
                  {page.category ? (
                    <p className="truncate text-xs text-muted-foreground">{page.category}</p>
                  ) : null}
                </div>
                {selectingPageId === page.id ? (
                  <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
                ) : (
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                )}
              </button>
            ))}
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => void startConnect()} disabled={connecting}>
            {connecting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Use a different Facebook account
          </Button>
        </div>
      </SettingsPanelShell>
    );
  }

  return (
    <SettingsPanelShell title="Facebook" description="Messenger and page inbox">
      <div className="mx-auto max-w-3xl">
        {/* Hero */}
        <div className="flex flex-col items-center rounded-2xl border border-border/70 bg-gradient-to-b from-primary/5 to-transparent px-6 py-10 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl border border-border/70 bg-card shadow-sm">
            <ChannelBrandIcon channel="facebook" className="size-9" />
          </div>
          <h4 className="mt-5 text-xl font-semibold text-foreground">
            Turn Messenger into a support inbox
          </h4>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            Connect your Facebook Page so customer messages become tickets your whole team can
            answer — right from Agentra.
          </p>
          <Button type="button" className="mt-6" size="lg" onClick={() => void startConnect()} disabled={connecting}>
            {connecting ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <ChannelBrandIcon channel="facebook" className="mr-2 size-4" monochrome />
            )}
            Connect Facebook
          </Button>
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5" />
            Takes about a minute · you choose which Page to share
          </p>
          {facebook.lastError ? (
            <p className="mt-5 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {facebook.lastError}
            </p>
          ) : null}
        </div>

        {/* What you get */}
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

        {/* How it works */}
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
