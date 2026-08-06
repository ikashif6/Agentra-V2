"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

type StepKind =
  | { type: "user"; text: string; delay: number }
  | { type: "typing"; label?: string; delay: number }
  | { type: "ai"; text: string; delay: number }
  | {
      type: "order";
      orderNumber: string;
      total: string;
      badge: string;
      /** 0 Placed … 3 Delivered — active index (done = before active) */
      stepIndex: number;
      items: string[];
      showTrack: boolean;
      delay: number;
    }
  | { type: "choices"; options: string[]; delay: number };

type FeedItem = StepKind & { id: string; entered: boolean };

const AGENT_TYPES = new Set(["ai", "order", "choices"]);

const ORDER_STEPS = ["Placed", "Packed", "Shipped", "Delivered"] as const;

/** Shopper ↔ Agentra — cards mirror the live chatbot widget. */
const SCRIPT: StepKind[] = [
  { type: "user", text: "Hey — has order 10492 shipped yet?", delay: 1500 },
  { type: "typing", delay: 1000 },
  {
    type: "ai",
    text: "I can check that. What email did you use at checkout?",
    delay: 1600,
  },
  { type: "user", text: "sam.holloway@gmail.com", delay: 1300 },
  { type: "typing", label: "Looking up your order…", delay: 1600 },
  {
    type: "order",
    orderNumber: "10492",
    total: "$128.00",
    badge: "shipped",
    stepIndex: 2,
    items: ["Linen Overshirt × 1", "Canvas Tote × 1"],
    showTrack: true,
    delay: 2200,
  },
  { type: "typing", delay: 700 },
  {
    type: "ai",
    text: "It went out yesterday. Tracking shows delivery Friday by evening.",
    delay: 1800,
  },
  { type: "user", text: "Can I still change the shipping address?", delay: 1500 },
  { type: "typing", delay: 900 },
  {
    type: "ai",
    text: "Not once it’s with the carrier. Want tracking, or should I connect you with a person?",
    delay: 1600,
  },
  {
    type: "choices",
    options: ["Track shipment", "Talk to a person"],
    delay: 2800,
  },
];

const MAX_VISIBLE = 5;

function StatusPill({ label = "Replying…" }: { label?: string }) {
  return (
    <div className="auth-glass-surface inline-flex max-w-full items-center gap-2 rounded-full px-3 py-[7px] text-[12.5px] font-medium">
      <span
        aria-hidden
        className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-[#d85a30]/25 border-t-[#d85a30]"
      />
      <span className="auth-glass-muted whitespace-nowrap leading-tight">{label}</span>
    </div>
  );
}

function OrderCard({
  orderNumber,
  total,
  badge,
  stepIndex,
  items,
  showTrack,
}: Extract<StepKind, { type: "order" }>) {
  return (
    <div className="auth-glass-surface w-full max-w-[300px] rounded-2xl p-3.5">
      <div className="mb-3.5 flex items-start justify-between gap-2.5">
        <div>
          <div className="text-xs font-bold tracking-tight">
            Order #{orderNumber.replace(/^#+/, "")}
          </div>
          <div className="auth-glass-muted mt-0.5 text-xs font-medium">{total}</div>
        </div>
        <span className="auth-glass-muted shrink-0 rounded-md border border-black/[0.08] bg-black/[0.04] px-2 py-1 text-[10px] font-semibold tracking-wide capitalize">
          {badge}
        </span>
      </div>

      <div className="mb-3.5 flex items-start justify-between gap-1 px-0.5">
        {ORDER_STEPS.map((label, i) => {
          const reached = i <= stepIndex;
          return (
            <div
              key={label}
              className="relative flex min-w-0 flex-1 flex-col items-center gap-1.5"
            >
              {i < ORDER_STEPS.length - 1 ? (
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-[7px] left-[calc(50%+10px)] right-[calc(-50%+10px)] h-0.5 rounded-sm",
                    reached ? "bg-emerald-500" : "bg-black/10",
                  )}
                />
              ) : null}
              <span
                className={cn(
                  "relative z-[1] box-border size-3.5 rounded-full border-2",
                  reached
                    ? "border-emerald-500 bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.18)]"
                    : "border-black/15 bg-white/70",
                )}
              />
              <span
                className={cn(
                  "text-center text-[9.5px] font-semibold leading-tight",
                  !reached && "auth-glass-muted",
                )}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mb-2.5 flex flex-col gap-1">
        {items.map((line) => (
          <div key={line} className="auth-glass-muted text-xs font-medium">
            {line}
          </div>
        ))}
      </div>

      {showTrack ? (
        <span className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#2a211c] px-3 py-2.5 text-[12.5px] font-semibold text-white">
          Track shipment
        </span>
      ) : null}
    </div>
  );
}

/**
 * Auth hero chat demo — Agentra AI Agent with chatbot-style cards.
 */
export function AuthGlassChatVisual() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [desktop, setDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!desktop) return;

    let cancelled = false;
    let index = 0;
    let seq = 0;
    let advanceTimer = 0;
    let revealTimer = 0;

    const scheduleAdvance = (fn: () => void, ms: number) => {
      window.clearTimeout(advanceTimer);
      advanceTimer = window.setTimeout(() => {
        if (!cancelled) fn();
      }, ms);
    };

    const reveal = (id: string) => {
      window.clearTimeout(revealTimer);
      revealTimer = window.setTimeout(() => {
        if (cancelled) return;
        setItems((prev) =>
          prev.map((it) => (it.id === id ? { ...it, entered: true } : it)),
        );
      }, 36);
    };

    const clearFeed = (then: () => void) => {
      setItems((prev) => prev.map((it) => ({ ...it, entered: false })));
      scheduleAdvance(() => {
        setItems([]);
        scheduleAdvance(then, 420);
      }, 280);
    };

    const advance = () => {
      if (cancelled) return;
      if (document.visibilityState === "hidden") {
        scheduleAdvance(advance, 800);
        return;
      }

      if (index >= SCRIPT.length) {
        index = 0;
        clearFeed(advance);
        return;
      }

      const stepDef = SCRIPT[index];
      index += 1;

      const id = `m-${seq++}`;
      const step: FeedItem = { ...stepDef, id, entered: false };

      setItems((prev) => {
        const withoutTyping = AGENT_TYPES.has(stepDef.type)
          ? prev.filter((it) => it.type !== "typing")
          : prev;
        const next = [...withoutTyping, step];
        return next.length > MAX_VISIBLE ? next.slice(-MAX_VISIBLE) : next;
      });
      reveal(id);

      scheduleAdvance(advance, stepDef.delay);
    };

    scheduleAdvance(advance, 600);

    return () => {
      cancelled = true;
      window.clearTimeout(advanceTimer);
      window.clearTimeout(revealTimer);
      setItems([]);
    };
  }, [desktop]);

  if (!desktop) return null;

  return (
    <div className="auth-glass-chat" aria-hidden="true">
      <div className="auth-glass-feed">
        {items.map((step) => (
          <div
            key={step.id}
            className={cn(
              "auth-glass-msg",
              step.entered && "is-in",
              step.type === "user" && "is-user",
              step.type === "typing" && "is-typing",
              step.type === "ai" && "is-ai",
              (step.type === "order" || step.type === "choices") && "is-status",
            )}
          >
            {step.type === "user" ? (
              <div className="auth-glass-user">
                <span className="auth-glass-avatar">
                  {/* Portrait: Unsplash License — photo-1548142813-c348350df52b */}
                  <img
                    src="/auth/shopper.jpg?v=2"
                    alt=""
                    width={26}
                    height={26}
                    draggable={false}
                  />
                </span>
                <p>{step.text}</p>
              </div>
            ) : null}

            {step.type === "typing" ? <StatusPill label={step.label} /> : null}

            {step.type === "ai" ? (
              <div className="auth-glass-ai">
                <p>{step.text}</p>
              </div>
            ) : null}

            {step.type === "order" ? <OrderCard {...step} /> : null}

            {step.type === "choices" ? (
              <div className="flex max-w-[300px] flex-col items-end gap-2">
                {step.options.map((option) => (
                  <span
                    key={option}
                    className="auth-glass-surface inline-flex items-center justify-center rounded-full px-3.5 py-2 text-[12.5px] font-semibold tracking-tight"
                  >
                    {option}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="auth-glass-ask">
        <p>Message Riverside</p>
        <span className="auth-glass-ask-send">
          <ArrowUp className="size-4" strokeWidth={2.25} />
        </span>
      </div>
    </div>
  );
}
