"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { MetadataOption } from "@/lib/ticket-metadata-options";
import { cn } from "@/lib/utils";

type InboxMetadataPickerProps = {
  label: string;
  value?: string;
  options: MetadataOption[];
  onSelect: (value: string) => void;
  onClear?: () => void;
  className?: string;
};

export function InboxMetadataPicker({
  label,
  value,
  options,
  onSelect,
  onClear,
  className,
}: InboxMetadataPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [parent, setParent] = useState<MetadataOption | null>(null);

  const displayLabel = useMemo(() => {
    if (!value) return null;
    const flat = options.flatMap((option) =>
      option.children
        ? option.children.map((child) => ({
            value: child.value,
            label: `${option.label} · ${child.label}`,
          }))
        : [{ value: option.value, label: option.label }],
    );
    return flat.find((item) => item.value === value)?.label ?? value;
  }, [options, value]);

  const visibleOptions = useMemo(() => {
    const list = parent?.children ?? options;
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((item) => item.label.toLowerCase().includes(q));
  }, [options, parent, search]);

  const reset = () => {
    setSearch("");
    setParent(null);
  };

  const selectOption = (item: MetadataOption) => {
    onSelect(item.value);
    setOpen(false);
    reset();
  };

  return (
    <div className={cn("flex items-center justify-between gap-3 py-2", className)}>
      <span className="text-sm text-muted-foreground">{label}</span>
      {displayLabel ? (
        <button
          type="button"
          onClick={() => onClear?.()}
          className="max-w-[58%] truncate rounded-md bg-muted/50 px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
          title={displayLabel}
        >
          {displayLabel}
        </button>
      ) : (
        <DropdownMenu
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) reset();
          }}
        >
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground" />
            }
          >
            + Add
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 p-0">
            <div className="border-b border-border/60 p-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search…"
                  className="h-8 pl-7 text-xs"
                  onKeyDown={(e) => e.stopPropagation()}
                />
              </div>
            </div>
            {parent ? (
              <button
                type="button"
                onClick={() => {
                  setParent(null);
                  setSearch("");
                }}
                className="flex w-full items-center gap-1.5 border-b border-border/60 px-3 py-2 text-xs text-muted-foreground hover:bg-muted/50"
              >
                <ChevronLeft className="size-3.5" />
                {parent.label}
              </button>
            ) : null}
            <div className="max-h-52 overflow-y-auto p-1">
              {visibleOptions.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-muted-foreground">No matches</p>
              ) : (
                visibleOptions.map((item) =>
                  item.children?.length ? (
                    <button
                      key={item.value}
                      type="button"
                      className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm text-foreground hover:bg-accent hover:text-accent-foreground"
                      onClick={() => {
                        setParent(item);
                        setSearch("");
                      }}
                    >
                      <span>{item.label}</span>
                      <ChevronRight className="size-3.5 text-muted-foreground" />
                    </button>
                  ) : (
                    <button
                      key={item.value}
                      type="button"
                      className="flex w-full items-center rounded-md px-3 py-2 text-sm text-foreground hover:bg-accent hover:text-accent-foreground"
                      onClick={() => selectOption(item)}
                    >
                      {item.label}
                    </button>
                  ),
                )
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
