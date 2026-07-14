"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { helpdeskAiApi } from "@/lib/api";
import { getApiError } from "@/lib/api-error";
import type { HelpdeskAiSettings } from "@/lib/types";

const FEATURES: {
  key: keyof HelpdeskAiSettings;
  label: string;
  description: string;
}[] = [
  {
    key: "overview",
    label: "AI Overview",
    description: "Show issue summary, sentiment, and handoff context in the inbox sidebar.",
  },
  {
    key: "recommendedAction",
    label: "Recommended next action",
    description: "Suggest what the agent should do next with a confidence score.",
  },
  {
    key: "riskDetection",
    label: "Risk & escalation warnings",
    description: "Flag chargebacks, legal threats, fraud, and angry VIP customers.",
  },
  {
    key: "suggestedReply",
    label: "Suggested reply",
    description: "Draft a complete reply from conversation, orders, and knowledge.",
  },
  {
    key: "replyTools",
    label: "Reply improvement tools",
    description: "Make replies shorter, friendlier, more professional, and more.",
  },
  {
    key: "autoTag",
    label: "Automatic tagging & fields",
    description: "Suggest tags, priority, and contact reason from the conversation.",
  },
  {
    key: "autoRouting",
    label: "Intelligent routing / auto-assign",
    description: "Assign unassigned tickets to the best available agent after AI analysis.",
  },
  {
    key: "similarTickets",
    label: "Similar resolved tickets",
    description: "Surface past tickets with similar problems, outcomes, and replies that worked.",
  },
  {
    key: "customerProfile",
    label: "AI customer profile",
    description: "Orders, spend, loyalty, prior problems, and open issues for this customer.",
  },
  {
    key: "customerTimeline",
    label: "Customer timeline",
    description: "Readable history of orders and tickets across channels.",
  },
  {
    key: "contradictions",
    label: "Contradiction detector",
    description: "Warn when claims conflict with order data or prior AI promises.",
  },
  {
    key: "incidentDetection",
    label: "Incident & spike detection",
    description: "Group sudden bursts of similar issues and alert the inbox sidebar.",
  },
  {
    key: "mergeSuggestions",
    label: "Duplicate / merge suggestions",
    description: "Detect same-customer cross-channel tickets and allow one-click merge.",
  },
  {
    key: "slaPrediction",
    label: "SLA breach prediction",
    description: "Estimate risk of missing resolution SLA before it is overdue.",
  },
  {
    key: "resolutionCheck",
    label: "Resolution completeness check",
    description: "Warn before resolve/close if promises or questions look unfinished.",
  },
  {
    key: "qualityAssurance",
    label: "Quality assurance scoring",
    description: "Score resolved tickets for accuracy, empathy, tone, and policy compliance.",
  },
  {
    key: "agentCoaching",
    label: "Agent coaching insights",
    description: "Aggregate QA scores into per-agent coaching recommendations for managers.",
  },
  {
    key: "managerFeed",
    label: "Manager intelligence feed",
    description: "Volume shifts, handoffs, incidents, and tickets that need manager review.",
  },
  {
    key: "rootCauseAnalysis",
    label: "Root-cause analysis",
    description: "Cluster recent tickets by topic and explain likely operational causes.",
  },
  {
    key: "churnRecovery",
    label: "Churn recovery tips",
    description: "Flag at-risk customers and suggest recovery actions (apology, credit, escalate).",
  },
  {
    key: "knowledgeGaps",
    label: "Knowledge-gap detector",
    description: "Find topics with handoffs, reopenings, or manual resolves that lack a solid article.",
  },
  {
    key: "draftArticles",
    label: "AI knowledge drafts",
    description: "Generate draft help articles and macros from gaps — publish only after approval.",
  },
  {
    key: "outdatedKnowledge",
    label: "Outdated knowledge detection",
    description: "Flag stale, conflicting, or rarely cited articles that may need a review.",
  },
];

const DEFAULTS: HelpdeskAiSettings = {
  overview: true,
  suggestedReply: true,
  replyTools: true,
  recommendedAction: true,
  riskDetection: true,
  autoTag: true,
  autoRouting: false,
  similarTickets: true,
  customerProfile: true,
  customerTimeline: true,
  contradictions: true,
  incidentDetection: true,
  mergeSuggestions: true,
  slaPrediction: true,
  resolutionCheck: true,
  qualityAssurance: true,
  agentCoaching: true,
  managerFeed: true,
  rootCauseAnalysis: true,
  churnRecovery: true,
  knowledgeGaps: true,
  draftArticles: true,
  outdatedKnowledge: true,
};

export default function HelpdeskAiSettingsPanel() {
  const [settings, setSettings] = useState<HelpdeskAiSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await helpdeskAiApi.getSettings();
      setSettings({ ...DEFAULTS, ...(data.data.helpdeskAi || {}) });
    } catch (err: unknown) {
      const { message } = getApiError(err, "Failed to load Helpdesk AI settings");
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (key: keyof HelpdeskAiSettings, value: boolean) => {
    if (!settings) return;
    const next = { ...settings, [key]: value };
    setSettings(next);
    setSaving(true);
    try {
      const { data } = await helpdeskAiApi.updateSettings({ [key]: value });
      setSettings({ ...DEFAULTS, ...(data.data.helpdeskAi || {}) });
      toast.success("Helpdesk AI settings saved");
    } catch (err: unknown) {
      const { message } = getApiError(err, "Could not save settings");
      toast.error(message);
      await load();
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/30 px-3 py-1 text-xs font-medium text-muted-foreground">
          <Sparkles className="size-3.5" />
          Inbox intelligence
        </div>
        <h2 className="text-xl font-bold text-foreground">Helpdesk AI</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Copilot for human agents, customer context, ticket ops, manager QA, and knowledge gaps —
          toggle each capability as your team is ready.
        </p>
      </div>

      <section className="overflow-hidden rounded-xl border border-border/80 bg-card">
        <div className="border-b border-border/60 px-5 py-4">
          <p className="text-sm font-medium text-foreground">Features</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Turn capabilities on as your team is ready. Knowledge articles still come from AI Agent /
            Live chat.
          </p>
        </div>
        <ul className="divide-y divide-border/60">
          {FEATURES.map((feature) => (
            <li key={feature.key} className="flex items-start justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <Label className="text-sm font-medium text-foreground">{feature.label}</Label>
                <p className="mt-0.5 text-xs text-muted-foreground">{feature.description}</p>
              </div>
              <Switch
                checked={Boolean(settings[feature.key])}
                disabled={saving}
                onCheckedChange={(v) => void toggle(feature.key, v)}
                aria-label={feature.label}
              />
            </li>
          ))}
        </ul>
      </section>

      <div className="flex justify-end">
        <Button type="button" variant="outline" disabled={saving} onClick={() => void load()}>
          {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Refresh
        </Button>
      </div>
    </div>
  );
}
