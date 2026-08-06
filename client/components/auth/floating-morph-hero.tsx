"use client";

import { AuthGlassChatVisual } from "@/components/auth/auth-glass-chat-visual";

/**
 * Floating morphic auth hero — login/signup only.
 * Lovable-style oversized pulse art + dual blur layers.
 */
export function FloatingMorphHero() {
  return (
    <aside
      className="auth-morph-shell relative hidden h-full min-h-svh lg:block"
      aria-label="Product preview"
    >
      <div className="auth-morph-float relative h-full w-full overflow-hidden [contain:paint]">
        <div className="pointer-events-none absolute inset-0 blur-[10px]" aria-hidden="true">
          <div className="auth-morph-pulse-frame absolute max-w-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/auth/pulse.webp"
              alt=""
              className="absolute inset-0 h-full w-full object-contain blur-[4px]"
              loading="eager"
              decoding="async"
              fetchPriority="high"
            />
          </div>
        </div>

        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center px-7 py-10 sm:px-9 lg:px-11">
          <AuthGlassChatVisual />
        </div>
      </div>
    </aside>
  );
}
