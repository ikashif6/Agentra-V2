"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Loader2, Globe, CheckCircle2, Copy, ExternalLink, Trash2,
  LayoutTemplate, ToggleLeft, ToggleRight, RefreshCw, AlertCircle,
  Eye, EyeOff, BookOpen, MessageSquare, Ticket, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { APP_PANEL } from "@/lib/app-surfaces";
import { useAuth } from "@/contexts/AuthContext";
import { helpCenterApi } from "@/lib/api";
import type { HelpCenter, HelpCenterLayout } from "@/lib/types";

const LAYOUTS: { id: HelpCenterLayout; label: string; description: string; preview: React.ReactNode }[] = [
  {
    id: "classic",
    label: "Classic",
    description: "Clean centered layout with a hero search bar and category cards below.",
    preview: (
      <div className="flex h-20 w-full flex-col items-center justify-center gap-1 rounded-lg border border-border bg-gradient-to-b from-brand-muted/60 to-card p-2">
        <div className="h-2 w-3/4 rounded-full bg-primary/30" />
        <div className="h-1.5 w-1/2 rounded-full bg-muted" />
        <div className="mt-1 flex gap-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-5 w-8 rounded border border-border bg-muted/60" />
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "sidebar",
    label: "Sidebar",
    description: "Two-column layout with a category navigation on the left and content on the right.",
    preview: (
      <div className="flex h-20 w-full overflow-hidden rounded-lg border border-border">
        <div className="flex w-1/3 flex-col gap-1 bg-brand-muted/40 p-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-1.5 rounded-full bg-primary/25" />
          ))}
        </div>
        <div className="flex flex-1 flex-col gap-1 bg-card p-2">
          <div className="h-2 w-3/4 rounded-full bg-muted" />
          <div className="h-1.5 w-full rounded-full bg-muted/70" />
          <div className="h-1.5 w-2/3 rounded-full bg-muted/70" />
        </div>
      </div>
    ),
  },
  {
    id: "cards",
    label: "Cards",
    description: "Bold card grid layout, great for visually organising topic categories.",
    preview: (
      <div className="h-20 w-full rounded-lg border border-border bg-muted/30 p-2">
        <div className="mx-auto mb-2 h-2 w-1/2 rounded-full bg-primary/25" />
        <div className="grid grid-cols-3 gap-1">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-5 rounded border border-border bg-card shadow-sm" />
          ))}
        </div>
      </div>
    ),
  },
];

function FeatureRow({
  icon: Icon,
  label,
  description,
  enabled,
  onToggle,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-start gap-3">
        <div className={cn("rounded-lg p-2", enabled ? "bg-primary/10" : "bg-muted")}>
          <Icon className={cn("h-4 w-4", enabled ? "text-primary" : "text-muted-foreground")} />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <button
        onClick={onToggle}
        className={cn(
          "shrink-0 transition-colors",
          enabled ? "text-primary" : "text-muted-foreground hover:text-foreground",
        )}
        aria-label={enabled ? `Disable ${label}` : `Enable ${label}`}
      >
        {enabled ? <ToggleRight className="h-7 w-7" /> : <ToggleLeft className="h-7 w-7" />}
      </button>
    </div>
  );
}

function SettingsSection({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description?: string;
  icon?: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(APP_PANEL)}>
      <div className="flex items-center gap-2 border-b border-border/60 px-6 py-4">
        {Icon ? <Icon className="h-4 w-4 text-primary" /> : null}
        <div>
          <h3 className="font-semibold text-foreground">{title}</h3>
          {description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

export default function HelpCenterSettings() {
  const { company } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [helpCenter, setHelpCenter] = useState<HelpCenter | null>(null);

  const [layout, setLayout] = useState<HelpCenterLayout>("classic");
  const [title, setTitle] = useState("Help Center");
  const [subtitle, setSubtitle] = useState("How can we help you?");
  const [features, setFeatures] = useState({
    contactForm: true,
    raiseTicket: true,
    ticketTracking: true,
    search: true,
  });
  const [isPublished, setIsPublished] = useState(false);

  const [domainInput, setDomainInput] = useState("");
  const [connectingDomain, setConnectingDomain] = useState(false);
  const [verifyingDomain, setVerifyingDomain] = useState(false);
  const [disconnectingDomain, setDisconnectingDomain] = useState(false);
  const [verificationInstructions, setVerificationInstructions] = useState<{
    type: string;
    host: string;
    value: string;
    note: string;
  } | null>(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await helpCenterApi.getSettings();
      const hc: HelpCenter | null = data.data.helpCenter;
      setHelpCenter(hc);
      if (hc) {
        setLayout(hc.layout);
        setTitle(hc.title);
        setSubtitle(hc.subtitle);
        setFeatures({ ...hc.features });
        setIsPublished(hc.isPublished);
      }
    } catch {
      toast.error("Failed to load help center settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await helpCenterApi.saveSettings({
        layout,
        title,
        subtitle,
        features,
        isPublished,
      });
      setHelpCenter(data.data.helpCenter);
      toast.success("Help center settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleConnectDomain = async () => {
    if (!domainInput.trim()) return;
    setConnectingDomain(true);
    try {
      const { data } = await helpCenterApi.connectDomain(domainInput.trim());
      setVerificationInstructions(data.data.instructions);
      await fetchSettings();
      toast.success("Domain saved. Add the DNS TXT record to verify.");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to connect domain";
      toast.error(msg);
    } finally {
      setConnectingDomain(false);
    }
  };

  const handleVerifyDomain = async () => {
    setVerifyingDomain(true);
    try {
      const { data } = await helpCenterApi.verifyDomain();
      await fetchSettings();
      setVerificationInstructions(null);
      toast.success(data.message ?? "Domain verified!");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Verification failed";
      toast.error(msg);
    } finally {
      setVerifyingDomain(false);
    }
  };

  const handleDisconnectDomain = async () => {
    setDisconnectingDomain(true);
    try {
      await helpCenterApi.disconnectDomain();
      await fetchSettings();
      setVerificationInstructions(null);
      setDomainInput("");
      toast.success("Custom domain disconnected");
    } catch {
      toast.error("Failed to disconnect domain");
    } finally {
      setDisconnectingDomain(false);
    }
  };

  const publicUrl = helpCenter?.publicUrl ?? `https://help.${company?.subdomain}.agentraa.com`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          {isPublished ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0 text-muted-foreground" />
          )}
          <div>
            <p className="text-sm font-semibold text-foreground">
              {isPublished ? "Help center is live" : "Help center is not published"}
            </p>
            {isPublished ? (
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                {publicUrl}
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <p className="text-xs text-muted-foreground">
                Publish when you are ready for visitors to access your help center.
              </p>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsPublished(!isPublished)}
        >
          {isPublished ? (
            <>
              <EyeOff className="mr-1.5 h-3.5 w-3.5" /> Unpublish
            </>
          ) : (
            <>
              <Eye className="mr-1.5 h-3.5 w-3.5" /> Publish
            </>
          )}
        </Button>
      </div>

      <SettingsSection title="Layout" icon={LayoutTemplate}>
        <p className="mb-4 text-xs text-muted-foreground">
          Choose how your help center looks to visitors.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {LAYOUTS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setLayout(opt.id)}
              className={cn(
                "rounded-xl border-2 p-3 text-left transition-all",
                layout === opt.id
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:border-primary/30 hover:bg-muted/30",
              )}
            >
              {opt.preview}
              <p className={cn("mt-2 text-sm font-semibold", layout === opt.id ? "text-primary" : "text-foreground")}>
                {opt.label}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{opt.description}</p>
              {layout === opt.id ? (
                <Badge className="mt-2 border-0 bg-primary text-[10px] text-primary-foreground">Selected</Badge>
              ) : null}
            </button>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="Content" description="Customize the title and subtitle shown to your visitors">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Help center title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder="Help Center" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Subtitle / tagline</Label>
            <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} maxLength={300} placeholder="How can we help you?" />
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Features" description="Toggle what's available on your public help center">
        <div className="divide-y divide-border/60">
          <FeatureRow
            icon={MessageSquare}
            label="Contact form"
            description="Let visitors send you a message without logging in"
            enabled={features.contactForm}
            onToggle={() => setFeatures((f) => ({ ...f, contactForm: !f.contactForm }))}
          />
          <FeatureRow
            icon={Ticket}
            label="Raise a ticket"
            description="Allow visitors to create a support ticket directly"
            enabled={features.raiseTicket}
            onToggle={() => setFeatures((f) => ({ ...f, raiseTicket: !f.raiseTicket }))}
          />
          <FeatureRow
            icon={BookOpen}
            label="Ticket tracking"
            description="Let customers check the status of their existing tickets"
            enabled={features.ticketTracking}
            onToggle={() => setFeatures((f) => ({ ...f, ticketTracking: !f.ticketTracking }))}
          />
          <FeatureRow
            icon={Search}
            label="Search"
            description="Show a search bar at the top of the help center"
            enabled={features.search}
            onToggle={() => setFeatures((f) => ({ ...f, search: !f.search }))}
          />
        </div>
      </SettingsSection>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save settings
        </Button>
      </div>

      <Separator />

      <SettingsSection title="Custom domain" icon={Globe}>
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
            <div>
              <p className="mb-0.5 text-xs text-muted-foreground">Default URL</p>
              <p className="font-mono text-sm font-medium text-foreground">
                https://help.{company?.subdomain}.agentraa.com
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(`https://help.${company?.subdomain}.agentraa.com`);
                toast.success("Copied!");
              }}
              className="shrink-0 text-muted-foreground hover:text-foreground"
              title="Copy default URL"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>

          {helpCenter?.customDomain ? (
            <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {helpCenter.customDomainVerified ? (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-sm font-semibold text-foreground">{helpCenter.customDomain}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {helpCenter.customDomainVerified ? "Verified" : "Pending verification"}
                  </Badge>
                </div>
                <button
                  type="button"
                  onClick={handleDisconnectDomain}
                  disabled={disconnectingDomain}
                  className="text-destructive transition-colors hover:text-destructive/80"
                  title="Disconnect domain"
                >
                  {disconnectingDomain ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </div>

              {!helpCenter.customDomainVerified ? (
                <Button size="sm" variant="outline" onClick={handleVerifyDomain} disabled={verifyingDomain}>
                  {verifyingDomain ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Verify now
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Connect your own domain (e.g.{" "}
                <span className="font-mono text-primary">help.yourcompany.com</span>).
                Your help center will be accessible at that address.
              </p>
              <div className="flex gap-2">
                <Input
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value.toLowerCase())}
                  placeholder="help.yourcompany.com"
                  className="font-mono"
                />
                <Button onClick={handleConnectDomain} disabled={connectingDomain || !domainInput.trim()}>
                  {connectingDomain ? <Loader2 className="h-4 w-4 animate-spin" /> : "Connect"}
                </Button>
              </div>
            </div>
          )}

          {verificationInstructions && !helpCenter?.customDomainVerified ? (
            <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
              <p className="text-sm font-semibold text-foreground">Add this DNS record to verify ownership</p>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-lg border border-border bg-card p-2">
                  <p className="mb-1 font-medium text-muted-foreground">Type</p>
                  <p className="font-mono font-semibold text-foreground">{verificationInstructions.type}</p>
                </div>
                <div className="col-span-2 rounded-lg border border-border bg-card p-2">
                  <p className="mb-1 font-medium text-muted-foreground">Host / Name</p>
                  <div className="flex items-center justify-between gap-1">
                    <p className="truncate font-mono text-[10px] font-semibold text-foreground">
                      {verificationInstructions.host}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(verificationInstructions.host);
                        toast.success("Copied!");
                      }}
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-card p-2">
                <p className="mb-1 text-xs font-medium text-muted-foreground">Value</p>
                <div className="flex items-center justify-between gap-2">
                  <p className="break-all font-mono text-[10px] text-foreground">{verificationInstructions.value}</p>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(verificationInstructions.value);
                      toast.success("Copied!");
                    }}
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{verificationInstructions.note}</p>
              <Button size="sm" variant="outline" onClick={handleVerifyDomain} disabled={verifyingDomain}>
                {verifyingDomain ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                )}
                I&apos;ve added the record. Verify now
              </Button>
            </div>
          ) : null}
        </div>
      </SettingsSection>
    </div>
  );
}
