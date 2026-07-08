"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { EASE, FLOW_STEPS, flowStepIndex, type DemoPhase } from "./demo-config";

type FlowIndicatorProps = {
  phase: DemoPhase;
  entered: boolean;
  toast?: string;
};

export function FlowIndicator({ phase, entered, toast }: FlowIndicatorProps) {
  const activeStep = flowStepIndex(phase);
  const showToast = toast && activeStep >= 1 && phase !== "fade-out";

  return (
    <motion.div
      className="space-y-2.5 px-1"
      initial={{ opacity: 0, y: 10 }}
      animate={entered && phase !== "fade-out" ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
      transition={{ duration: 0.5, ease: EASE, delay: 0.15 }}
    >
      <div className="flex items-center gap-1">
        {FLOW_STEPS.map((step, index) => {
          const done = activeStep > index;
          const active = activeStep === index;
          return (
            <div key={step.id} className="flex min-w-0 flex-1 items-center gap-1">
              <div
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-1.5 rounded-full border px-2 py-1.5 transition-colors",
                  active
                    ? "border-white/35 bg-white/18"
                    : done
                      ? "border-white/15 bg-white/8"
                      : "border-white/8 bg-black/10",
                )}
              >
                <span
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold",
                    active
                      ? "bg-white text-[#D85A30]"
                      : done
                        ? "bg-emerald-400/90 text-white"
                        : "bg-white/15 text-white/50",
                  )}
                >
                  {done ? "✓" : index + 1}
                </span>
                <span
                  className={cn(
                    "truncate text-[10px] font-medium",
                    active ? "text-white" : done ? "text-white/75" : "text-white/45",
                  )}
                >
                  {step.label}
                </span>
              </div>
              {index < FLOW_STEPS.length - 1 ? (
                <div
                  className={cn(
                    "h-px w-2 shrink-0",
                    done ? "bg-white/35" : "bg-white/12",
                  )}
                  aria-hidden="true"
                />
              ) : null}
            </div>
          );
        })}
      </div>

      {showToast ? (
        <motion.p
          key={toast}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center text-[10px] font-medium text-white/70"
        >
          {toast}
        </motion.p>
      ) : null}
    </motion.div>
  );
}
