"use client";

import { Sparkles } from "lucide-react";

/** Workspace preview mock — outer shell follows theme; chat art stays illustrative. */
export function GeneratingWorkspaceScene() {
  return (
    <div className="mx-auto mt-10 w-full max-w-[520px] overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[0_24px_80px_-24px_rgba(0,0,0,0.18)] dark:border-white/[0.06] dark:shadow-[0_24px_80px_-24px_rgba(0,0,0,0.55)]">
      <div className="space-y-4 p-5">
        <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-muted px-4 py-3 text-[13px] leading-relaxed text-foreground/80">
          Hi! I&apos;m looking for a foundation that matches my skin tone. Can you help me find
          the right shade?
        </div>

        <div className="flex items-end justify-end gap-2">
          <div className="max-w-[72%] rounded-2xl rounded-tr-md bg-foreground px-4 py-3 text-[13px] leading-relaxed text-background">
            Medium with warm undertones
          </div>
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/80 text-[11px] font-semibold text-primary-foreground">
            EY
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-[12px] font-medium text-primary">
            <Sparkles className="size-3.5" aria-hidden="true" />
            AI Agent
          </div>
          <div className="max-w-[92%] rounded-2xl rounded-tl-md bg-muted px-4 py-3 text-[13px] leading-relaxed text-foreground/80">
            Based on your undertone, I&apos;d recommend our Warm Medium shade. It has great
            coverage and works well for everyday wear. Want me to add it to your cart?
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-border/60 bg-muted/40 p-3">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="flex aspect-[4/3] items-center justify-center rounded-xl border border-border/70 bg-card"
          >
            <div className="size-10 rounded-lg bg-gradient-to-br from-primary/40 to-primary" />
          </div>
        ))}
      </div>
    </div>
  );
}
