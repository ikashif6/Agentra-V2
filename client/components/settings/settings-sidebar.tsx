"use client";

import { useMemo, useState } from "react";
import { ChevronDown, PanelLeftClose, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  type SettingsItemId,
  type SettingsNavSection,
  visibleSettingsSections,
} from "@/lib/settings-navigation";
import type { Role } from "@/lib/types";

type SettingsSidebarProps = {
  activeItem: SettingsItemId;
  onSelect: (id: SettingsItemId) => void;
  role?: Role | null;
  /** @deprecated use role */
  isStaff?: boolean;
  /** @deprecated use role */
  isOwner?: boolean;
  onCollapse?: () => void;
};

export default function SettingsSidebar({
  activeItem,
  onSelect,
  role,
  isStaff,
  isOwner,
  onCollapse,
}: SettingsSidebarProps) {
  const sections = useMemo(
    () => visibleSettingsSections({ role, isStaff, isOwner }),
    [role, isStaff, isOwner],
  );

  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const section of sections) initial[section.id] = true;
    return initial;
  });

  const filteredSections = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sections;
    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) =>
            item.label.toLowerCase().includes(q) ||
            item.description?.toLowerCase().includes(q) ||
            section.label.toLowerCase().includes(q),
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [sections, search]);

  const toggleSection = (sectionId: string) => {
    setExpanded((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  return (
    <aside className="flex w-[240px] shrink-0 flex-col border-r border-border/70 bg-muted/15">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Configuration</h2>
        {onCollapse ? (
          <button
            type="button"
            onClick={onCollapse}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
            aria-label="Hide settings menu"
          >
            <PanelLeftClose className="size-4" />
          </button>
        ) : null}
      </div>

      <div className="border-b border-border/60 px-3 py-2.5">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find a setting…"
            className="h-8 pl-8 text-sm"
          />
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto p-2">
        {filteredSections.map((section) => (
          <SectionGroup
            key={section.id}
            section={section}
            expanded={expanded[section.id] ?? true}
            onToggle={() => toggleSection(section.id)}
            activeItem={activeItem}
            onSelect={onSelect}
          />
        ))}
        {filteredSections.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">No settings match your search.</p>
        ) : null}
      </nav>
    </aside>
  );
}

function SectionGroup({
  section,
  expanded,
  onToggle,
  activeItem,
  onSelect,
}: {
  section: SettingsNavSection;
  expanded: boolean;
  onToggle: () => void;
  activeItem: SettingsItemId;
  onSelect: (id: SettingsItemId) => void;
}) {
  const Icon = section.icon;

  return (
    <div className="mb-1">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted/50"
      >
        <Icon className="size-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{section.label}</span>
        <ChevronDown
          className={cn("size-3.5 shrink-0 transition-transform", expanded && "rotate-180")}
        />
      </button>

      {expanded ? (
        <ul className="space-y-0.5 pb-2 pl-1">
          {section.items.map((item) => {
            const selected = activeItem === item.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onSelect(item.id)}
                  className={cn(
                    "flex w-full rounded-[10px] px-3 py-2 text-left text-sm font-medium transition-colors",
                    selected
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
