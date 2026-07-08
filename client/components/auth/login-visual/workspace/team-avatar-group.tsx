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
      <div className="flex size-5 items-center justify-center rounded-full bg-gradient-to-br from-[#f0997b] to-[#d85a30] text-[9px] font-semibold text-white">
        {initials}
      </div>
      {name ? <span className="text-[9px] text-[#888]">{name}</span> : null}
    </div>
  );
}
