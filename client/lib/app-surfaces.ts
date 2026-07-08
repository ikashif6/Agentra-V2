/** Shared app shell surfaces — aligned with auth/onboarding polish. */

export const APP_CARD =
  "rounded-[10px] border border-border/80 bg-card text-card-foreground shadow-sm";

export const APP_PANEL =
  "rounded-[10px] border border-border/80 bg-card text-card-foreground shadow-sm overflow-hidden";

export const APP_INNER_TILE =
  "rounded-[10px] border border-border/60 bg-muted/40";

export const APP_LIST_ROW =
  "flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-accent/40";

export const APP_SECTION_LABEL =
  "text-[10px] font-semibold uppercase tracking-wider text-muted-foreground";

export const APP_TOOLBAR_INPUT =
  "focus-visible:ring-primary/30 focus-visible:border-primary/40";

export const METRIC_TILE_STYLES = {
  total: "border-[#E5D9CF] bg-[#FAF7F5] text-[#6B5348]",
  open: "border-[#E8C4B4] bg-[#FFF0E8] text-[#8B3D22]",
  progress: "border-[#E5DDD0] bg-[#FBF8F4] text-[#7A5C42]",
  resolved: "border-[#D5E0D0] bg-[#F2F7EF] text-[#3D5238]",
} as const;

export type MetricTileKey = keyof typeof METRIC_TILE_STYLES;
