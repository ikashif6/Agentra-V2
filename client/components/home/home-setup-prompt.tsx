"use client";

import Link from "next/link";
import { APP_CARD } from "@/lib/app-surfaces";
import { authRadiusClass } from "@/components/auth/auth-panel-background";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type HomeSetupPromptProps = {
  onDefer: () => void;
  monochrome?: boolean;
};

export function HomeSetupPrompt({ onDefer, monochrome = false }: HomeSetupPromptProps) {
  return (
    <section className={cn(APP_CARD, "flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6", monochrome && "border-neutral-200 shadow-[0_1px_2px_rgba(0,0,0,0.05)]")}>
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">Finish setting up your workspace?</h2>
        <p className="max-w-xl text-sm text-muted-foreground">
          Connect your channels, publish your help center, and invite your team when you&apos;re ready.
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button
          asChild
          className={cn(
            "font-semibold",
            authRadiusClass,
            monochrome && "bg-neutral-900 text-white hover:bg-neutral-800",
          )}
        >
          <Link href="/onboarding">Continue setup</Link>
        </Button>
        <Button type="button" variant="outline" className={cn(authRadiusClass, monochrome && "border-neutral-300 text-neutral-900 hover:bg-neutral-100")} onClick={onDefer}>
          Not right now
        </Button>
      </div>
    </section>
  );
}
