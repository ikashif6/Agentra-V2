type Listener = (event: Record<string, unknown>) => void;

const listeners = new Map<string, Set<Listener>>();

export function subscribe(conversationId: string, listener: Listener): () => void {
  if (!listeners.has(conversationId)) listeners.set(conversationId, new Set());
  listeners.get(conversationId)!.add(listener);
  return () => {
    listeners.get(conversationId)?.delete(listener);
  };
}

export function publish(conversationId: string, event: Record<string, unknown>) {
  const set = listeners.get(conversationId);
  if (!set) return;
  const payload = { ...event, conversationId, at: new Date().toISOString() };
  for (const listener of set) {
    try {
      listener(payload);
    } catch {
      // ignore listener errors
    }
  }
}
