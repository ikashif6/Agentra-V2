"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import {
  Bold,
  Image as ImageIcon,
  Italic,
  Link2,
  Loader2,
  Paperclip,
  Smile,
  Underline,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { uploadApi } from "@/lib/api";
import { sanitizeMessageHtml, editorHasContent } from "@/lib/sanitize-message-html";
import type { Attachment } from "@/lib/types";
import { cn } from "@/lib/utils";
import { EmojiPickerMenu } from "@/components/inbox/emoji-picker-menu";
import { buildEmojiHtml } from "@/lib/emoji-picker";

type InboxReplyComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: (payload: { body: string; attachments: Attachment[] }) => void;
  sending?: boolean;
  placeholder?: string;
};

export function InboxReplyComposer({
  value,
  onChange,
  onSend,
  sending = false,
  placeholder = "Write a reply…",
}: InboxReplyComposerProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const editorWrapRef = useRef<HTMLDivElement>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const savedSelectionRef = useRef<Range | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isInternalUpdate = useRef(false);

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkPopoverPos, setLinkPopoverPos] = useState({ top: 8, left: 8 });
  const [isEmpty, setIsEmpty] = useState(true);
  const [formatActive, setFormatActive] = useState({
    bold: false,
    italic: false,
    underline: false,
  });

  const updateFormatState = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;

    if (!editorHasContent(el.innerHTML)) {
      setFormatActive({ bold: false, italic: false, underline: false });
      return;
    }

    const selection = document.getSelection();
    if (
      !selection ||
      selection.rangeCount === 0 ||
      !selection.anchorNode ||
      !el.contains(selection.anchorNode) ||
      document.activeElement !== el
    ) {
      setFormatActive({ bold: false, italic: false, underline: false });
      return;
    }

    setFormatActive({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
    });
  }, []);

  const clearFormatState = useCallback(() => {
    setFormatActive({ bold: false, italic: false, underline: false });
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", updateFormatState);
    return () => document.removeEventListener("selectionchange", updateFormatState);
  }, [updateFormatState]);

  const syncFromEditor = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const html = el.innerHTML;
    setIsEmpty(!editorHasContent(html));
    isInternalUpdate.current = true;
    onChange(html);
    requestAnimationFrame(updateFormatState);
  }, [onChange, updateFormatState]);

  // Only reset editor when parent clears it (e.g. after send), not on every keystroke.
  useEffect(() => {
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }
    const el = editorRef.current;
    if (!el) return;
    el.innerHTML = value || "";
    setIsEmpty(!editorHasContent(value));
  }, [value]);

  const focusEditor = () => {
    editorRef.current?.focus();
  };

  const exec = (command: string, commandValue?: string) => {
    focusEditor();
    document.execCommand(command, false, commandValue);
    syncFromEditor();
    requestAnimationFrame(updateFormatState);
  };

  const saveSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && editorRef.current?.contains(selection.anchorNode)) {
      savedSelectionRef.current = selection.getRangeAt(0).cloneRange();
    }
  };

  const restoreSelection = () => {
    const selection = window.getSelection();
    const range = savedSelectionRef.current;
    if (!selection || !range) return;
    selection.removeAllRanges();
    selection.addRange(range);
  };

  const getLinkUrlFromSelection = () => {
    const selection = window.getSelection();
    if (!selection?.anchorNode || !editorRef.current?.contains(selection.anchorNode)) return "";

    let node: Node | null = selection.anchorNode;
    if (node.nodeType === Node.TEXT_NODE) {
      node = node.parentElement;
    }
    const anchor = (node as HTMLElement | null)?.closest("a");
    return anchor?.getAttribute("href") ?? "";
  };

  const updateLinkPopoverPosition = () => {
    const wrap = editorWrapRef.current;
    const selection = window.getSelection();
    if (!wrap) return;

    const wrapRect = wrap.getBoundingClientRect();
    if (selection && selection.rangeCount > 0 && editorRef.current?.contains(selection.anchorNode)) {
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      const popoverWidth = 300;
      const left = Math.min(
        Math.max(rect.left - wrapRect.left, 0),
        Math.max(wrapRect.width - popoverWidth, 0),
      );
      setLinkPopoverPos({
        top: Math.max(rect.bottom - wrapRect.top + 6, 8),
        left,
      });
      return;
    }

    setLinkPopoverPos({ top: 8, left: 8 });
  };

  const closeLinkPopover = useCallback(() => {
    setLinkOpen(false);
    setLinkUrl("");
    savedSelectionRef.current = null;
  }, []);

  useEffect(() => {
    if (!linkOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (editorWrapRef.current?.contains(target)) return;
      closeLinkPopover();
    };

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") closeLinkPopover();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [linkOpen, closeLinkPopover]);

  const uploadFiles = async (files: File[]) => {
    setUploading(true);
    try {
      const { data } = await uploadApi.upload(files);
      return (data.data.attachments ?? []) as Attachment[];
    } catch {
      toast.error("Could not upload file");
      return [];
    } finally {
      setUploading(false);
    }
  };

  const isImageFile = (file: Attachment) =>
    (file.mimetype?.startsWith("image/") ?? false) ||
    /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(file.filename);

  const handleImagePick = async (fileList: FileList | null) => {
    if (!fileList?.length) return;
    const uploaded = await uploadFiles([fileList[0]]);
    if (imageInputRef.current) imageInputRef.current.value = "";
    if (!uploaded[0]) return;
    const file = uploaded[0];
    setAttachments((prev) => [...prev, file]);
    setIsEmpty(false);
  };

  const handleAttachmentPick = async (fileList: FileList | null) => {
    if (!fileList?.length) return;
    const uploaded = await uploadFiles(Array.from(fileList));
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!uploaded.length) return;
    setAttachments((prev) => [...prev, ...uploaded]);
    setIsEmpty(false);
  };

  const keepFocus = (event: MouseEvent) => {
    event.preventDefault();
  };

  const openLinkPopover = () => {
    saveSelection();
    setLinkUrl(getLinkUrlFromSelection());
    updateLinkPopoverPosition();
    setLinkOpen(true);
    requestAnimationFrame(() => linkInputRef.current?.focus());
  };

  const insertLink = () => {
    const url = linkUrl.trim();
    if (!url) return;

    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    restoreSelection();
    focusEditor();

    const selectedText = window.getSelection()?.toString().trim() ?? "";
    if (selectedText) {
      document.execCommand("createLink", false, href);
    } else {
      document.execCommand("insertHTML", false, `<a href="${href}">${href}</a>`);
    }

    syncFromEditor();
    closeLinkPopover();
  };

  const onLinkInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      insertLink();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeLinkPopover();
    }
  };

  const insertEmoji = (emoji: { native: string; unified: string }) => {
    focusEditor();
    document.execCommand("insertHTML", false, buildEmojiHtml(emoji));
    syncFromEditor();
    requestAnimationFrame(updateFormatState);
  };

  const handleSend = () => {
    const html = sanitizeMessageHtml(editorRef.current?.innerHTML ?? value);
    if (!editorHasContent(html) && attachments.length === 0) return;
    onSend({ body: html, attachments });
    setAttachments([]);
    isInternalUpdate.current = true;
    if (editorRef.current) {
      editorRef.current.innerHTML = "";
    }
    setIsEmpty(true);
    clearFormatState();
    onChange("");
  };

  const toolbarBtnClass = (active = false) =>
    cn(
      "inline-flex size-8 shrink-0 items-center justify-center rounded-lg border transition-colors",
      active
        ? "border-primary/50 bg-primary/10 text-primary"
        : "border-border/60 bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
      "disabled:opacity-50",
    );

  return (
    <div className="border-t border-border/60 p-4">
      <div className="mb-2 flex flex-wrap items-center gap-1">
        <button
          type="button"
          className={toolbarBtnClass(formatActive.bold)}
          aria-label="Bold"
          aria-pressed={formatActive.bold}
          onMouseDown={keepFocus}
          onClick={() => exec("bold")}
        >
          <Bold className="size-4 shrink-0" />
        </button>
        <button
          type="button"
          className={toolbarBtnClass(formatActive.italic)}
          aria-label="Italic"
          aria-pressed={formatActive.italic}
          onMouseDown={keepFocus}
          onClick={() => exec("italic")}
        >
          <Italic className="size-4 shrink-0" />
        </button>
        <button
          type="button"
          className={toolbarBtnClass(formatActive.underline)}
          aria-label="Underline"
          aria-pressed={formatActive.underline}
          onMouseDown={keepFocus}
          onClick={() => exec("underline")}
        >
          <Underline className="size-4 shrink-0" />
        </button>
        <button
          type="button"
          className={toolbarBtnClass()}
          aria-label="Insert link"
          aria-pressed={linkOpen}
          onMouseDown={(event) => {
            keepFocus(event);
            saveSelection();
          }}
          onClick={openLinkPopover}
        >
          <Link2 className="size-4" />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className={toolbarBtnClass()}
                aria-label="Insert emoji"
                onMouseDown={keepFocus}
              >
                <Smile className="size-4" />
              </button>
            }
          />
          <EmojiPickerMenu
            onKeepFocus={keepFocus}
            onPick={insertEmoji}
          />
        </DropdownMenu>

        <button
          type="button"
          className={toolbarBtnClass()}
          aria-label="Insert image"
          disabled={uploading}
          onMouseDown={keepFocus}
          onClick={() => imageInputRef.current?.click()}
        >
          <ImageIcon className="size-4" />
        </button>

        <button
          type="button"
          className={toolbarBtnClass()}
          aria-label="Attach file"
          disabled={uploading}
          onMouseDown={keepFocus}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
        </button>
      </div>

      <div ref={editorWrapRef} className="relative">
        {linkOpen ? (
          <div
            className="absolute z-20 flex max-w-[calc(100%-1rem)] items-center gap-1 rounded-lg border border-border/60 bg-card py-1 pl-2 pr-1 shadow-md"
            style={{ top: linkPopoverPos.top, left: linkPopoverPos.left, width: 300 }}
            onMouseDown={(event) => event.preventDefault()}
          >
            <Link2 className="size-4 shrink-0 text-muted-foreground" />
            <Input
              ref={linkInputRef}
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="Type or paste a link"
              className="h-8 min-w-0 flex-1 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
              onKeyDown={onLinkInputKeyDown}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 shrink-0 px-2.5 text-xs font-medium"
              disabled={!linkUrl.trim()}
              onClick={insertLink}
            >
              Apply
            </Button>
          </div>
        ) : null}

        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          dir="ltr"
          role="textbox"
          aria-multiline="true"
          aria-label={placeholder}
          data-placeholder={placeholder}
          onInput={syncFromEditor}
          onFocus={updateFormatState}
          onBlur={clearFormatState}
          onKeyUp={updateFormatState}
          onMouseUp={updateFormatState}
          onKeyDown={(e) => {
            // Enter sends; Shift+Enter (or Ctrl/Cmd+Enter) inserts a new line.
            if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          className={cn(
            "min-h-[88px] w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-left text-sm outline-none",
            "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            "dark:bg-input/30 empty:before:pointer-events-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]",
            "[&_b]:font-semibold [&_strong]:font-semibold [&_i]:italic [&_em]:italic [&_u]:underline",
            "[&_img.inline-emoji]:inline-block [&_img.inline-emoji]:size-[1.1em] [&_img.inline-emoji]:align-[-0.15em] [&_img.inline-emoji]:border-0",
            "[&_a]:text-primary [&_a]:underline",
          )}
        />
      </div>

      {attachments.length > 0 ? (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          {attachments.map((file, index) =>
            isImageFile(file) ? (
              <div
                key={`${file.url}-${index}`}
                className="group relative inline-flex"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={file.url}
                  alt={file.filename}
                  className="size-14 rounded-md border border-border/60 object-cover"
                />
                <button
                  type="button"
                  className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full border border-border/60 bg-card text-xs text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground"
                  onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== index))}
                  aria-label={`Remove ${file.filename}`}
                >
                  ×
                </button>
              </div>
            ) : (
              <span
                key={`${file.url}-${index}`}
                className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/30 px-2 py-0.5 text-xs text-muted-foreground"
              >
                {file.filename}
                <button
                  type="button"
                  className="text-foreground/60 hover:text-foreground"
                  onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== index))}
                  aria-label={`Remove ${file.filename}`}
                >
                  ×
                </button>
              </span>
            ),
          )}
        </div>
      ) : null}

      <div className="mt-2 flex justify-end">
        <Button
          onClick={handleSend}
          disabled={sending || uploading || (isEmpty && attachments.length === 0)}
        >
          {sending ? "Sending…" : "Send reply"}
        </Button>
      </div>

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void handleImagePick(e.target.files)}
      />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => void handleAttachmentPick(e.target.files)}
      />
    </div>
  );
}
