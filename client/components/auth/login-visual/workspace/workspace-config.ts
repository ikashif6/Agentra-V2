/** Mock data and timing for the login ambient workspace animation. */

export const EASE = [0.22, 1, 0.36, 1] as const;

export const LOGIN_COPY = {
  eyebrow: "Agentraa",
  heading: "Welcome back.",
  description: "Your workspace is ready when you are.",
  supporting: "Stay close to every conversation.",
} as const;

export type TicketStatus = "open" | "waiting" | "new" | "assigned" | "resolved";

export type Ticket = {
  id: string;
  ticketNum: string;
  subject: string;
  customer: string;
  category: string;
  status: TicketStatus;
  priority?: "high" | "medium" | "low";
  assignee?: string;
  assigneeInitials?: string;
  slaProgress?: number;
  isNew?: boolean;
};

export type WorkspaceMetrics = {
  open: number;
  waiting: number;
  resolved: number;
};

export const INITIAL_METRICS: WorkspaceMetrics = {
  open: 24,
  waiting: 8,
  resolved: 142,
};

export const STATIC_METRICS: WorkspaceMetrics = {
  open: 23,
  waiting: 8,
  resolved: 143,
};

export function cloneTickets(tickets: Ticket[]): Ticket[] {
  return tickets.map((t) => ({ ...t }));
}

export const INITIAL_TICKETS: Ticket[] = [
  {
    id: "t-2841",
    ticketNum: "#2841",
    subject: "Where is my order?",
    customer: "Sarah Miller",
    category: "Delivery",
    status: "open",
    priority: "high",
    slaProgress: 72,
  },
  {
    id: "t-2838",
    ticketNum: "#2838",
    subject: "Need to change delivery address",
    customer: "Daniel Carter",
    category: "Order update",
    status: "assigned",
    assignee: "Emma",
    assigneeInitials: "EM",
    slaProgress: 48,
  },
  {
    id: "t-2835",
    ticketNum: "#2835",
    subject: "Refund status",
    customer: "Olivia Wilson",
    category: "Refund",
    status: "waiting",
    slaProgress: 86,
  },
  {
    id: "t-2832",
    ticketNum: "#2832",
    subject: "Product arrived damaged",
    customer: "James Anderson",
    category: "Replacement",
    status: "new",
    isNew: true,
    slaProgress: 18,
  },
];

export const INCOMING_TICKET: Ticket = {
  id: "t-2844",
  ticketNum: "#2844",
  subject: "Late shipment update",
  customer: "Mia Thompson",
  category: "Delivery",
  status: "new",
  isNew: true,
  priority: "medium",
  slaProgress: 8,
};

export const ACTIVITY_MESSAGES = [
  "Emma assigned ticket #2841",
  "AI draft prepared",
  "Daniel replied",
  "Ticket #2819 resolved",
  "SLA target met",
  "New conversation",
] as const;

export const TEAM_MEMBERS = [
  { initials: "EM", name: "Emma", tickets: 3, online: true },
  { initials: "DC", name: "Daniel", tickets: 2, online: true },
  { initials: "LW", name: "Lena", tickets: 1, online: false },
] as const;

export const WORKSPACE_SNAPSHOT = {
  avgResponse: "4.2m",
  slaMet: "94%",
  channelsActive: 3,
} as const;

export const STATIC_ACTIVITY_HISTORY = [
  "Ticket #2819 resolved",
  "Daniel replied",
  "Emma assigned ticket #2841",
] as const;

/** Ambient cycle step durations in milliseconds (~18s total). */
export const WORKSPACE_LOOP = {
  settle: 2200,
  highlight: 700,
  resolve: 1400,
  removeResolved: 900,
  activityResolved: 2600,
  pause: 1600,
  activityAssign: 2800,
  activityDraft: 2400,
  slaComplete: 2200,
  newTicketNotice: 1200,
  insertTicket: 1800,
  settleAfterNew: 1800,
  activityReply: 2400,
  rowHighlight: 1600,
  activitySla: 2400,
  loopGap: 2000,
} as const;

export const RESOLVE_TARGET_ID = "t-2841";
