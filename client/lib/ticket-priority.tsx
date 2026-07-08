import type { LucideIcon } from "lucide-react";
import { ChevronDown, ChevronsUp, ChevronUp, Equal } from "lucide-react";
import type { TicketPriority } from "@/lib/types";
import { PRIORITY_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export type PriorityOption = {
  value: TicketPriority;
  label: string;
  icon: LucideIcon;
  iconClassName: string;
};

export const TICKET_PRIORITY_OPTIONS: PriorityOption[] = [
  { value: "low", label: PRIORITY_LABELS.low, icon: ChevronDown, iconClassName: "text-muted-foreground" },
  { value: "medium", label: PRIORITY_LABELS.medium, icon: Equal, iconClassName: "text-muted-foreground" },
  { value: "high", label: PRIORITY_LABELS.high, icon: ChevronUp, iconClassName: "text-primary" },
  { value: "urgent", label: PRIORITY_LABELS.urgent, icon: ChevronsUp, iconClassName: "text-destructive" },
];

export function PriorityIcon({
  priority,
  className,
}: {
  priority: TicketPriority;
  className?: string;
}) {
  const option = TICKET_PRIORITY_OPTIONS.find((item) => item.value === priority) ?? TICKET_PRIORITY_OPTIONS[1];
  const Icon = option.icon;
  return <Icon className={cn("size-4 shrink-0", option.iconClassName, className)} />;
}
