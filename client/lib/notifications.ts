export type NotificationSoundId = "classic" | "chime" | "soft" | "ping" | "none";

export type NotificationRule = {
  sound: NotificationSoundId;
  browser: boolean;
};

export type NotificationSettings = {
  volume: number;
  rules: Record<string, NotificationRule>;
};

export type NotificationEvent = {
  id: string;
  label: string;
  hint?: string;
};

export type NotificationSection = {
  id: string;
  title: string;
  description: string;
  events: NotificationEvent[];
};

export const NOTIFICATION_SOUNDS: { id: NotificationSoundId; label: string }[] = [
  { id: "classic", label: "Classic" },
  { id: "chime", label: "Chime" },
  { id: "soft", label: "Soft" },
  { id: "ping", label: "Ping" },
  { id: "none", label: "None" },
];

export const NOTIFICATION_SECTIONS: NotificationSection[] = [
  {
    id: "ticket_updates",
    title: "Ticket updates",
    description: "Get notified when one of these events happen in your inbox.",
    events: [
      { id: "ticket_assigned", label: "Assigned to a ticket" },
      { id: "ticket_mentioned", label: "Mentioned in an internal note" },
      { id: "snooze_expired", label: "Snooze expired" },
      { id: "message_failed", label: "Message failed to send" },
      { id: "live_chat_ticket", label: "Live chat tickets", hint: "New conversations from your chat widget" },
    ],
  },
  {
    id: "new_messages",
    title: "New messages",
    description: "Get notified when you receive new messages from these channels.",
    events: [
      { id: "channel_email", label: "Email" },
      { id: "channel_chat", label: "Live chat" },
      { id: "channel_help_center", label: "Help center" },
      { id: "channel_whatsapp", label: "WhatsApp" },
      { id: "channel_instagram", label: "Instagram" },
      { id: "channel_facebook", label: "Facebook" },
    ],
  },
  {
    id: "imports",
    title: "Imports",
    description: "Status updates for email and data imports.",
    events: [
      { id: "import_failed", label: "Import failed" },
      { id: "import_success", label: "Import completed" },
    ],
  },
];

let audioContext: AudioContext | null = null;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  if (!audioContext) audioContext = new AudioContext();
  if (audioContext.state === "suspended") {
    void audioContext.resume();
  }
  return audioContext;
}

function playTone(
  ctx: AudioContext,
  frequency: number,
  start: number,
  duration: number,
  volume: number,
  type: OscillatorType = "sine",
) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.05);
}

/** Preview a notification sound in the browser using Web Audio. */
export function playNotificationSound(soundId: NotificationSoundId, volume = 70) {
  if (soundId === "none") return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const level = Math.max(0.05, Math.min(1, volume / 100)) * 0.35;
  const now = ctx.currentTime;

  switch (soundId) {
    case "classic":
      playTone(ctx, 880, now, 0.12, level);
      playTone(ctx, 660, now + 0.14, 0.18, level * 0.85);
      break;
    case "chime":
      playTone(ctx, 1046, now, 0.1, level, "triangle");
      playTone(ctx, 1318, now + 0.11, 0.16, level * 0.9, "triangle");
      break;
    case "soft":
      playTone(ctx, 520, now, 0.22, level * 0.8, "sine");
      break;
    case "ping":
      playTone(ctx, 1200, now, 0.08, level, "square");
      break;
    default:
      break;
  }
}

export function soundLabel(soundId: NotificationSoundId) {
  return NOTIFICATION_SOUNDS.find((sound) => sound.id === soundId)?.label ?? "Classic";
}
