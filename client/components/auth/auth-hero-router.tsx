"use client";

import Image from "next/image";
import { LoginVisualBackground } from "@/components/auth/login-visual/login-visual-background";

/**
 * Static product visual for all full-bleed auth screens.
 * Panel wash = original auth background (mesh, grid, logo watermark).
 * Overlay = transparent dashboard PNG (no baked background).
 */
export function AuthHeroRouter() {
  return (
    <aside
      className="login-visual-panel login-visual-panel--static relative hidden h-full min-h-0 overflow-hidden lg:block"
      aria-label="Product preview"
    >
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <LoginVisualBackground />
      </div>

      <div className="relative z-10 flex h-full min-h-0 items-center justify-center px-3 py-4 sm:px-4 lg:px-5 lg:py-5">
        <div className="relative h-[min(100%,920px)] w-full max-w-[760px]">
          <Image
            src="/auth/hero-ui.png"
            alt="Agentra inbox and support overview"
            fill
            priority
            quality={95}
            sizes="(min-width: 1024px) 48vw, 0px"
            className="object-contain object-center drop-shadow-[0_28px_60px_rgba(40,12,4,0.35)]"
          />
        </div>
      </div>
    </aside>
  );
}
