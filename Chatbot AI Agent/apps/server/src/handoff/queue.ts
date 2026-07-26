import type { ConversationRecord } from "../storage/store.js";
import { listConversationsByWorkspace } from "../storage/store.js";

const MINUTES_PER_POSITION = 3;

export type QueueStatus = {
  position: number;
  estimatedWaitMinutes: number;
  queueSize: number;
  label: string;
};

function isQueuedState(state: ConversationRecord["handoffState"]): boolean {
  return state === "connecting" || state === "assigned";
}

export async function getHandoffQueueStatus(
  conversation: ConversationRecord,
): Promise<QueueStatus> {
  const all = await listConversationsByWorkspace(conversation.workspaceId);
  const queued = all
    .filter(
      (c) =>
        isQueuedState(c.handoffState) &&
        !c.humanTakeover &&
        c.handoffState !== "agent_joined",
    )
    .sort((a, b) => {
      const at = a.handoffRequestedAt || a.updatedAt || a.createdAt;
      const bt = b.handoffRequestedAt || b.updatedAt || b.createdAt;
      return String(at).localeCompare(String(bt));
    });

  let position = queued.findIndex((c) => c.id === conversation.id) + 1;
  if (position < 1) {
    position = queued.length + 1;
  }
  const estimatedWaitMinutes = Math.max(1, position * MINUTES_PER_POSITION);
  const label =
    position === 1
      ? `You're next · about ${estimatedWaitMinutes} min`
      : `You're #${position} in queue · about ${estimatedWaitMinutes} min`;

  return {
    position,
    estimatedWaitMinutes,
    queueSize: Math.max(queued.length, position),
    label,
  };
}

export function formatConnectingMessage(queue: QueueStatus): string {
  return `Connecting you with a human agent.\n${queue.label}`;
}
