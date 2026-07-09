"use client";

import { BarChart3, Eye, Gift } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StoreOrderConversion, StoreOrderConversionHighlight } from "@/lib/types";

type ConversionSummaryCardProps = {
  conversion: StoreOrderConversion;
  onViewDetails: () => void;
  compact?: boolean;
};

function HighlightIcon({
  icon,
  compact = false,
}: {
  icon: StoreOrderConversionHighlight["icon"];
  compact?: boolean;
}) {
  const className = cn(
    "shrink-0 text-muted-foreground",
    compact ? "size-3.5" : "size-4",
  );
  if (icon === "order") return <Gift className={className} />;
  if (icon === "session") return <Eye className={className} />;
  return <BarChart3 className={className} />;
}

export function ConversionSummaryCard({
  conversion,
  onViewDetails,
  compact = false,
}: ConversionSummaryCardProps) {
  if (!conversion.highlights.length) return null;

  return (
    <section
      className={cn(
        "rounded-lg border border-border/60",
        compact ? "mt-3 p-2.5" : "p-4",
      )}
    >
      <h3
        className={cn(
          "font-semibold text-foreground",
          compact ? "mb-2 text-xs" : "mb-3 text-sm",
        )}
      >
        Conversion summary
      </h3>
      <ul className={cn("space-y-2", compact ? "space-y-1.5" : "space-y-2.5")}>
        {conversion.highlights.map((item) => (
          <li
            key={item.id}
            className={cn(
              "flex items-start gap-2 text-foreground",
              compact ? "gap-2 text-xs leading-snug" : "gap-2.5 text-sm",
            )}
          >
            <HighlightIcon icon={item.icon} compact={compact} />
            <span>{item.text}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onViewDetails}
        className={cn(
          "font-medium text-primary hover:underline",
          compact ? "mt-2 text-xs" : "mt-3 text-sm",
        )}
      >
        View conversion details
      </button>
    </section>
  );
}
