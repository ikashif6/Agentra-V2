"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  Unplug,
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

export default function FacebookSettingsPanel() {
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
    const params = new URLSearchParams(searchParams.toString());
    params.delete("facebook");
    params.delete("message");
    params.delete("page");
    router.replace(`/settings?${params.toString()}`, { scroll: false });
  }, [router, searchParams]);

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
      const { data } = await facebookChannelApi.getOAuthUrl(window.location.origin);
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
    return (
      <SettingsPanelShell title="Facebook" description="Messenger and page inbox">
        <div className="mx-auto max-w-xl space-y-6">
          <div className="flex items-start gap-4 rounded-xl border border-border/70 bg-muted/20 p-5">
            <div className="flex size-12 items-center justify-center rounded-xl border border-border/70 bg-card">
              {facebook.pagePictureUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={facebook.pagePictureUrl}
                  alt=""
                  className="size-12 rounded-xl object-cover"
                />
              ) : (
                <ChannelBrandIcon channel="facebook" className="size-6" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-600" />
                <p className="font-semibold text-foreground">Connected</p>
              </div>
              <p className="mt-1 text-sm font-medium text-foreground">{facebook.pageName}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Messenger conversations from this Page will route into Agentra as Facebook tickets.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
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
      <SettingsPanelShell title="Facebook" description="Choose the Page for Messenger">
        <div className="mx-auto max-w-xl space-y-4">
          <p className="text-sm text-muted-foreground">
            Select which Facebook Page should receive Messenger conversations in Agentra.
          </p>
          <div className="space-y-3">
            {facebook.pendingPages?.map((page) => (
              <button
                key={page.id}
                type="button"
                onClick={() => void connectPage(page.id)}
                disabled={selectingPageId !== null}
                className={cn(
                  "flex w-full items-center gap-4 rounded-xl border border-border/70 bg-card p-4 text-left transition-colors",
                  "hover:border-primary/40 hover:bg-primary/5",
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
                  <p className="font-medium text-foreground">{page.name}</p>
                  {page.category ? (
                    <p className="text-xs text-muted-foreground">{page.category}</p>
                  ) : null}
                </div>
                {selectingPageId === page.id ? (
                  <Loader2 className="size-4 animate-spin text-primary" />
                ) : null}
              </button>
            ))}
          </div>
        </div>
      </SettingsPanelShell>
    );
  }

  return (
    <SettingsPanelShell title="Facebook" description="Messenger and page inbox">
      <div className="mx-auto flex max-w-xl flex-col items-center py-8 text-center">
        <div className="mb-5 flex size-16 items-center justify-center rounded-2xl border border-border/70 bg-muted/20">
          <ChannelBrandIcon channel="facebook" className="size-8" />
        </div>
        <h4 className="text-lg font-semibold text-foreground">Connect Facebook Messenger</h4>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Sign in with Facebook, pick your Page, and start receiving Messenger conversations in Agentra.
          Most workspaces finish in under a minute.
        </p>
        {facebook.lastError ? (
          <p className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {facebook.lastError}
          </p>
        ) : null}
        <Button type="button" className="mt-6" size="lg" onClick={() => void startConnect()} disabled={connecting}>
          {connecting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Continue with Facebook
        </Button>
      </div>
    </SettingsPanelShell>
  );
}
