import type { ConversationRecord } from "../storage/store.js";
import { listConversationsByWorkspace, saveConversation } from "../storage/store.js";

/** Minutes assumed per queue slot when no live agent capacity is known. */
const MINUTES_PER_POSITION = 3;
/** Conversations stuck in connecting/assigned longer than this are not in the live queue. */
const QUEUE_STALE_MS = 30 * 60 * 1000;

export type QueueStatus = {
  position: number;
  estimatedWaitMinutes: number;
  queueSize: number;
  label: string;
};

function isQueuedState(state: ConversationRecord["handoffState"]): boolean {
  return state === "connecting" || state === "assigned";
}

function handoffAgeMs(conversation: ConversationRecord, now: number): number {
  const raw =
    conversation.handoffRequestedAt ||
    conversation.updatedAt ||
    conversation.createdAt;
  const ts = Date.parse(String(raw || ""));
  if (!Number.isFinite(ts)) return Number.POSITIVE_INFINITY;
  return now - ts;
}

function isFreshQueued(conversation: ConversationRecord, now: number): boolean {
  return (
    isQueuedState(conversation.handoffState) &&
    !conversation.humanTakeover &&
    conversation.handoffState !== "agent_joined" &&
    handoffAgeMs(conversation, now) <= QUEUE_STALE_MS
  );
}

/**
 * Clear abandoned connecting/assigned states so they stop inflating the queue.
 * Best-effort — failures are ignored so queue reads stay fast.
 */
async function expireStaleQueued(
  conversations: ConversationRecord[],
  now: number,
): Promise<void> {
  const stale = conversations.filter(
    (c) =>
      isQueuedState(c.handoffState) &&
      !c.humanTakeover &&
      handoffAgeMs(c, now) > QUEUE_STALE_MS,
  );
  await Promise.all(
    stale.map(async (c) => {
      try {
        c.handoffState = "unavailable";
        if (c.state) c.state.handoffState = "unavailable";
        c.handoffRequestedAt = null;
        await saveConversation(c);
      } catch {
        // ignore — queue math already excludes them by age
      }
    }),
  );
}

export async function getHandoffQueueStatus(
  conversation: ConversationRecord,
): Promise<QueueStatus> {
  const now = Date.now();
  const all = await listConversationsByWorkspace(conversation.workspaceId);

  // Fire-and-forget cleanup of abandoned handoffs in the file store.
  void expireStaleQueued(all, now);

  const queued = all
    .filter((c) => isFreshQueued(c, now))
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
