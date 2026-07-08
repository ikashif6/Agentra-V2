"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import {
  ACTIVITY_MESSAGES,
  cloneTickets,
  INITIAL_METRICS,
  INITIAL_TICKETS,
  INCOMING_TICKET,
  RESOLVE_TARGET_ID,
  STATIC_METRICS,
  STATIC_ACTIVITY_HISTORY,
  WORKSPACE_LOOP,
  type Ticket,
  type WorkspaceMetrics,
} from "./workspace-config";
import { WorkspaceOverview } from "./workspace-overview";

type AmbientState = {
  metrics: WorkspaceMetrics;
  tickets: Ticket[];
  highlightedId: string | null;
  exitingId: string | null;
  slaCompleteId: string | null;
  activity: string | null;
  activityHistory: string[];
  showLivePulse: boolean;
  entered: boolean;
  resolveNextId: string;
};

function buildInitialState(reduceMotion: boolean): AmbientState {
  return {
    metrics: reduceMotion ? STATIC_METRICS : { ...INITIAL_METRICS },
    tickets: cloneTickets(INITIAL_TICKETS),
    highlightedId: null,
    exitingId: null,
    slaCompleteId: null,
    activity: reduceMotion ? ACTIVITY_MESSAGES[3] : null,
    activityHistory: reduceMotion ? [...STATIC_ACTIVITY_HISTORY] : [],
    showLivePulse: !reduceMotion,
    entered: reduceMotion,
    resolveNextId: RESOLVE_TARGET_ID,
  };
}

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

function pushActivity(history: string[], message: string | null): string[] {
  if (!message) return history;
  return [message, ...history.filter((item) => item !== message)].slice(0, 4);
}

function withActivity(
  state: AmbientState,
  activity: string | null,
): Pick<AmbientState, "activity" | "activityHistory"> {
  return {
    activity,
    activityHistory: activity ? pushActivity(state.activityHistory, activity) : state.activityHistory,
  };
}

function updateTicket(
  tickets: Ticket[],
  id: string,
  patch: Partial<Ticket>,
): Ticket[] {
  return tickets.map((t) => (t.id === id ? { ...t, ...patch } : t));
}

export function WorkspaceScene() {
  const reduceMotion = useReducedMotion();
  const [state, setState] = useState<AmbientState>(() => buildInitialState(!!reduceMotion));
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    setState(buildInitialState(!!reduceMotion));
  }, [reduceMotion]);

  useEffect(() => {
    if (reduceMotion) return;

    const signal = { cancelled: false, hidden: document.hidden };
    const addIncomingNext = { current: true };

    const onVisibility = () => {
      signal.hidden = document.hidden;
    };
    document.addEventListener("visibilitychange", onVisibility);

    window.setTimeout(() => {
      if (!signal.cancelled) {
        setState((s) => ({ ...s, entered: true }));
      }
    }, 80);

    async function runAmbientLoop() {
      await wait(WORKSPACE_LOOP.settle, signal);

      while (!signal.cancelled) {
        const current = stateRef.current;
        const resolveId = current.resolveNextId;

        setState((s) => ({
          ...s,
          highlightedId: resolveId,
          ...withActivity(s, null),
          exitingId: null,
          slaCompleteId: null,
        }));
        await wait(WORKSPACE_LOOP.highlight, signal);

        setState((s) => ({
          ...s,
          tickets: updateTicket(s.tickets, resolveId, { status: "resolved" }),
        }));
        await wait(WORKSPACE_LOOP.resolve, signal);

        setState((s) => ({
          ...s,
          exitingId: resolveId,
          metrics: {
            ...s.metrics,
            open: Math.max(0, s.metrics.open - 1),
            resolved: s.metrics.resolved + 1,
          },
        }));
        await wait(WORKSPACE_LOOP.removeResolved, signal);

        setState((s) => ({
          ...s,
          tickets: s.tickets.filter((t) => t.id !== resolveId),
          highlightedId: null,
          exitingId: null,
          ...withActivity(s, ACTIVITY_MESSAGES[3]),
        }));
        await wait(WORKSPACE_LOOP.activityResolved, signal);
        await wait(WORKSPACE_LOOP.pause, signal);

        setState((s) => ({
          ...s,
          ...withActivity(s, ACTIVITY_MESSAGES[0]),
          tickets: updateTicket(s.tickets, "t-2838", {
            assignee: "Emma",
            assigneeInitials: "EM",
            status: "assigned",
          }),
        }));
        await wait(WORKSPACE_LOOP.activityAssign, signal);

        setState((s) => ({ ...s, ...withActivity(s, ACTIVITY_MESSAGES[1]) }));
        await wait(WORKSPACE_LOOP.activityDraft, signal);

        setState((s) => ({
          ...s,
          slaCompleteId: "t-2835",
          ...withActivity(s, ACTIVITY_MESSAGES[4]),
        }));
        await wait(WORKSPACE_LOOP.slaComplete, signal);

        setState((s) => ({
          ...s,
          slaCompleteId: null,
          ...withActivity(s, ACTIVITY_MESSAGES[5]),
        }));
        await wait(WORKSPACE_LOOP.newTicketNotice, signal);

        setState((s) => {
          const trimmed = s.tickets.length >= 4 ? s.tickets.slice(0, 3) : s.tickets;
          const base =
            addIncomingNext.current
              ? {
                  ...s,
                  tickets: [{ ...INCOMING_TICKET }, ...trimmed],
                  metrics: { ...s.metrics, open: s.metrics.open + 1 },
                  resolveNextId: INCOMING_TICKET.id,
                }
              : {
                  ...s,
                  tickets: [
                    ...s.tickets,
                    {
                      ...INITIAL_TICKETS[0],
                      status: "open" as const,
                      isNew: false,
                      priority: "medium" as const,
                    },
                  ],
                  metrics: { ...s.metrics, open: s.metrics.open + 1 },
                  resolveNextId: RESOLVE_TARGET_ID,
                };
          return { ...base, ...withActivity(base, ACTIVITY_MESSAGES[5]) };
        });
        addIncomingNext.current = !addIncomingNext.current;
        await wait(WORKSPACE_LOOP.insertTicket + WORKSPACE_LOOP.settleAfterNew, signal);

        setState((s) => ({
          ...s,
          highlightedId: "t-2832",
          activity: null,
        }));
        await wait(WORKSPACE_LOOP.rowHighlight, signal);

        setState((s) => ({ ...s, highlightedId: null, ...withActivity(s, ACTIVITY_MESSAGES[2]) }));
        await wait(WORKSPACE_LOOP.activityReply, signal);

        setState((s) => ({ ...s, ...withActivity(s, ACTIVITY_MESSAGES[4]) }));
        await wait(WORKSPACE_LOOP.activitySla, signal);

        setState((s) => ({ ...s, activity: null }));
        await wait(WORKSPACE_LOOP.loopGap, signal);

        setState({
          ...buildInitialState(false),
          entered: true,
        });
      }
    }

    runAmbientLoop();

    return () => {
      signal.cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [reduceMotion]);

  return (
    <div className="login-visual-workspace-scale w-full" aria-hidden="true">
      <WorkspaceOverview
        metrics={state.metrics}
        tickets={state.tickets}
        highlightedId={state.highlightedId}
        exitingId={state.exitingId}
        slaCompleteId={state.slaCompleteId}
        activity={state.activity}
        activityHistory={state.activityHistory}
        showLivePulse={state.showLivePulse}
        entered={state.entered}
      />
    </div>
  );
}
