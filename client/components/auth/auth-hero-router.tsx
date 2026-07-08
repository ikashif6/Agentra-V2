"use client";

import { usePathname } from "next/navigation";
import { LoginVisualBackground } from "@/components/auth/login-visual/login-visual-background";
import { ConversationalDemoScene } from "@/components/auth/login-visual/conversational-demo/conversational-demo-scene";
import { WorkspaceScene } from "@/components/auth/login-visual/workspace/workspace-scene";

export function AuthHeroRouter() {
  const pathname = usePathname();
  const isSignup = pathname?.startsWith("/auth/signup");

  return (
    <div className="login-visual-panel relative hidden h-full min-h-0 lg:block">
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <LoginVisualBackground />
      </div>

      <div className="relative z-10 box-border flex h-full min-h-0 items-center justify-center overflow-visible px-6 py-6 lg:px-8 lg:py-7 xl:px-10 xl:py-8">
        <div
          className={
            isSignup
              ? "login-visual-workspace-scroll mx-auto w-full max-w-[min(100%,600px)] overflow-x-hidden"
              : "login-visual-workspace-fit mx-auto w-full max-w-[min(100%,660px)]"
          }
        >
          {isSignup ? <ConversationalDemoScene /> : <WorkspaceScene />}
        </div>
      </div>
    </div>
  );
}
