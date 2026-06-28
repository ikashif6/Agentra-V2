"use client";

import { motion } from "framer-motion";
import { Check, Sparkles, Truck, User } from "lucide-react";
import { PRODUCT_TOUR_COPY, PRODUCT_TOUR_EASE, PRODUCT_TOUR_SPRING } from "./product-tour-config";
import { cn } from "@/lib/utils";

const surface =
  "rounded-2xl border border-white/10 bg-[rgba(22,12,8,0.55)] shadow-[0_20px_60px_-24px_rgba(0,0,0,0.65)] backdrop-blur-xl";

type CardMotion = {
  show: boolean;
  delay?: number;
  className?: string;
  children: React.ReactNode;
  depth?: number;
};

function ProductCard({ show, delay = 0, className, children, depth = 1 }: CardMotion) {
  return (
    <motion.div
      className={cn(surface, "text-white", className)}
      initial={false}
      animate={
        show
          ? { opacity: 1, x: 0, y: 0, scale: 1, filter: "blur(0px)" }
          : { opacity: 0, x: depth > 1 ? 14 : 22, y: depth > 1 ? 0 : 0, scale: 0.97, filter: "blur(6px)" }
      }
      transition={{ ...PRODUCT_TOUR_SPRING.card, delay }}
      style={{
        boxShadow: `0 ${8 + depth * 4}px ${28 + depth * 8}px -${12 + depth * 2}px rgba(0,0,0,${0.45 + depth * 0.05})`,
      }}
    >
      {children}
    </motion.div>
  );
}

export function IncomingMessageCard({ show }: { show: boolean }) {
  return (
    <motion.div
      className={cn(surface, "absolute right-0 top-2 z-30 w-[min(92%,240px)] p-3.5 text-white")}
      initial={false}
      animate={
        show
          ? { opacity: 1, x: 0, y: 0, scale: 1, filter: "blur(0px)" }
          : { opacity: 0, x: 72, y: 0, scale: 0.98, filter: "blur(8px)" }
      }
      transition={PRODUCT_TOUR_SPRING.card}
      style={{
        boxShadow: "0 24px 60px -24px rgba(0,0,0,0.65)",
        transformPerspective: 900,
      }}
    >
      <div className="mb-2 flex items-center gap-2">
        <div className="size-7 rounded-full bg-white/10" />
        <div>
          <p className="text-[11px] font-medium text-white/90">Customer</p>
          <p className="text-[10px] text-white/45">Just now</p>
        </div>
        <motion.span
          className="ml-auto size-2 rounded-full bg-[#F0997B]"
          animate={show ? { opacity: [0.4, 1, 0.4] } : { opacity: 0 }}
          transition={{ duration: 1.8, repeat: show ? Infinity : 0 }}
          aria-hidden="true"
        />
      </div>
      <p className="text-[12px] leading-relaxed text-white/80">{PRODUCT_TOUR_COPY.message}</p>
    </motion.div>
  );
}

export function TicketCard({
  show,
  scan,
  shine,
  resolved,
  showIntent,
}: {
  show: boolean;
  scan: boolean;
  shine: boolean;
  resolved: boolean;
  showIntent: boolean;
}) {
  return (
    <ProductCard show={show} className="relative z-20 w-full p-4" depth={2}>
      {shine ? (
        <motion.div
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
          aria-hidden="true"
        >
          <motion.div
            className="absolute -left-1/3 top-0 h-full w-1/3 bg-linear-to-r from-transparent via-white/12 to-transparent"
            initial={{ x: "-100%" }}
            animate={{ x: "320%" }}
            transition={{ duration: 1.1, ease: PRODUCT_TOUR_EASE }}
          />
        </motion.div>
      ) : null}

      {resolved ? (
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-2xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          aria-hidden="true"
        >
          <motion.div
            className="absolute inset-0 rounded-2xl ring-1 ring-[#F0997B]/50"
            animate={{ opacity: [0.25, 0.7, 0.35] }}
            transition={{ duration: 1.6, ease: PRODUCT_TOUR_EASE }}
          />
        </motion.div>
      ) : null}

      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-white/45">Ticket</p>
          <p className="text-sm font-medium text-white">Order delivery inquiry</p>
        </div>
        <StatusBadge status={resolved ? "resolved" : "open"} show={show} />
      </div>

      <div className="relative overflow-hidden rounded-xl border border-white/8 bg-black/20 p-3">
        <p className="relative z-10 text-[12px] leading-relaxed text-white/75">{PRODUCT_TOUR_COPY.message}</p>
        <motion.div
          className="pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-linear-to-r from-[#F0997B]/25 to-transparent"
          initial={{ x: "-110%" }}
          animate={scan ? { x: "220%" } : { x: "-110%" }}
          transition={{ duration: 0.75, ease: PRODUCT_TOUR_EASE }}
          aria-hidden="true"
        />
      </div>

      <motion.div
        className="mt-3 flex items-center gap-2"
        initial={false}
        animate={show ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
        transition={{ delay: 0.15, duration: 0.45, ease: PRODUCT_TOUR_EASE }}
      >
        <IntentBadge show={showIntent} />
        <motion.span
          className="text-[10px] text-white/45"
          animate={show ? { opacity: 1 } : { opacity: 0 }}
        >
          96% confidence
        </motion.span>
      </motion.div>
    </ProductCard>
  );
}

export function IntentBadge({ show }: { show: boolean }) {
  return (
    <motion.span
      className="inline-flex items-center gap-1 rounded-full border border-[#F0997B]/30 bg-[#D85A30]/20 px-2 py-0.5 text-[10px] font-medium text-[#FFD8C8]"
      initial={false}
      animate={show ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.92 }}
      transition={{ ...PRODUCT_TOUR_SPRING.soft, delay: 0.05 }}
    >
      <Sparkles className="size-3" aria-hidden="true" />
      {PRODUCT_TOUR_COPY.intent}
    </motion.span>
  );
}

export function StatusBadge({
  status,
  show,
}: {
  status: "open" | "resolved";
  show: boolean;
}) {
  const resolved = status === "resolved";
  return (
    <motion.span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium",
        resolved
          ? "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/25"
          : "bg-white/8 text-white/70 ring-1 ring-white/10",
      )}
      initial={false}
      animate={show ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.45, ease: PRODUCT_TOUR_EASE }}
    >
      {resolved ? <Check className="size-3" aria-hidden="true" /> : null}
      {resolved ? "Resolved" : "Open"}
    </motion.span>
  );
}

export function CustomerContextCard({ show }: { show: boolean }) {
  return (
    <ProductCard
      show={show}
      className="absolute -left-2 top-[38%] z-10 w-[170px] p-3"
      depth={1}
      delay={0.08}
    >
      <div className="flex items-center gap-2">
        <div className="flex size-8 items-center justify-center rounded-full bg-white/10">
          <User className="size-4 text-[#F0997B]" aria-hidden="true" />
        </div>
        <div>
          <p className="text-[10px] text-white/45">Customer</p>
          <p className="text-[12px] font-medium text-white">{PRODUCT_TOUR_COPY.customer}</p>
        </div>
      </div>
    </ProductCard>
  );
}

export function OrderContextCard({ show }: { show: boolean }) {
  return (
    <ProductCard
      show={show}
      className="absolute -right-1 top-[48%] z-10 w-[165px] p-3"
      depth={1}
      delay={0.16}
    >
      <div className="flex items-start gap-2">
        <div className="flex size-8 items-center justify-center rounded-full bg-white/10">
          <Truck className="size-4 text-[#F0997B]" aria-hidden="true" />
        </div>
        <div>
          <p className="text-[10px] text-white/45">Order {PRODUCT_TOUR_COPY.orderId}</p>
          <p className="text-[12px] font-medium text-white">{PRODUCT_TOUR_COPY.orderStatus}</p>
          <p className="text-[10px] text-white/50">{PRODUCT_TOUR_COPY.orderEta}</p>
        </div>
      </div>
    </ProductCard>
  );
}

const replyPhrases = [
  "Hi Sarah, I've checked order #AG-2841.",
  "It is currently in transit",
  "and expected to arrive tomorrow.",
];

export function AIReplyComposer({
  show,
  highlightSend,
}: {
  show: boolean;
  highlightSend: boolean;
}) {
  return (
    <ProductCard show={show} className="relative z-20 mt-3 w-full p-3.5" depth={2} delay={0.05}>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wider text-white/45">Suggested reply</p>
        <Sparkles className="size-3.5 text-[#F0997B]" aria-hidden="true" />
      </div>
      <div className="space-y-1.5 overflow-hidden">
        {replyPhrases.map((line, index) => (
          <motion.p
            key={line}
            className="text-[11px] leading-relaxed text-white/78"
            initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
            animate={
              show
                ? { opacity: 1, y: 0, filter: "blur(0px)" }
                : { opacity: 0, y: 8, filter: "blur(4px)" }
            }
            transition={{ duration: 0.55, ease: PRODUCT_TOUR_EASE, delay: show ? index * 0.22 : 0 }}
          >
            {line}
          </motion.p>
        ))}
      </div>
      <motion.button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        className="mt-3 inline-flex rounded-lg bg-[#D85A30] px-3 py-1.5 text-[11px] font-medium text-white"
        animate={
          highlightSend
            ? { boxShadow: "0 0 0 1px rgba(240,153,123,0.55), 0 8px 24px -8px rgba(216,90,48,0.8)" }
            : { boxShadow: "0 0 0 0 rgba(240,153,123,0)" }
        }
        transition={{ duration: 0.45, ease: PRODUCT_TOUR_EASE }}
      >
        {PRODUCT_TOUR_COPY.sendLabel}
      </motion.button>
    </ProductCard>
  );
}
