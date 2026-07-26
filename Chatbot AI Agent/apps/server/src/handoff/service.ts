import type { ConversationRecord } from "../storage/store.js";
import { createTicket, saveConversation } from "../storage/store.js";
import { areAgentsOnline, getBusinessHoursStatus } from "./hours.js";
import { formatConnectingMessage, getHandoffQueueStatus } from "./queue.js";
import { publish } from "../realtime/hub.js";

export async function requestHandoff(input: {
  conversation: ConversationRecord;
  reason: string;
  email?: string;
  phone?: string;
  /** Only create a ticket when the customer confirmed */
  createTicketConfirmed?: boolean;
}): Promise<{
  ok: boolean;
  handoffState: ConversationRecord["handoffState"];
  message: string;
  ticketId?: string;
  ticketRef?: string;
  needsTicketConfirm?: boolean;
  queuePosition?: number;
  estimatedWaitMinutes?: number;
  queueLabel?: string;
  summary?: string;
}> {
  const { conversation } = input;
  const hours = getBusinessHoursStatus();
  const online = areAgentsOnline();
  const summary = conversation.state.slots.handoffSummary || "";
  const summaryBlock = summary
    ? `\n\n--- Agent summary ---\n${summary}`
    : "";

  if (!online) {
    conversation.handoffState = hours.open ? "unavailable" : "outside_business_hours";
    conversation.state.handoffState = conversation.handoffState;
    conversation.handoffRequestedAt = null;
    await saveConversation(conversation);

    if (input.createTicketConfirmed) {
      const ticket = await createTicket({
        workspaceId: conversation.workspaceId,
        conversationId: conversation.id,
        email: input.email || conversation.visitorEmail,
        phone: input.phone || conversation.visitorPhone,
        subject: "Chat handoff — agent unavailable",
        body: `Reason: ${input.reason}\nConversation: ${conversation.id}${summaryBlock}`,
      });
      publish(conversation.id, {
        type: "handoff_ticket",
        ticketId: ticket.id,
      });
      return {
        ok: true,
        handoffState: conversation.handoffState,
        message: `All set — I’ve created a support ticket and our team will follow up shortly. Your reference is ${ticket.id.slice(0, 8).toUpperCase()}.`,
        ticketId: ticket.id,
        ticketRef: ticket.id.slice(0, 8).toUpperCase(),
        summary: summary || undefined,
      };
    }

    return {
      ok: true,
      handoffState: conversation.handoffState,
      message:
        "I’d love to connect you with someone on the team, but no agents are available right now. Want me to create a support ticket so they can follow up with you?",
      needsTicketConfirm: true,
      summary: summary || undefined,
    };
  }

  conversation.handoffState = "connecting";
  conversation.state.handoffState = "connecting";
  conversation.assignedAgentId = null;
  conversation.handoffRequestedAt =
    conversation.handoffRequestedAt || new Date().toISOString();
  await saveConversation(conversation);

  const queue = await getHandoffQueueStatus(conversation);
  const message = formatConnectingMessage(queue);

  publish(conversation.id, {
    type: "handoff_connecting",
    reason: input.reason,
    queuePosition: queue.position,
    estimatedWaitMinutes: queue.estimatedWaitMinutes,
    queueLabel: queue.label,
  });

  return {
    ok: true,
    handoffState: "connecting",
    message,
    queuePosition: queue.position,
    estimatedWaitMinutes: queue.estimatedWaitMinutes,
    queueLabel: queue.label,
    summary: summary || undefined,
  };
}

export async function agentTakeover(
  conversation: ConversationRecord,
  agentId: string,
): Promise<void> {
  conversation.humanTakeover = true;
  conversation.state.humanTakeover = true;
  conversation.handoffState = "agent_joined";
  conversation.state.handoffState = "agent_joined";
  conversation.assignedAgentId = agentId;
  conversation.handoffRequestedAt = null;
  await saveConversation(conversation);
  publish(conversation.id, { type: "agent_joined", agentId });
}
