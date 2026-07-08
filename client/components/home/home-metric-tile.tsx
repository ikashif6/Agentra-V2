import { cn } from "@/lib/utils";
import { APP_CARD, APP_SECTION_LABEL } from "@/lib/app-surfaces";

type HomeMetricTileProps = {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  className?: string;
  monochrome?: boolean;
};

export function HomeMetricTile({ label, value, icon, className, monochrome = false }: HomeMetricTileProps) {
  return (
    <div
      className={cn(
        APP_CARD,
        "flex items-center justify-between gap-4 p-4 sm:p-5",
        monochrome && "border-neutral-200 shadow-[0_1px_2px_rgba(0,0,0,0.05)]",
        className,
      )}
    >
      <div className="min-w-0">
        <p className={APP_SECTION_LABEL}>{label}</p>
        <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
          {value}
        </p>
      </div>
      <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-border/70 text-foreground">
        {icon}
      </div>
    </div>
  );
}
