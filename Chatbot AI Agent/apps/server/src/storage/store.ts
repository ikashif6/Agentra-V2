import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type {
  ChatMessage,
  ConversationState,
  HandoffState,
} from "@chatbot/shared";
import { env } from "../config/env.js";

export interface ConversationRecord {
  id: string;
  workspaceId: string;
  sessionToken: string;
  channel: string;
  visitorEmail?: string;
  visitorPhone?: string;
  state: ConversationState;
  handoffState: HandoffState;
  humanTakeover: boolean;
  assignedAgentId?: string | null;
  /** When customer entered the human-agent queue */
  handoffRequestedAt?: string | null;
  /** CSAT rating after customer ends the chat */
  rating?: {
    score: number;
    emoji?: string;
    label?: string;
    at: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface TicketRecord {
  id: string;
  workspaceId: string;
  conversationId: string;
  email?: string;
  phone?: string;
  subject: string;
  body: string;
  status: "open" | "pending" | "closed";
  createdAt: string;
}

export type CustomerAlertType = "back_in_stock" | "product_interest";

export interface CustomerAlertRecord {
  id: string;
  workspaceId: string;
  conversationId: string;
  type: CustomerAlertType;
  email: string;
  phone?: string;
  productId: string;
  productTitle?: string;
  variantId?: string;
  size?: string;
  color?: string;
  status: "pending" | "notified" | "cancelled";
  createdAt: string;
  notifiedAt?: string | null;
}

function defaultState(): ConversationState {
  return {
    goal: "general",
    slots: {},
    activeFlow: null,
    flowStep: null,
    handoffState: "not_requested",
    verifiedOrderId: null,
    verifiedOrderSnapshot: null,
    lastTurnOutcome: null,
    humanTakeover: false,
    pendingAction: null,
  };
}

async function ensureDirs() {
  await fs.mkdir(path.join(env.dataDir, "conversations"), { recursive: true });
  await fs.mkdir(path.join(env.dataDir, "tickets"), { recursive: true });
  await fs.mkdir(path.join(env.dataDir, "messages"), { recursive: true });
  await fs.mkdir(path.join(env.dataDir, "alerts"), { recursive: true });
}

function convPath(id: string) {
  return path.join(env.dataDir, "conversations", `${id}.json`);
}

function msgPath(id: string) {
  return path.join(env.dataDir, "messages", `${id}.json`);
}

function ticketPath(id: string) {
  return path.join(env.dataDir, "tickets", `${id}.json`);
}

function alertPath(id: string) {
  return path.join(env.dataDir, "alerts", `${id}.json`);
}

export async function createConversation(input: {
  workspaceId: string;
  sessionToken: string;
  channel?: string;
  visitorEmail?: string;
}): Promise<ConversationRecord> {
  await ensureDirs();
  const now = new Date().toISOString();
  const record: ConversationRecord = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    sessionToken: input.sessionToken,
    channel: input.channel || "web",
    visitorEmail: input.visitorEmail,
    state: defaultState(),
    handoffState: "not_requested",
    humanTakeover: false,
    assignedAgentId: null,
    createdAt: now,
    updatedAt: now,
  };
  await fs.writeFile(convPath(record.id), JSON.stringify(record, null, 2));
  await fs.writeFile(msgPath(record.id), JSON.stringify([], null, 2));
  return record;
}

export async function getConversation(
  id: string,
): Promise<ConversationRecord | null> {
  try {
    const raw = await fs.readFile(convPath(id), "utf8");
    return JSON.parse(raw) as ConversationRecord;
  } catch {
    return null;
  }
}

export async function findConversationBySession(
  workspaceId: string,
  sessionToken: string,
): Promise<ConversationRecord | null> {
  await ensureDirs();
  const dir = path.join(env.dataDir, "conversations");
  const files = await fs.readdir(dir);
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const raw = await fs.readFile(path.join(dir, file), "utf8");
    const rec = JSON.parse(raw) as ConversationRecord;
    if (
      rec.workspaceId === workspaceId &&
      rec.sessionToken === sessionToken
    ) {
      return rec;
    }
  }
  return null;
}

export async function listConversationsByWorkspace(
  workspaceId: string,
): Promise<ConversationRecord[]> {
  await ensureDirs();
  const dir = path.join(env.dataDir, "conversations");
  const files = await fs.readdir(dir);
  const out: ConversationRecord[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const raw = await fs.readFile(path.join(dir, file), "utf8");
      const rec = JSON.parse(raw) as ConversationRecord;
      if (rec.workspaceId === workspaceId) out.push(rec);
    } catch {
      // skip bad files
    }
  }
  return out;
}

export async function saveConversation(
  record: ConversationRecord,
): Promise<void> {
  record.updatedAt = new Date().toISOString();
  await fs.writeFile(convPath(record.id), JSON.stringify(record, null, 2));
}

export async function getMessages(
  conversationId: string,
): Promise<ChatMessage[]> {
  try {
    const raw = await fs.readFile(msgPath(conversationId), "utf8");
    return JSON.parse(raw) as ChatMessage[];
  } catch {
    return [];
  }
}

export async function appendMessages(
  conversationId: string,
  messages: ChatMessage[],
): Promise<ChatMessage[]> {
  const existing = await getMessages(conversationId);
  const next = [...existing, ...messages];
  await fs.writeFile(msgPath(conversationId), JSON.stringify(next, null, 2));
  return next;
}

export async function createTicket(
  input: Omit<TicketRecord, "id" | "createdAt" | "status"> & {
    status?: TicketRecord["status"];
  },
): Promise<TicketRecord> {
  await ensureDirs();
  const ticket: TicketRecord = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    email: input.email,
    phone: input.phone,
    subject: input.subject,
    body: input.body,
    status: input.status || "open",
    createdAt: new Date().toISOString(),
  };
  await fs.writeFile(ticketPath(ticket.id), JSON.stringify(ticket, null, 2));
  return ticket;
}

export async function listTickets(
  workspaceId: string,
): Promise<TicketRecord[]> {
  await ensureDirs();
  const dir = path.join(env.dataDir, "tickets");
  const files = await fs.readdir(dir);
  const out: TicketRecord[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const raw = await fs.readFile(path.join(dir, file), "utf8");
    const t = JSON.parse(raw) as TicketRecord;
    if (t.workspaceId === workspaceId) out.push(t);
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createCustomerAlert(
  input: Omit<CustomerAlertRecord, "id" | "createdAt" | "status" | "notifiedAt"> & {
    status?: CustomerAlertRecord["status"];
  },
): Promise<CustomerAlertRecord> {
  await ensureDirs();
  const record: CustomerAlertRecord = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    type: input.type,
    email: input.email,
    phone: input.phone,
    productId: input.productId,
    productTitle: input.productTitle,
    variantId: input.variantId,
    size: input.size,
    color: input.color,
    status: input.status || "pending",
    createdAt: new Date().toISOString(),
    notifiedAt: null,
  };
  await fs.writeFile(alertPath(record.id), JSON.stringify(record, null, 2));
  return record;
}

export async function listCustomerAlerts(
  workspaceId: string,
  opts?: { productId?: string; status?: CustomerAlertRecord["status"]; type?: CustomerAlertType },
): Promise<CustomerAlertRecord[]> {
  await ensureDirs();
  const dir = path.join(env.dataDir, "alerts");
  const files = await fs.readdir(dir);
  const out: CustomerAlertRecord[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const raw = await fs.readFile(path.join(dir, file), "utf8");
    const a = JSON.parse(raw) as CustomerAlertRecord;
    if (a.workspaceId !== workspaceId) continue;
    if (opts?.productId && a.productId !== opts.productId) continue;
    if (opts?.status && a.status !== opts.status) continue;
    if (opts?.type && a.type !== opts.type) continue;
    out.push(a);
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function markCustomerAlertNotified(
  id: string,
): Promise<CustomerAlertRecord | null> {
  await ensureDirs();
  try {
    const raw = await fs.readFile(alertPath(id), "utf8");
    const a = JSON.parse(raw) as CustomerAlertRecord;
    a.status = "notified";
    a.notifiedAt = new Date().toISOString();
    await fs.writeFile(alertPath(id), JSON.stringify(a, null, 2));
    return a;
  } catch {
    return null;
  }
}

export function makeMessage(
  partial: Omit<ChatMessage, "id" | "sentAt"> & {
    id?: string;
    sentAt?: string;
  },
): ChatMessage {
  return {
    id: partial.id || randomUUID(),
    sentAt: partial.sentAt || new Date().toISOString(),
    ...partial,
  };
}
