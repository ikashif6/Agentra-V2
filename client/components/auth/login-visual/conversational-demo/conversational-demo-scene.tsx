"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import {
  DEMO_PHASE_MS,
  DEMO_PHASES,
  DEMO_SCENARIOS,
  DEMO_SCENARIOS_COUNT,
  type DemoPhase,
} from "./demo-config";
import { FlowIndicator } from "./flow-indicator";
import { InboxPanel } from "./inbox-panel";
import { PanelHeadline } from "./panel-headline";
import { MetricsPanel, RoutingPanel, TeamPanel } from "./support-panels";

const STATIC_PHASE: DemoPhase = "resolved";
const AGENT_CHARS_PER_TICK = 2;
const AGENT_TICK_MS = 28;

function wait(ms: number, signal: { cancelled: boolean; hidden: boolean }) {
  return new Promise<void>((resolve) => {
    const tick = () => {
      if (signal.cancelled) {
        resolve();
        return;
      }
      if (signal.hidden) {
        window.setTimeout(tick, 200);
        return;
      }
      resolve();
    };
    window.setTimeout(tick, ms);
  });
}

export function ConversationalDemoScene() {
  const reduceMotion = useReducedMotion();
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [phase, setPhase] = useState<DemoPhase>(reduceMotion ? STATIC_PHASE : "enter");
  const [entered, setEntered] = useState(!!reduceMotion);
  const [agentText, setAgentText] = useState(
    reduceMotion ? DEMO_SCENARIOS[0].ticket.agent.message : "",
  );
  const [showTyping, setShowTyping] = useState(false);
  const typingRef = useRef<number | null>(null);

  const scenario = DEMO_SCENARIOS[scenarioIndex] ?? DEMO_SCENARIOS[0];

  useEffect(() => {
    if (reduceMotion) return;

    const signal = { cancelled: false, hidden: document.hidden };
    const onVisibility = () => {
      signal.hidden = document.hidden;
    };
    document.addEventListener("visibilitychange", onVisibility);

    window.setTimeout(() => {
      if (!signal.cancelled) setEntered(true);
    }, 60);

    async function runLoop() {
      let index = 0;

      while (!signal.cancelled) {
        setScenarioIndex(index);
        const current = DEMO_SCENARIOS[index];

        for (const step of DEMO_PHASES) {
          if (signal.cancelled) break;
          setPhase(step);

          if (step === "agent-typing") {
            setShowTyping(true);
            setAgentText("");
            const full = current.ticket.agent.message;
            let charIndex = 0;

            await new Promise<void>((resolve) => {
              typingRef.current = window.setInterval(() => {
                if (signal.cancelled) {
                  if (typingRef.current) clearInterval(typingRef.current);
                  resolve();
                  return;
                }
                charIndex = Math.min(full.length, charIndex + AGENT_CHARS_PER_TICK);
                setAgentText(full.slice(0, charIndex));
                if (charIndex >= full.length) {
                  if (typingRef.current) clearInterval(typingRef.current);
                  setShowTyping(false);
                  resolve();
                }
              }, AGENT_TICK_MS);
            });

            await wait(350, signal);
            continue;
          }

          if (step === "fade-out") {
            setAgentText("");
            setShowTyping(false);
          }

          await wait(DEMO_PHASE_MS[step], signal);
        }

        setEntered(false);
        setPhase("enter");
        setAgentText("");
        setShowTyping(false);
        await wait(450, signal);

        index = (index + 1) % DEMO_SCENARIOS_COUNT;
        if (!signal.cancelled) setEntered(true);
      }
    }

    runLoop();

    return () => {
      signal.cancelled = true;
      if (typingRef.current) clearInterval(typingRef.current);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [reduceMotion]);

  return (
    <div className="flex w-full max-w-[min(100%,600px)] flex-col gap-4" aria-hidden="true">
      <PanelHeadline entered={entered && phase !== "fade-out"} />

      <div className="login-visual-bento-grid grid grid-cols-12 gap-2.5">
        <InboxPanel
          scenario={scenario}
          phase={phase}
          entered={entered && phase !== "fade-out"}
          agentText={agentText}
          showTyping={showTyping}
        />
        <TeamPanel
          scenario={scenario}
          phase={phase}
          entered={entered && phase !== "fade-out"}
        />
        <MetricsPanel
          scenario={scenario}
          phase={phase}
          entered={entered && phase !== "fade-out"}
        />
        <RoutingPanel
          scenario={scenario}
          phase={phase}
          entered={entered && phase !== "fade-out"}
        />
      </div>

      <FlowIndicator
        phase={phase}
        entered={entered}
        toast={["routing", "assigned", "agent-typing", "resolved"].includes(phase) ? scenario.routing.toast : undefined}
      />
    </div>
  );
}
