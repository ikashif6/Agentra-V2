"use client";

import { motion } from "framer-motion";
import { Globe } from "lucide-react";
import { EASE, PANEL_COPY, WORKSPACE_PREVIEW } from "./demo-config";

type PanelHeadlineProps = {
  entered: boolean;
};

export function PanelHeadline({ entered }: PanelHeadlineProps) {
  return (
    <motion.div
      className="space-y-3 px-1"
      initial={{ opacity: 0, y: 16 }}
      animate={entered ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
      transition={{ duration: 0.7, ease: EASE }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
        {PANEL_COPY.eyebrow}
      </p>
      <h2 className="max-w-[18ch] text-[clamp(1.5rem,3.2vw,1.85rem)] font-semibold leading-[1.15] tracking-tight text-white">
        {PANEL_COPY.headline}
        <br />
        <span className="text-white/92">{PANEL_COPY.headlineAccent}</span>
      </h2>
      <p className="max-w-[34ch] text-[13px] leading-relaxed text-white/62">
        {PANEL_COPY.subline}
      </p>
      <div className="flex flex-wrap items-center gap-2 pt-0.5">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/12 px-2.5 py-1 text-[11px] font-medium text-white/90 backdrop-blur-sm">
          <Globe className="size-3.5 text-[#F0997B]" aria-hidden="true" />
          {WORKSPACE_PREVIEW.domain}
        </span>
        {WORKSPACE_PREVIEW.channels.map((ch) => (
          <span
            key={ch}
            className="rounded-full border border-white/12 bg-black/15 px-2 py-0.5 text-[10px] text-white/55"
          >
            {ch}
          </span>
        ))}
      </div>
    </motion.div>
  );
}
