"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ChevronDown,
  Inbox,
  Loader2,
  Mail,
  Reply,
  ShieldCheck,
  Ticket,
  Unplug,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { emailChannelApi } from "@/lib/api";
import { getApiError } from "@/lib/api-error";
import type { EmailChannelIntegration } from "@/lib/types";
import { cn } from "@/lib/utils";
import SettingsPanelShell from "./settings-panel-shell";

const DEFAULT_EMAIL: EmailChannelIntegration = { status: "disconnected" };

const CAPABILITIES = [
  {
    icon: Ticket,
    title: "Auto-created tickets",
    description: "Every new email to your inbox opens a ticket.",
  },
  {
    icon: Reply,
    title: "Reply from your address",
    description: "Answers are sent from your own email — customers see you.",
  },
  {
    icon: UserRound,
    title: "Customer context",
    description: "The sender's name and email are captured automatically.",
  },
] as const;

function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}

function MicrosoftGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 23 23" className={className} aria-hidden="true">
      <path fill="#F25022" d="M1 1h10v10H1z" />
      <path fill="#7FBA00" d="M12 1h10v10H12z" />
      <path fill="#00A4EF" d="M1 12h10v10H1z" />
      <path fill="#FFB900" d="M12 12h10v10H12z" />
    </svg>
  );
}

function formatConnectedAt(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function EmailSettingsPanel() {
  const [email, setEmail] = useState<EmailChannelIntegration>(DEFAULT_EMAIL);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  // IMAP/SMTP form
  const [showImap, setShowImap] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    displayName: "",
    imapHost: "",
    imapPort: "",
    smtpHost: "",
    smtpPort: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await emailChannelApi.getStatus();
      setEmail(data.data.email ?? DEFAULT_EMAIL);
    } catch (err: unknown) {
      const { message } = getApiError(err, "Failed to load email settings");
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Prefill server settings when the user finishes typing their address.
  const onEmailBlur = useCallback(async () => {
    const addr = form.email.trim();
    if (!addr.includes("@")) return;
    try {
      const { data } = await emailChannelApi.guess(addr);
      const preset = data.data.preset;
      if (preset) {
        setForm((f) => ({
          ...f,
          imapHost: f.imapHost || preset.imapHost || "",
          imapPort: f.imapPort || String(preset.imapPort || ""),
          smtpHost: f.smtpHost || preset.smtpHost || "",
          smtpPort: f.smtpPort || String(preset.smtpPort || ""),
        }));
      }
    } catch {
      /* best effort */
    }
  }, [form.email]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("email");
    if (!status) return;
    if (status === "connected") {
      toast.success(
        params.get("provider") === "microsoft"
          ? "Outlook connected"
          : params.get("provider") === "google"
            ? "Gmail connected"
            : "Email connected",
      );
      void load();
    } else if (status === "error") {
      toast.error(params.get("message") || "Email connect failed");
    }
    params.delete("email");
    params.delete("provider");
    params.delete("message");
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
    window.history.replaceState({}, "", next);
  }, [load]);

  const connectImap = async () => {
    if (!form.email.trim() || !form.password) {
      toast.error("Enter your email address and password");
      return;
    }
    setConnecting(true);
    try {
      const { data } = await emailChannelApi.connect({
        email: form.email.trim(),
        password: form.password,
        displayName: form.displayName.trim() || undefined,
        imapHost: form.imapHost.trim() || undefined,
        imapPort: form.imapPort ? Number(form.imapPort) : undefined,
        smtpHost: form.smtpHost.trim() || undefined,
        smtpPort: form.smtpPort ? Number(form.smtpPort) : undefined,
      });
      setEmail(data.data.email ?? DEFAULT_EMAIL);
      setShowImap(false);
      setForm({
        email: "",
        password: "",
        displayName: "",
        imapHost: "",
        imapPort: "",
        smtpHost: "",
        smtpPort: "",
      });
      toast.success(
        data.data.email?.outboundVia === "resend"
          ? "Email connected — inbound via IMAP; replies sent via secure relay (Reply-To: your address)"
          : "Email connected",
      );
    } catch (err: unknown) {
      const { message } = getApiError(err, "Could not connect email");
      toast.error(message);
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    setDisconnecting(true);
    try {
      const { data } = await emailChannelApi.disconnect();
      setEmail(data.data.email ?? DEFAULT_EMAIL);
      toast.success("Email disconnected");
    } catch (err: unknown) {
      const { message } = getApiError(err, "Could not disconnect email");
      toast.error(message);
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <SettingsPanelShell title="Email" description="Inbound and outbound mail">
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      </SettingsPanelShell>
    );
  }

  if (email.status === "connected" && email.address) {
    const connectedAt = formatConnectedAt(email.connectedAt);
    return (
      <SettingsPanelShell title="Email" description="Inbound and outbound mail">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="overflow-hidden rounded-2xl border border-border/70">
            <div className="flex items-center gap-4 border-b border-border/60 bg-emerald-500/5 p-5">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-card">
                <Mail className="size-7 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                    Connected
                  </span>
                </div>
                <p className="mt-0.5 truncate text-base font-semibold text-foreground">
                  {email.address}
                </p>
                <p className="text-xs text-muted-foreground">
                  {email.provider === "imap" ? "IMAP / SMTP" : email.provider}
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
            New emails to <span className="font-medium text-foreground">{email.address}</span> arrive
            in your inbox as tickets.
            {email.outboundVia === "resend" ? (
              <>
                {" "}
                Replies are delivered via Agentra&apos;s mail relay with{" "}
                <span className="font-medium text-foreground">Reply-To: {email.address}</span> — customer
                replies still land in your inbox.
              </>
            ) : (
              <> Replies you send are delivered from your own address, so conversations stay threaded for the customer.</>
            )}
          </p>

          <div className="flex flex-wrap items-center gap-3 border-t border-border/60 pt-5">
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

  return (
    <SettingsPanelShell title="Email" description="Inbound and outbound mail">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-2xl border border-border/70 bg-gradient-to-b from-primary/5 to-transparent px-6 py-8 text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-2xl border border-border/70 bg-card shadow-sm">
            <Mail className="size-8 text-primary" />
          </div>
          <h4 className="mt-5 text-xl font-semibold text-foreground">
            Connect your support email
          </h4>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            Bring your existing mailbox into Agentra — Gmail, Outlook, or any address like
            support@yourcompany.com. Incoming email becomes tickets and replies are sent from your
            own address.
          </p>
        </div>

        {/* Three connect options */}
        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={() => toast.message("Gmail connect is coming soon.")}
            className="flex w-full items-center gap-4 rounded-xl border border-border/70 bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60 opacity-60"
          >
            <GoogleGlyph className="size-6 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">Connect with Google</p>
              <p className="text-xs text-muted-foreground">Gmail &amp; Google Workspace · one click</p>
            </div>
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Coming soon
            </span>
          </button>

          <button
            type="button"
            onClick={() => toast.message("Microsoft email connect is coming soon.")}
            className="flex w-full items-center gap-4 rounded-xl border border-border/70 bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 opacity-60"
          >
            <MicrosoftGlyph className="size-6 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">Connect with Microsoft</p>
              <p className="text-xs text-muted-foreground">Outlook &amp; Microsoft 365 · one click</p>
            </div>
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Coming soon
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowImap((v) => !v)}
            className={cn(
              "flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-colors",
              showImap
                ? "border-primary/50 bg-primary/5"
                : "border-border/70 bg-card hover:border-primary/40 hover:bg-primary/5",
            )}
          >
            <Mail className="size-6 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">Other email (IMAP / SMTP)</p>
              <p className="text-xs text-muted-foreground">
                Any provider or custom domain · works everywhere
              </p>
            </div>
            <ChevronDown
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform",
                showImap && "rotate-180",
              )}
            />
          </button>
        </div>

        {/* IMAP/SMTP form */}
        {showImap ? (
          <div className="mt-3 space-y-4 rounded-xl border border-border/70 bg-muted/20 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="em-address">Email address</Label>
                <Input
                  id="em-address"
                  type="email"
                  placeholder="support@yourcompany.com"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  onBlur={() => void onEmailBlur()}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="em-password">Password / app password</Label>
                <Input
                  id="em-password"
                  type="password"
                  autoComplete="off"
                  placeholder="••••••••••••"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="em-name">Sender name (optional)</Label>
              <Input
                id="em-name"
                placeholder="Your Company Support"
                value={form.displayName}
                onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
              />
            </div>

            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {showAdvanced ? "Hide server settings" : "Server settings (auto-detected)"}
            </button>

            {showAdvanced ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="em-imap-host">IMAP host</Label>
                  <Input
                    id="em-imap-host"
                    placeholder="imap.yourprovider.com"
                    value={form.imapHost}
                    onChange={(e) => setForm((f) => ({ ...f, imapHost: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="em-imap-port">IMAP port</Label>
                  <Input
                    id="em-imap-port"
                    placeholder="993"
                    value={form.imapPort}
                    onChange={(e) => setForm((f) => ({ ...f, imapPort: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="em-smtp-host">SMTP host</Label>
                  <Input
                    id="em-smtp-host"
                    placeholder="smtp.yourprovider.com"
                    value={form.smtpHost}
                    onChange={(e) => setForm((f) => ({ ...f, smtpHost: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="em-smtp-port">SMTP port</Label>
                  <Input
                    id="em-smtp-port"
                    placeholder="465"
                    value={form.smtpPort}
                    onChange={(e) => setForm((f) => ({ ...f, smtpPort: e.target.value }))}
                  />
                </div>
              </div>
            ) : null}

            <div className="rounded-lg border border-border/60 bg-card px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
              <p className="font-medium text-foreground">Using Gmail or Outlook?</p>
              Turn on 2-step verification and create an{" "}
              <span className="font-medium text-foreground">app password</span> — paste that here
              instead of your normal password.
            </div>

            <Button type="button" onClick={() => void connectImap()} disabled={connecting}>
              {connecting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Connect email
            </Button>
          </div>
        ) : null}

        {email.lastError ? (
          <p className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {email.lastError}
          </p>
        ) : null}

        <p className="mt-6 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5" />
          Your credentials are encrypted and used only to sync this mailbox.
        </p>
      </div>
    </SettingsPanelShell>
  );
}
