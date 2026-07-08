/** Agentra warm palette — status badges and metric tiles. */

export const WORKSPACE_WHITE_CARD =
  "rounded-2xl border border-black/[0.06] bg-white shadow-[0_16px_40px_-18px_rgba(0,0,0,0.22),0_8px_20px_-12px_rgba(216,90,48,0.12)]";

export const WORKSPACE_INNER_TILE =
  "rounded-[14px] border border-black/[0.06] bg-[#fafafa]";

export const WORKSPACE_TICKET_ROW =
  "rounded-[14px] border border-black/[0.06] bg-[#fafafa]";

export const WORKSPACE_TICKET_ROW_ACTIVE =
  "rounded-[14px] border border-[#D85A30]/25 bg-[#FFF5F0] shadow-[inset_0_0_0_1px_rgba(216,90,48,0.12)]";

export const WORKSPACE_SECTION_LABEL =
  "text-[9px] font-semibold uppercase tracking-wider text-[#8a7a72]";

export const WORKSPACE_ICON_WRAP =
  "flex size-6 shrink-0 items-center justify-center rounded-lg bg-[#D85A30]/10 text-[#D85A30]";

/** Metric tile accents — warm stone + brand orange, no generic blue/grey blocks */
export const METRIC_TILE_STYLES = {
  open: "border-[#E8C4B4] bg-[#FFF0E8] text-[#8B3D22]",
  waiting: "border-[#E5D9CF] bg-[#F9F4F0] text-[#6B5348]",
  resolved: "border-[#D5E0D0] bg-[#F2F7EF] text-[#3D5238]",
} as const;

export type MetricTileKey = keyof typeof METRIC_TILE_STYLES;
