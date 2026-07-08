"use client";

import { useState } from "react";
import type { MouseEvent } from "react";
import {
  Coffee,
  Flag,
  Hash,
  Landmark,
  Lightbulb,
  Smile,
  TreePine,
  Trophy,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { DropdownMenuContent } from "@/components/ui/dropdown-menu";
import {
  EMOJI_CATEGORIES,
  getEmojiImageUrl,
  type EmojiItem,
} from "@/lib/emoji-picker";
import { cn } from "@/lib/utils";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  "smileys-emotion": Smile,
  "people-body": UserRound,
  "animals-nature": TreePine,
  "food-drink": Coffee,
  "travel-places": Landmark,
  activities: Trophy,
  objects: Lightbulb,
  symbols: Hash,
  flags: Flag,
};

type EmojiPickerMenuProps = {
  onPick: (emoji: EmojiItem) => void;
  onKeepFocus: (event: MouseEvent) => void;
};

export function EmojiPickerMenu({ onPick, onKeepFocus }: EmojiPickerMenuProps) {
  const [activeCategoryId, setActiveCategoryId] = useState(EMOJI_CATEGORIES[0]?.id ?? "");
  const activeCategory =
    EMOJI_CATEGORIES.find((category) => category.id === activeCategoryId) ??
    EMOJI_CATEGORIES[0];

  return (
    <DropdownMenuContent align="start" className="w-[320px] gap-0 p-0">
      <div className="flex gap-0.5 overflow-x-auto border-b border-border/60 px-2 py-1.5">
        {EMOJI_CATEGORIES.map((category) => {
          const Icon = CATEGORY_ICONS[category.id] ?? Smile;
          const isActive = category.id === activeCategory?.id;

          return (
            <button
              key={category.id}
              type="button"
              title={category.label}
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
              onMouseDown={onKeepFocus}
              onClick={() => setActiveCategoryId(category.id)}
            >
              <Icon className="size-4" />
            </button>
          );
        })}
      </div>

      <div className="max-h-[280px] overflow-y-auto p-2">
        <div className="grid grid-cols-8 gap-0.5">
          {activeCategory?.emojis.map((emoji) => (
            <button
              key={emoji.unified}
              type="button"
              title={emoji.shortName.replace(/_/g, " ")}
              className="flex size-8 items-center justify-center rounded-md hover:bg-muted"
              onMouseDown={onKeepFocus}
              onClick={() => onPick(emoji)}
            >
              <img
                src={getEmojiImageUrl(emoji.unified)}
                alt={emoji.shortName}
                width={22}
                height={22}
                className="size-[22px] object-contain"
                loading="lazy"
                draggable={false}
              />
            </button>
          ))}
        </div>
      </div>
    </DropdownMenuContent>
  );
}
