import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type SettingsPanelShellProps = {
  // Kept for API compatibility — the page header (in settings-content) already
  // shows the title/description, so the shell no longer renders its own header
  // or bordered card to avoid duplication.
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  flush?: boolean;
};

export default function SettingsPanelShell({
  children,
  className,
}: SettingsPanelShellProps) {
  return <div className={cn(className)}>{children}</div>;
}
