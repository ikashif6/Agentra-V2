import type { LiveChatRatingLabel, LiveChatRatingSummary } from "@/lib/types";

export const LIVE_CHAT_RATING_OPTIONS = [
  { value: 1 as const, emoji: "😞", label: "Very bad", key: "very_bad" as LiveChatRatingLabel },
  { value: 2 as const, emoji: "🙁", label: "Bad", key: "bad" as LiveChatRatingLabel },
  { value: 3 as const, emoji: "😐", label: "Okay", key: "okay" as LiveChatRatingLabel },
  { value: 4 as const, emoji: "🙂", label: "Good", key: "good" as LiveChatRatingLabel },
  { value: 5 as const, emoji: "😍", label: "Excellent", key: "excellent" as LiveChatRatingLabel },
];

export function ratingOption(value: number) {
  return LIVE_CHAT_RATING_OPTIONS.find((option) => option.value === value);
}

export function formatAverageRating(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toFixed(1);
}

export function emptyRatingSummary(): LiveChatRatingSummary {
  return {
    totalRatings: 0,
    averageRating: null,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  };
}
