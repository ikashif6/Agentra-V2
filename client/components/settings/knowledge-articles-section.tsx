"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { helpdeskAiApi, liveChatApi } from "@/lib/api";
import { getApiError } from "@/lib/api-error";
import type { ChatKnowledgeArticle } from "@/lib/types";
import { cn } from "@/lib/utils";

type KnowledgeArticlesSectionProps = {
  className?: string;
  /** Extra note under the section intro */
  description?: string;
};

const KIND_LABELS: Record<string, string> = {
  article: "Article",
  macro: "Macro",
  guide: "Guide",
  policy: "Policy",
  troubleshooting: "Flow",
};

export default function KnowledgeArticlesSection({
  className,
  description = "Used by AI on every enabled channel. Editing here updates the same knowledge base as Live chat.",
}: KnowledgeArticlesSectionProps) {
  const [articles, setArticles] = useState<ChatKnowledgeArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [newArticle, setNewArticle] = useState({ title: "", content: "" });
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ title: "", content: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [busyDraftId, setBusyDraftId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await liveChatApi.listKnowledge();
      setArticles(data.data.articles ?? []);
    } catch (err: unknown) {
      const { message } = getApiError(err, "Failed to load knowledge articles");
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const drafts = useMemo(
    () => articles.filter((a) => a.status === "draft"),
    [articles],
  );
  const published = useMemo(
    () => articles.filter((a) => a.status !== "draft"),
    [articles],
  );

  const publishDraft = async (id: string) => {
    setBusyDraftId(id);
    try {
      const { data } = await helpdeskAiApi.publishKnowledgeDraft(id);
      const updated = data.data.article as ChatKnowledgeArticle;
      setArticles((prev) => prev.map((a) => (a._id === id ? updated : a)));
      toast.success("Draft published");
    } catch (err: unknown) {
      const { message } = getApiError(err, "Publish failed");
      toast.error(message);
    } finally {
      setBusyDraftId(null);
    }
  };

  const dismissDraft = async (id: string) => {
    setBusyDraftId(id);
    try {
      await helpdeskAiApi.dismissKnowledgeDraft(id);
      setArticles((prev) => prev.filter((a) => a._id !== id));
      if (editingId === id) {
        setEditingId(null);
        setEditDraft({ title: "", content: "" });
      }
      toast.success("Draft dismissed");
    } catch (err: unknown) {
      const { message } = getApiError(err, "Dismiss failed");
      toast.error(message);
    } finally {
      setBusyDraftId(null);
    }
  };

  const addArticle = async () => {
    if (!newArticle.title.trim() || !newArticle.content.trim()) return;
    try {
      const { data } = await liveChatApi.createKnowledge(newArticle);
      setArticles((prev) => [...prev, data.data.article]);
      setNewArticle({ title: "", content: "" });
      toast.success("Article added");
    } catch (err: unknown) {
      const { message } = getApiError(err, "Failed to add article");
      toast.error(message);
    }
  };

  const uploadDocument = async (file: File) => {
    setUploading(true);
    try {
      const { data } = await liveChatApi.uploadKnowledgeDocument(file);
      const created = (data.data.articles ?? []) as ChatKnowledgeArticle[];
      if (created.length) {
        setArticles((prev) => [...created, ...prev]);
      }
      const count = data.data.chunkCount ?? created.length;
      toast.success(
        count > 1
          ? `Imported ${count} articles from ${file.name}`
          : `Imported knowledge from ${file.name}`,
      );
    } catch (err: unknown) {
      const { message } = getApiError(err, "Failed to upload document");
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  const startEdit = (article: ChatKnowledgeArticle) => {
    setEditingId(article._id);
    setEditDraft({ title: article.title, content: article.content });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft({ title: "", content: "" });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const title = editDraft.title.trim();
    const content = editDraft.content.trim();
    if (!title || !content) {
      toast.error("Title and content are required");
      return;
    }
    setSavingEdit(true);
    try {
      const { data } = await liveChatApi.updateKnowledge(editingId, { title, content });
      const updated = data.data.article as ChatKnowledgeArticle;
      setArticles((prev) => prev.map((a) => (a._id === editingId ? updated : a)));
      cancelEdit();
      toast.success("Article updated");
    } catch (err: unknown) {
      const { message } = getApiError(err, "Failed to update article");
      toast.error(message);
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteArticle = async (id: string) => {
    try {
      await liveChatApi.deleteKnowledge(id);
      setArticles((prev) => prev.filter((a) => a._id !== id));
      if (editingId === id) cancelEdit();
      toast.success("Article removed");
    } catch (err: unknown) {
      const { message } = getApiError(err, "Failed to delete article");
      toast.error(message);
    }
  };

  if (loading) {
    return (
      <div className={cn("flex justify-center py-10", className)}>
        <Loader2 className="size-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}

      <div className="space-y-3 rounded-xl border border-border/60 p-4">
        <p className="text-sm font-semibold">Add article</p>
        <Input
          placeholder="Title (e.g. Return policy)"
          value={newArticle.title}
          onChange={(e) => setNewArticle({ ...newArticle, title: e.target.value })}
        />
        <Textarea
          rows={4}
          placeholder="Content the AI can retrieve when customers ask..."
          value={newArticle.content}
          onChange={(e) => setNewArticle({ ...newArticle, content: e.target.value })}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={() => void addArticle()}>
            <Plus className="mr-2 size-4" />
            Add article
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.txt,.md,.markdown,.csv,application/pdf,text/plain,text/markdown,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadDocument(file);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Upload className="mr-2 size-4" />
            )}
            Upload document
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Upload PDF, TXT, MD, or CSV. Large files may be split into multiple articles.
        </p>
      </div>

      {drafts.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold">AI drafts awaiting approval</p>
          <ul className="space-y-2">
            {drafts.map((article) => (
              <li
                key={article._id}
                className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{article.title}</p>
                    <p className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                      {KIND_LABELS[article.kind || "article"] || article.kind} draft
                    </p>
                    <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{article.content}</p>
                    {article.draftMeta?.reason ? (
                      <p className="mt-1 text-[11px] text-muted-foreground">{article.draftMeta.reason}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <Button
                      type="button"
                      size="sm"
                      disabled={busyDraftId === article._id}
                      onClick={() => void publishDraft(article._id)}
                    >
                      {busyDraftId === article._id ? (
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
                      disabled={busyDraftId === article._id}
                      onClick={() => void dismissDraft(article._id)}
                    >
                      <Trash2 className="mr-1 size-3.5" />
                      Dismiss
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {published.length === 0 && drafts.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
          No knowledge articles yet. Add policies, FAQs, or shipping guides the AI can cite.
        </p>
      ) : published.length === 0 ? null : (
        <ul className="space-y-2">
          {published.map((article) => {
            const isEditing = editingId === article._id;
            return (
              <li key={article._id} className="rounded-xl border border-border/60 p-4">
                {isEditing ? (
                  <div className="space-y-3">
                    <Input
                      value={editDraft.title}
                      disabled={savingEdit}
                      onChange={(e) => setEditDraft((d) => ({ ...d, title: e.target.value }))}
                      placeholder="Title"
                    />
                    <Textarea
                      rows={6}
                      value={editDraft.content}
                      disabled={savingEdit}
                      onChange={(e) => setEditDraft((d) => ({ ...d, content: e.target.value }))}
                      placeholder="Content"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" disabled={savingEdit} onClick={() => void saveEdit()}>
                        {savingEdit ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                        Save changes
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={savingEdit}
                        onClick={cancelEdit}
                      >
                        <X className="mr-1.5 size-3.5" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold">{article.title}</p>
                        {article.kind && article.kind !== "article" ? (
                          <span className="rounded-md border border-border/70 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                            {KIND_LABELS[article.kind] || article.kind}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{article.content}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit ${article.title}`}
                        onClick={() => startEdit(article)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${article.title}`}
                        onClick={() => void deleteArticle(article._id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
