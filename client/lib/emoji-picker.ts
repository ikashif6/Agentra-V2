import emojiData from "emoji-datasource-google";

export type EmojiItem = {
  native: string;
  unified: string;
  shortName: string;
};

export type EmojiCategory = {
  id: string;
  label: string;
  emojis: EmojiItem[];
};

const GOOGLE_EMOJI_CDN =
  "https://cdn.jsdelivr.net/npm/emoji-datasource-google@15.1.2/img/google/64";

const CATEGORY_LABELS: Record<string, string> = {
  "Smileys & Emotion": "Smileys",
  "People & Body": "People",
  "Animals & Nature": "Nature",
  "Food & Drink": "Food",
  "Travel & Places": "Travel",
  Activities: "Activities",
  Objects: "Objects",
  Symbols: "Symbols",
  Flags: "Flags",
};

const CATEGORY_ORDER = [
  "Smileys & Emotion",
  "People & Body",
  "Animals & Nature",
  "Food & Drink",
  "Travel & Places",
  "Activities",
  "Objects",
  "Symbols",
  "Flags",
];

function unifiedToNative(unified: string): string {
  return unified
    .toLowerCase()
    .split("-")
    .map((hex) => String.fromCodePoint(parseInt(hex, 16)))
    .join("");
}

function buildEmojiCategories(): EmojiCategory[] {
  const byCategory = new Map<string, EmojiItem[]>();

  for (const item of emojiData) {
    if (!item.has_img_google || item.category === "Component") continue;

    const unified = item.unified.toLowerCase();
    const native = unifiedToNative(unified);
    if (!native) continue;

    const category = item.category;
    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category)!.push({
      native,
      unified,
      shortName: item.short_name,
    });
  }

  return CATEGORY_ORDER.filter((label) => byCategory.has(label)).map((label) => ({
    id: label.toLowerCase().replace(/\s+&\s+/g, "-").replace(/\s+/g, "-"),
    label: CATEGORY_LABELS[label] ?? label,
    emojis: byCategory.get(label) ?? [],
  }));
}

export const EMOJI_CATEGORIES = buildEmojiCategories();

export function getEmojiImageUrl(unified: string): string {
  return `${GOOGLE_EMOJI_CDN}/${unified.toLowerCase()}.png`;
}

export function buildEmojiHtml(emoji: Pick<EmojiItem, "native" | "unified">): string {
  const src = getEmojiImageUrl(emoji.unified);
  return `<img src="${src}" alt="${emoji.native}" data-emoji="1" class="inline-emoji" width="18" height="18" />`;
}
