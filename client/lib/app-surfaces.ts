/** Shared app surfaces — Lovable-like neutrals, theme-aware elevation */
export const APP_CARD =
  "rounded-xl border border-border/70 bg-card text-card-foreground shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-white/[0.06] dark:shadow-[0_1px_2px_rgba(0,0,0,0.35)]";

export const APP_PANEL =
  "overflow-hidden rounded-xl border border-border/70 bg-card text-card-foreground shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-white/[0.06] dark:shadow-[0_1px_2px_rgba(0,0,0,0.35)]";

export const APP_INNER_TILE =
  "rounded-xl border border-border/60 bg-muted/50 dark:border-white/[0.05] dark:bg-white/[0.03]";

export const APP_LIST_ROW =
  "flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-muted/60 dark:hover:bg-white/[0.04]";

export const APP_SECTION_LABEL =
  "text-[11px] font-medium tracking-[-0.01em] text-muted-foreground";

export const APP_TOOLBAR_INPUT =
  "focus-visible:ring-primary/30 focus-visible:border-primary/40";

export const METRIC_TILE_STYLES = {
  total: "border-border/70 bg-muted/40 text-foreground dark:border-white/[0.06] dark:bg-white/[0.03]",
  open: "border-border/70 bg-muted/40 text-foreground dark:border-white/[0.06] dark:bg-white/[0.03]",
  progress: "border-border/70 bg-muted/40 text-foreground dark:border-white/[0.06] dark:bg-white/[0.03]",
  resolved: "border-border/70 bg-muted/40 text-foreground dark:border-white/[0.06] dark:bg-white/[0.03]",
} as const;

export type MetricTileKey = keyof typeof METRIC_TILE_STYLES;
