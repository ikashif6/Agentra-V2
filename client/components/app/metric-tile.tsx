import { cn } from "@/lib/utils";
import { APP_CARD, APP_SECTION_LABEL, METRIC_TILE_STYLES, type MetricTileKey } from "@/lib/app-surfaces";

type MetricTileProps = {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  tone?: MetricTileKey;
  className?: string;
};

export function MetricTile({ label, value, icon, tone = "open", className }: MetricTileProps) {
  const toneStyle = METRIC_TILE_STYLES[tone];

  return (
    <div className={cn(APP_CARD, "p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={APP_SECTION_LABEL}>{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
        </div>
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-[10px] border",
            toneStyle,
          )}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}
