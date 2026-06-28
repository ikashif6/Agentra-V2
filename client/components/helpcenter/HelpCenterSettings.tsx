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
import { useAuth } from "@/contexts/AuthContext";
import { helpCenterApi } from "@/lib/api";
import type { HelpCenter, HelpCenterLayout } from "@/lib/types";

// ── Layout options ─────────────────────────────────────────────────────────────
const LAYOUTS: { id: HelpCenterLayout; label: string; description: string; preview: React.ReactNode }[] = [
  {
    id: "classic",
    label: "Classic",
    description: "Clean centered layout with a hero search bar and category cards below.",
    preview: (
      <div className="w-full h-20 rounded-lg bg-gradient-to-b from-brand-muted to-white border border-gray-200 flex flex-col items-center justify-center gap-1 p-2">
        <div className="w-3/4 h-2 rounded-full bg-orange-200" />
        <div className="w-1/2 h-1.5 rounded-full bg-gray-200" />
        <div className="flex gap-1 mt-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="w-8 h-5 rounded bg-gray-100 border border-gray-200" />
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
      <div className="w-full h-20 rounded-lg border border-gray-200 flex overflow-hidden">
        <div className="w-1/3 bg-brand-muted flex flex-col gap-1 p-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-1.5 rounded-full bg-orange-200" />
          ))}
        </div>
        <div className="flex-1 bg-white flex flex-col gap-1 p-2">
          <div className="h-2 w-3/4 rounded-full bg-gray-200" />
          <div className="h-1.5 w-full rounded-full bg-gray-100" />
          <div className="h-1.5 w-2/3 rounded-full bg-gray-100" />
        </div>
      </div>
    ),
  },
  {
    id: "cards",
    label: "Cards",
    description: "Bold card grid layout — great for visually organising topic categories.",
    preview: (
      <div className="w-full h-20 rounded-lg border border-gray-200 bg-gray-50 p-2">
        <div className="w-1/2 h-2 rounded-full bg-orange-200 mx-auto mb-2" />
        <div className="grid grid-cols-3 gap-1">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-5 rounded bg-white border border-gray-200 shadow-sm" />
          ))}
        </div>
      </div>
    ),
  },
];

// ── Feature toggle row ─────────────────────────────────────────────────────────
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
        <div className={cn("p-2 rounded-lg", enabled ? "bg-[#F0997B]/25" : "bg-gray-100")}>
          <Icon className={cn("h-4 w-4", enabled ? "text-[#D85A30]" : "text-gray-400")} />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">{label}</p>
          <p className="text-xs text-gray-400">{description}</p>
        </div>
      </div>
      <button
        onClick={onToggle}
        className={cn(
          "transition-colors shrink-0",
          enabled ? "text-[#D85A30]" : "text-gray-300 hover:text-gray-400"
        )}
        aria-label={enabled ? `Disable ${label}` : `Enable ${label}`}
      >
        {enabled ? <ToggleRight className="h-7 w-7" /> : <ToggleLeft className="h-7 w-7" />}
      </button>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function HelpCenterSettings() {
  const { company } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [helpCenter, setHelpCenter] = useState<HelpCenter | null>(null);

  // Local form state
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

  // Domain state
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
        <Loader2 className="h-6 w-6 animate-spin text-[#D85A30]" />
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── Published status banner ─────────────────────────────────────────── */}
      <div
        className={cn(
          "rounded-2xl p-4 border flex items-center justify-between",
          isPublished
            ? "bg-green-50 border-green-200"
            : "bg-yellow-50 border-yellow-200"
        )}
      >
        <div className="flex items-center gap-3">
          {isPublished ? (
            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 text-yellow-600 shrink-0" />
          )}
          <div>
            <p className={cn("text-sm font-semibold", isPublished ? "text-green-800" : "text-yellow-800")}>
              {isPublished ? "Help center is live" : "Help center is not published"}
            </p>
            {isPublished && (
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-green-600 hover:underline flex items-center gap-1"
              >
                {publicUrl}
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setIsPublished(!isPublished);
          }}
          className={cn(
            "text-xs border",
            isPublished
              ? "border-green-300 text-green-700 hover:bg-green-100"
              : "border-yellow-300 text-yellow-700 hover:bg-yellow-100"
          )}
        >
          {isPublished ? (
            <><EyeOff className="h-3.5 w-3.5 mr-1.5" /> Unpublish</>
          ) : (
            <><Eye className="h-3.5 w-3.5 mr-1.5" /> Publish</>
          )}
        </Button>
      </div>

      {/* ── Layout picker ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <LayoutTemplate className="h-4 w-4 text-[#D85A30]" />
          <h3 className="font-semibold text-gray-900">Layout</h3>
        </div>
        <div className="p-6">
          <p className="text-xs text-gray-400 mb-4">Choose how your help center looks to visitors.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {LAYOUTS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setLayout(opt.id)}
                className={cn(
                  "text-left p-3 rounded-xl border-2 transition-all",
                  layout === opt.id
                    ? "border-[#D85A30] bg-brand-muted"
                    : "border-gray-200 hover:border-gray-300 bg-white"
                )}
              >
                {opt.preview}
                <p className={cn("text-sm font-semibold mt-2", layout === opt.id ? "text-[#D85A30]" : "text-gray-700")}>
                  {opt.label}
                </p>
                <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{opt.description}</p>
                {layout === opt.id && (
                  <Badge className="mt-2 text-[10px] bg-[#D85A30] text-white border-0">Selected</Badge>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Branding ─────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Content</h3>
          <p className="text-xs text-gray-400 mt-0.5">Customize the title and subtitle shown to your visitors</p>
        </div>
        <div className="p-6 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-600">Help center title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              placeholder="Help Center"
              className="focus-visible:ring-[#D85A30]"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-600">Subtitle / tagline</Label>
            <Input
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              maxLength={300}
              placeholder="How can we help you?"
              className="focus-visible:ring-[#D85A30]"
            />
          </div>
        </div>
      </div>

      {/* ── Features ─────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Features</h3>
          <p className="text-xs text-gray-400 mt-0.5">Toggle what's available on your public help center</p>
        </div>
        <div className="px-6 divide-y divide-gray-50">
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
      </div>

      {/* ── Save button ──────────────────────────────────────────────────────── */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Save settings
        </Button>
      </div>

      <Separator />

      {/* ── Custom domain ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Globe className="h-4 w-4 text-[#D85A30]" />
          <h3 className="font-semibold text-gray-900">Custom domain</h3>
        </div>
        <div className="p-6 space-y-5">
          {/* Default domain info */}
          <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Default URL</p>
              <p className="text-sm font-mono font-medium text-gray-700">
                https://help.{company?.subdomain}.agentraa.com
              </p>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(`https://help.${company?.subdomain}.agentraa.com`);
                toast.success("Copied!");
              }}
              className="text-gray-400 hover:text-gray-600 shrink-0"
              title="Copy default URL"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>

          {/* Connected domain status */}
          {helpCenter?.customDomain ? (
            <div
              className={cn(
                "rounded-xl border p-4 space-y-3",
                helpCenter.customDomainVerified
                  ? "bg-green-50 border-green-200"
                  : "bg-yellow-50 border-yellow-200"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {helpCenter.customDomainVerified ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                  )}
                  <span className="text-sm font-semibold text-gray-800">
                    {helpCenter.customDomain}
                  </span>
                  <Badge
                    className={cn(
                      "text-[10px]",
                      helpCenter.customDomainVerified
                        ? "bg-green-100 text-green-700 border-green-200"
                        : "bg-yellow-100 text-yellow-700 border-yellow-200"
                    )}
                    variant="outline"
                  >
                    {helpCenter.customDomainVerified ? "Verified" : "Pending verification"}
                  </Badge>
                </div>
                <button
                  onClick={handleDisconnectDomain}
                  disabled={disconnectingDomain}
                  className="text-red-400 hover:text-red-600 transition-colors"
                  title="Disconnect domain"
                >
                  {disconnectingDomain
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Trash2 className="h-4 w-4" />}
                </button>
              </div>

              {!helpCenter.customDomainVerified && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleVerifyDomain}
                  disabled={verifyingDomain}
                  className="border-yellow-300 text-yellow-700 hover:bg-yellow-100"
                >
                  {verifyingDomain
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
                  Verify now
                </Button>
              )}
            </div>
          ) : (
            /* Connect new domain */
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Connect your own domain (e.g. <span className="font-mono text-[#D85A30]">help.yourcompany.com</span>).
                Your help center will be accessible at that address.
              </p>
              <div className="flex gap-2">
                <Input
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value.toLowerCase())}
                  placeholder="help.yourcompany.com"
                  className="font-mono focus-visible:ring-[#D85A30]"
                />
                <Button
                  onClick={handleConnectDomain}
                  disabled={connectingDomain || !domainInput.trim()}
                >
                  {connectingDomain
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : "Connect"}
                </Button>
              </div>
            </div>
          )}

          {/* DNS instructions */}
          {verificationInstructions && !helpCenter?.customDomainVerified && (
            <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 space-y-3">
              <p className="text-sm font-semibold text-blue-800">Add this DNS record to verify ownership</p>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="bg-white rounded-lg border border-blue-100 p-2">
                  <p className="text-blue-400 font-medium mb-1">Type</p>
                  <p className="font-mono font-semibold text-blue-900">{verificationInstructions.type}</p>
                </div>
                <div className="bg-white rounded-lg border border-blue-100 p-2 col-span-2">
                  <p className="text-blue-400 font-medium mb-1">Host / Name</p>
                  <div className="flex items-center justify-between gap-1">
                    <p className="font-mono font-semibold text-blue-900 truncate text-[10px]">
                      {verificationInstructions.host}
                    </p>
                    <button
                      onClick={() => { navigator.clipboard.writeText(verificationInstructions.host); toast.success("Copied!"); }}
                      className="text-blue-400 hover:text-blue-600 shrink-0"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg border border-blue-100 p-2">
                <p className="text-blue-400 font-medium text-xs mb-1">Value</p>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-[10px] text-blue-900 break-all">{verificationInstructions.value}</p>
                  <button
                    onClick={() => { navigator.clipboard.writeText(verificationInstructions.value); toast.success("Copied!"); }}
                    className="text-blue-400 hover:text-blue-600 shrink-0"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-blue-600">{verificationInstructions.note}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={handleVerifyDomain}
                disabled={verifyingDomain}
                className="border-blue-300 text-blue-700 hover:bg-blue-100"
              >
                {verifyingDomain
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
                I've added the record — verify now
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
