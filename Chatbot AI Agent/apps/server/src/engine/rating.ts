import type { RatingPayload } from "@chatbot/shared";

export const CHAT_RATING_OPTIONS = [
  { id: "rate_1", emoji: "😠", label: "Poor", score: 1 },
  { id: "rate_2", emoji: "😕", label: "Fair", score: 2 },
  { id: "rate_3", emoji: "😐", label: "Okay", score: 3 },
  { id: "rate_4", emoji: "🙂", label: "Good", score: 4 },
  { id: "rate_5", emoji: "😍", label: "Great", score: 5 },
] as const;

export function ratingPayload(
  prompt = "Before you go — how was this chat?",
): RatingPayload {
  return {
    prompt,
    options: CHAT_RATING_OPTIONS.map((o) => ({ ...o })),
  };
}

/** Customer is ending the chat / not continuing. */
export function isEndChatIntent(message: string, choiceId?: string | null): boolean {
  if (choiceId === "all_set") return true;
  const m = String(message || "").trim();
  if (!m) return false;
  return (
    /^(all set|all set[,!.]? thanks|all set[,!.]? thank you|thanks[,!.]? (i'?m )?all set)\b/i.test(
      m,
    ) ||
    /^(that'?s all|that is all|i'?m (all )?done|i am done|end chat|goodbye|good bye|bye[,!.]?)\s*$/i.test(
      m,
    ) ||
    /^(no thanks|no thank you|i'?m good|im good|nothing else)\s*[.!]?\s*$/i.test(m)
  );
}

export function parseRatingChoice(
  message: string,
  choiceId?: string | null,
): { score: number; emoji: string; label: string; id: string } | null {
  if (choiceId) {
    const byId = CHAT_RATING_OPTIONS.find((o) => o.id === choiceId);
    if (byId) return { ...byId };
  }
  const m = String(message || "").trim();
  const scoreMatch = m.match(/^rating\s*[:=]\s*([1-5])\b/i);
  if (scoreMatch) {
    const score = Number(scoreMatch[1]);
    const opt = CHAT_RATING_OPTIONS.find((o) => o.score === score);
    if (opt) return { ...opt };
  }
  const emojiMatch = CHAT_RATING_OPTIONS.find(
    (o) => m === o.emoji || m.startsWith(o.emoji),
  );
  if (emojiMatch) return { ...emojiMatch };
  return null;
}
