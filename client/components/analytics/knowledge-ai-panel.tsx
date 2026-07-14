"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BookOpen,
  Check,
  FileWarning,
  Loader2,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { helpdeskAiApi } from "@/lib/api";
import { getApiError } from "@/lib/api-error";
import { APP_CARD, APP_INNER_TILE, APP_SECTION_LABEL } from "@/lib/app-surfaces";
import { cn } from "@/lib/utils";
import type { KnowledgeAiDraft, KnowledgeIntelligence } from "@/lib/types";

const KIND_LABELS: Record<string, string> = {
  article: "Article",
  macro: "Macro",
  guide: "Guide",
  policy: "Policy",
  troubleshooting: "Flow",
};

export default function KnowledgeAiPanel() {
  const [data, setData] = useState<KnowledgeIntelligence | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await helpdeskAiApi.getKnowledgeIntelligence(false);
      setData((res.data.knowledgeAi as KnowledgeIntelligence) || null);
    } catch (err: unknown) {
      const { message } = getApiError(err, "Failed to load Knowledge AI");
      toast.error(message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const generateDrafts = async () => {
    setGenerating(true);
    try {
      const { data: res } = await helpdeskAiApi.generateKnowledgeDrafts(4);
      const drafts = (res.data.drafts as KnowledgeAiDraft[]) || [];
      toast.success(
        drafts.length ? `Generated ${drafts.length} draft(s)` : "No new drafts needed right now",
      );
      await load();
    } catch (err: unknown) {
      const { message } = getApiError(err, "Could not generate drafts");
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  };

  const publish = async (id: string) => {
    setBusyId(id);
    try {
      await helpdeskAiApi.publishKnowledgeDraft(id);
      toast.success("Draft published to knowledge base");
      await load();
    } catch (err: unknown) {
      const { message } = getApiError(err, "Publish failed");
      toast.error(message);
    } finally {
      setBusyId(null);
    }
  };

  const dismiss = async (id: string) => {
    setBusyId(id);
    try {
      await helpdeskAiApi.dismissKnowledgeDraft(id);
      toast.success("Draft dismissed");
      setData((prev) =>
        prev
          ? { ...prev, drafts: (prev.drafts || []).filter((d) => d.id !== id) }
          : prev,
      );
    } catch (err: unknown) {
      const { message } = getApiError(err, "Dismiss failed");
      toast.error(message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className={cn(APP_CARD, "overflow-hidden")}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-muted/30">
            <BookOpen className="size-4 text-foreground" strokeWidth={1.75} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Knowledge AI</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Gaps, draft articles/macros, and outdated knowledge
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={loading || generating}
            onClick={() => void generateDrafts()}
          >
            {generating ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 size-3.5" />
            )}
            Generate drafts
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={() => void load()}
          >
            {loading ? <Loader2 className="size-3.5 animate-spin" /> : "Refresh"}
          </Button>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex justify-center py-14">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : !data ? (
        <p className="px-5 py-10 text-center text-sm text-muted-foreground">
          Knowledge intelligence is unavailable. Enable toggles under Settings → Helpdesk AI.
        </p>
      ) : (
        <div className="space-y-6 p-5">
          <div className="space-y-3">
            <p className={APP_SECTION_LABEL}>Knowledge gaps</p>
            {(data.gaps || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No significant gaps detected from recent tickets.
              </p>
            ) : (
              <ul className="space-y-2">
                {(data.gaps || []).slice(0, 6).map((gap) => (
                  <li key={gap.topic} className={cn(APP_INNER_TILE, "p-3")}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-sm font-medium capitalize text-foreground">
                        {(gap.topic || "topic").replace(/_/g, " ")}
                      </p>
                      <span className="text-[11px] tabular-nums text-muted-foreground">
                        {gap.ticketCount ?? 0} tickets
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {gap.message}
                    </p>
                    {(gap.relatedArticles || []).length > 0 ? (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Weak match:{" "}
                        {(gap.relatedArticles || []).map((a) => a.title).join(", ")}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-3">
            <p className={APP_SECTION_LABEL}>Pending drafts</p>
            {(data.drafts || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No drafts waiting. Use Generate drafts when gaps need coverage.
              </p>
            ) : (
              <ul className="space-y-2">
                {(data.drafts || []).map((draft) => (
                  <li key={draft.id} className={cn(APP_INNER_TILE, "space-y-2 p-3")}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{draft.title}</p>
                        <p className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                          {KIND_LABELS[draft.kind || "article"] || draft.kind} · needs approval
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          type="button"
                          size="sm"
                          disabled={busyId === draft.id}
                          onClick={() => void publish(draft.id)}
                        >
                          {busyId === draft.id ? (
                            <Loader2 className="mr-1 size-3.5 animate-spin" />
                          ) : (
                            <Check className="mr-1 size-3.5" />
                          )}
                          Publish
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={busyId === draft.id}
                          aria-label="Dismiss draft"
                          onClick={() => void dismiss(draft.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                    <p className="line-clamp-3 text-xs text-muted-foreground">{draft.content}</p>
                    {draft.reason ? (
                      <p className="text-[11px] text-muted-foreground">{draft.reason}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <FileWarning className="size-3.5 text-muted-foreground" />
              <p className={APP_SECTION_LABEL}>Possibly outdated</p>
            </div>
            {(data.outdated || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No outdated knowledge signals right now.</p>
            ) : (
              <ul className="space-y-2">
                {(data.outdated || []).slice(0, 6).map((row) => (
                  <li key={row.articleId} className={cn(APP_INNER_TILE, "p-3")}>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{row.title}</p>
                      {row.severity === "high" ? (
                        <span className="rounded-md border border-border/70 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-amber-600 dark:text-amber-400">
                          High
                        </span>
                      ) : null}
                    </div>
                    <ul className="mt-1 space-y-0.5">
                      {(row.reasons || []).map((r) => (
                        <li key={r} className="text-xs text-muted-foreground">
                          · {r}
                        </li>
                      ))}
                    </ul>
                    {row.aiNote ? (
                      <p className="mt-1 text-xs text-muted-foreground">{row.aiNote}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
