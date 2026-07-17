import type { ReactNode } from "react";
import { Fragment } from "react";
import type { Attachment } from "@/lib/types";
import {
  isMessageHtml,
  sanitizeMessageHtml,
} from "@/lib/sanitize-message-html";
import { stripQuotedPlainText } from "@/lib/email-reply-strip";
import { cn } from "@/lib/utils";

/** Legacy ticket messages were stored as `[Sender Name] body`. */
const SENDER_PREFIX_RE = /^\[([^\]]+)\]\s*/;

export function extractTicketSenderPrefix(body?: string | null): string | null {
  const match = String(body || "").match(SENDER_PREFIX_RE);
  const name = match?.[1]?.replace(/\s*-\s*$/, "").trim();
  return name || null;
}

export function stripTicketSenderPrefix(body?: string | null): string {
  return String(body || "").replace(SENDER_PREFIX_RE, "").trimStart();
}

function renderMarkdownLine(text: string, keyPrefix: string) {
  const parts: ReactNode[] = [];
  const pattern =
    /(\*\*.+?\*\*|\*.+?\*|__.+?__|!\[[^\]]*\]\([^)]+\)|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }
    const token = match[0];
    const id = `${keyPrefix}-${i++}`;

    if (token.startsWith("**")) {
      parts.push(
        <strong key={id} className="font-semibold">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith("*")) {
      parts.push(
        <em key={id} className="italic">
          {token.slice(1, -1)}
        </em>,
      );
    } else if (token.startsWith("__")) {
      parts.push(
        <span key={id} className="underline">
          {token.slice(2, -2)}
        </span>,
      );
    } else if (token.startsWith("![")) {
      const altEnd = token.indexOf("](");
      const alt = token.slice(2, altEnd);
      const url = token.slice(altEnd + 2, -1);
      parts.push(
        <a key={id} href={url} target="_blank" rel="noopener noreferrer" className="block py-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={alt || "Image"} className="max-h-48 rounded-md border border-border/60" />
        </a>,
      );
    } else if (token.startsWith("[")) {
      const labelEnd = token.indexOf("](");
      const label = token.slice(1, labelEnd);
      const url = token.slice(labelEnd + 2, -1);
      parts.push(
        <a
          key={id}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2"
        >
          {label}
        </a>,
      );
    }

    last = match.index + token.length;
  }

  if (last < text.length) {
    parts.push(text.slice(last));
  }

  return parts.length > 0 ? parts : [text];
}

export function FormattedMessageBody({
  body,
  attachments,
  className,
}: {
  body: string;
  attachments?: Attachment[];
  className?: string;
}) {
  const displayBody = stripTicketSenderPrefix(body);

  if (isMessageHtml(displayBody)) {
    const safe = sanitizeMessageHtml(displayBody);
    return (
      <div className={cn("text-foreground", className)}>
        <div
          className="break-words leading-normal [&_a]:text-primary [&_a]:underline [&_div]:my-0 [&_img.inline-emoji]:my-0 [&_img.inline-emoji]:inline-block [&_img.inline-emoji]:size-[1.1em] [&_img.inline-emoji]:align-[-0.15em] [&_img.inline-emoji]:border-0 [&_img:not(.inline-emoji)]:my-2 [&_img:not(.inline-emoji)]:max-h-48 [&_img:not(.inline-emoji)]:rounded-md [&_img:not(.inline-emoji)]:border [&_img:not(.inline-emoji)]:border-border/60 [&_p]:my-0 [&_p+p]:mt-2 [&_video]:my-2 [&_video]:max-h-48 [&_video]:max-w-full [&_video]:rounded-md [&_video]:border [&_video]:border-border/60"
          dangerouslySetInnerHTML={{ __html: safe }}
        />
        {attachments && attachments.length > 0 ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {attachments.map((file, index) => (
              <a
                key={`${file.url}-${index}`}
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-border/60 bg-muted/30 px-2 py-1 text-xs text-foreground hover:bg-muted/50"
              >
                {file.filename}
              </a>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  const lines = stripQuotedPlainText(displayBody).split("\n");

  return (
    <div className={cn("text-foreground", className)}>
      <div className="whitespace-pre-wrap break-words leading-normal">
        {lines.map((line, index) => (
          <Fragment key={index}>
            {index > 0 ? <br /> : null}
            {renderMarkdownLine(line, `line-${index}`)}
          </Fragment>
        ))}
      </div>
      {attachments && attachments.length > 0 ? (
        <div className="flex flex-wrap gap-2 pt-1">
          {attachments.map((file, index) => (
            <a
              key={`${file.url}-${index}`}
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-border/60 bg-muted/30 px-2 py-1 text-xs text-foreground hover:bg-muted/50"
            >
              {file.filename}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
