"use client";

import { cn } from "@/lib/utils";

type TeamAvatarGroupProps = {
  initials: string;
  name?: string;
  className?: string;
};

export function TeamAvatarGroup({ initials, name, className }: TeamAvatarGroupProps) {
  return (
    <div className={cn("flex items-center gap-1.5", className)} aria-hidden="true">
      <div className="flex size-5 items-center justify-center rounded-full bg-white/12 text-[9px] font-medium text-white/85 ring-1 ring-white/10">
        {initials}
      </div>
      {name ? <span className="text-[9px] text-white/45">{name}</span> : null}
    </div>
  );
}
