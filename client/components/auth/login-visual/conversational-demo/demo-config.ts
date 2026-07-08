/** Agentra login panel — copy, scenarios, and animation timing. */

export const EASE = [0.22, 1, 0.36, 1] as const;

export const PANEL_COPY = {
  eyebrow: "Agentra workspace",
  headline: "Every ticket. Every team.",
  headlineAccent: "One place.",
  subline: "Support queues, routing rules, and teammates, unified for your workspace.",
} as const;

export type DemoPhase =
  | "enter"
  | "ticket-arrives"
  | "routing"
  | "assigned"
  | "agent-typing"
  | "resolved"
  | "hold"
  | "fade-out";

export const DEMO_PHASE_MS: Record<DemoPhase, number> = {
  enter: 800,
  "ticket-arrives": 2000,
  routing: 2800,
  assigned: 1200,
  "agent-typing": 3200,
  resolved: 2200,
  hold: 1600,
  "fade-out": 600,
};

export const DEMO_PHASES: DemoPhase[] = [
  "enter",
  "ticket-arrives",
  "routing",
  "assigned",
  "agent-typing",
  "resolved",
  "hold",
  "fade-out",
];

export const FLOW_STEPS = [
  { id: "ticket", label: "Ticket arrives" },
  { id: "route", label: "Auto-routed" },
  { id: "reply", label: "Team replies" },
] as const;

export function flowStepIndex(phase: DemoPhase): number {
  if (phase === "enter" || phase === "fade-out") return -1;
  if (phase === "ticket-arrives") return 0;
  if (phase === "routing" || phase === "assigned") return 1;
  if (phase === "agent-typing" || phase === "resolved" || phase === "hold") return 2;
  return -1;
}

export const WORKSPACE_PREVIEW = {
  domain: "brightpath.agentraa.com",
  agentsOnline: 4,
  channels: ["Email", "Chat", "Help center"] as const,
} as const;

export const TEAM_MEMBERS = [
  { initials: "EM", name: "Emma", role: "Support lead", tickets: 3, online: true },
  { initials: "DC", name: "Daniel", role: "Billing", tickets: 2, online: true },
  { initials: "LW", name: "Lena", role: "Success", tickets: 1, online: false },
] as const;

export type DemoScenario = {
  id: string;
  metrics: { open: number; waiting: number; resolved: number };
  routing: {
    label: string;
    rule: string;
    toast: string;
  };
  ticket: {
    number: string;
    subject: string;
    department: string;
    channel: string;
    customer: { name: string; initials: string; message: string };
    agent: { name: string; initials: string; message: string };
  };
};

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: "delivery-urgent",
    metrics: { open: 23, waiting: 8, resolved: 148 },
    routing: {
      label: "Priority routing",
      rule: "High priority + Support dept → assign to Emma",
      toast: "Routed to Emma · Support queue",
    },
    ticket: {
      number: "#2847",
      subject: "Package marked delivered, not received",
      department: "Support",
      channel: "Email",
      customer: {
        name: "James Chen",
        initials: "JC",
        message: "Tracking says delivered but nothing arrived. Can someone help?",
      },
      agent: {
        name: "Emma",
        initials: "EM",
        message:
          "I'm on it. Carrier trace started for order #4821. I'll update you within the hour.",
      },
    },
  },
  {
    id: "billing-help",
    metrics: { open: 19, waiting: 5, resolved: 152 },
    routing: {
      label: "Help center routing",
      rule: "Billing topic + Help center → send to Finance",
      toast: "Routed to Daniel · Finance queue",
    },
    ticket: {
      number: "#2852",
      subject: "Charged twice on my subscription",
      department: "Billing",
      channel: "Help center",
      customer: {
        name: "Priya Sharma",
        initials: "PS",
        message: "I see two charges this month. Can you review my invoice?",
      },
      agent: {
        name: "Daniel",
        initials: "DC",
        message:
          "Found the duplicate. Refund started. You'll see it back in 3-5 business days.",
      },
    },
  },
];

export const DEMO_SCENARIOS_COUNT = DEMO_SCENARIOS.length;

export function cardGlow(phase: DemoPhase, target: "inbox" | "team" | "metrics" | "routing"): boolean {
  switch (target) {
    case "inbox":
      return ["ticket-arrives", "agent-typing", "resolved", "hold"].includes(phase);
    case "routing":
      return ["routing", "assigned"].includes(phase);
    case "team":
      return ["assigned", "agent-typing", "resolved"].includes(phase);
    case "metrics":
      return phase === "resolved" || phase === "hold";
    default:
      return false;
  }
}
