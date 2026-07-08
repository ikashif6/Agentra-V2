"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { cardGlow, EASE, type DemoPhase, type DemoScenario } from "./demo-config";

type InboxPanelProps = {
  scenario: DemoScenario;
  phase: DemoPhase;
  entered: boolean;
  agentText: string;
  showTyping: boolean;
};

export function InboxPanel({
  scenario,
  phase,
  entered,
  agentText,
  showTyping,
}: InboxPanelProps) {
  const { ticket } = scenario;
  const glow = cardGlow(phase, "inbox");
  const showCustomer = phase !== "enter" && phase !== "fade-out";
  const showAgent = ["assigned", "agent-typing", "resolved", "hold"].includes(phase);
  const isResolved = phase === "resolved" || phase === "hold";

  return (
    <DemoCard
      glow={glow}
      entered={entered}
      delay={0.08}
      className="col-span-12 min-h-[200px] sm:col-span-7"
    >
      <CardHeader
        icon={<Inbox className="size-3.5 text-[#D85A30]" />}
        title="Live inbox"
        badge={isResolved ? "Resolved" : "Open"}
        badgeVariant={isResolved ? "success" : "open"}
      />

      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span className="text-[12px] font-semibold text-[#1a1a1a]">Ticket {ticket.number}</span>
        <span className="rounded-md bg-black/[0.05] px-1.5 py-0.5 text-[9px] font-medium text-[#666]">
          {ticket.department}
        </span>
        <span className="rounded-md bg-[#D85A30]/8 px-1.5 py-0.5 text-[9px] font-medium text-[#9a3d1f]">
          {ticket.channel}
        </span>
      </div>
      <p className="mb-3 truncate text-[11px] text-[#888]">{ticket.subject}</p>

      <div className="space-y-2.5">
        {showCustomer ? (
          <Message
            initials={ticket.customer.initials}
            name={ticket.customer.name}
            text={ticket.customer.message}
            variant="customer"
          />
        ) : (
          <Placeholder text="Waiting for the next customer message…" />
        )}

        {showAgent ? (
          <Message
            initials={ticket.agent.initials}
            name={ticket.agent.name}
            text={showTyping && !agentText ? "" : agentText}
            variant="agent"
            typing={showTyping && !agentText}
            showCursor={showTyping && !!agentText}
          />
        ) : null}
      </div>
    </DemoCard>
  );
}

function Message({
  initials,
  name,
  text,
  variant,
  typing,
  showCursor,
}: {
  initials: string;
  name: string;
  text: string;
  variant: "customer" | "agent";
  typing?: boolean;
  showCursor?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-2 rounded-xl border border-black/[0.05] bg-[#fafafa] p-2"
    >
      <div
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white",
          variant === "customer"
            ? "bg-gradient-to-br from-slate-400 to-slate-600"
            : "bg-gradient-to-br from-[#f0997b] to-[#d85a30]",
        )}
      >
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium text-[#888]">{name}</p>
        {typing ? (
          <TypingDots />
        ) : (
          <p className="text-[11px] leading-relaxed text-[#333]">
            {text}
            {showCursor ? (
              <span className="login-visual-cursor ml-0.5 inline-block h-3 w-[2px] translate-y-[1px] bg-[#D85A30]" />
            ) : null}
          </p>
        )}
      </div>
    </motion.div>
  );
}

function Placeholder({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-black/[0.08] bg-white px-2 py-6 text-center text-[10px] text-[#bbb]">
      {text}
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="size-1.5 rounded-full bg-[#D85A30]/45"
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
          transition={{ duration: 0.85, repeat: Infinity, delay: i * 0.12 }}
        />
      ))}
    </div>
  );
}

export function DemoCard({
  children,
  glow,
  entered,
  delay = 0,
  className,
}: {
  children: ReactNode;
  glow?: boolean;
  entered: boolean;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={cn("login-visual-demo-card", className)}
      initial={{ opacity: 0, y: 18, scale: 0.97 }}
      animate={
        entered
          ? { opacity: 1, y: 0, scale: 1 }
          : { opacity: 0, y: 18, scale: 0.97 }
      }
      transition={{ duration: 0.65, ease: EASE, delay }}
    >
      <div
        className={cn(
          "h-full rounded-2xl border bg-white p-3 shadow-[0_16px_40px_-18px_rgba(0,0,0,0.35)] transition-shadow duration-500",
          glow
            ? "border-[#D85A30]/30 shadow-[0_20px_48px_-16px_rgba(216,90,48,0.35)] ring-2 ring-[#D85A30]/15"
            : "border-black/[0.06]",
        )}
      >
        {children}
      </div>
    </motion.div>
  );
}

export function CardHeader({
  icon,
  title,
  badge,
  badgeVariant = "neutral",
}: {
  icon: React.ReactNode;
  title: string;
  badge?: string;
  badgeVariant?: "open" | "success" | "neutral";
}) {
  const badgeClass =
    badgeVariant === "success"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200/80"
      : badgeVariant === "open"
        ? "bg-blue-50 text-blue-700 border-blue-200/80"
        : "bg-black/[0.04] text-[#666] border-black/[0.06]";

  return (
    <div className="mb-2.5 flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-[12px] font-semibold text-[#1a1a1a]">{title}</span>
      </div>
      {badge ? (
        <span className={cn("rounded-full border px-2 py-0.5 text-[8px] font-semibold uppercase", badgeClass)}>
          {badge}
        </span>
      ) : null}
    </div>
  );
}
