"use client";

import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DAY_LABELS,
  WEEKDAYS,
  normalizeTimeValue,
  type WeeklySchedule,
} from "@/lib/business-hours";
import { cn } from "@/lib/utils";

type ScheduleEditorProps = {
  schedule: WeeklySchedule;
  timezone: string;
  timezoneOptions: string[];
  onScheduleChange: (schedule: WeeklySchedule) => void;
  onTimezoneChange: (timezone: string) => void;
  className?: string;
};

export default function ScheduleEditor({
  schedule,
  timezone,
  timezoneOptions,
  onScheduleChange,
  onTimezoneChange,
  className,
}: ScheduleEditorProps) {
  const updateDay = (day: (typeof WEEKDAYS)[number], patch: Partial<WeeklySchedule[(typeof WEEKDAYS)[number]]>) => {
    onScheduleChange({
      ...schedule,
      [day]: { ...schedule[day], ...patch },
    });
  };

  return (
    <div className={cn("space-y-5", className)}>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">Timezone</Label>
        <Select value={timezone} onValueChange={(v) => v && onTimezoneChange(v)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select timezone" />
          </SelectTrigger>
          <SelectContent className="max-h-64">
            {timezoneOptions.map((tz) => (
              <SelectItem key={tz} value={tz}>
                {tz}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/80">
        <div className="min-w-[420px]">
          <div className="grid grid-cols-[minmax(88px,1.2fr)_52px_120px_120px] gap-3 border-b border-border/60 bg-muted/30 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Day</span>
            <span className="text-center">Open</span>
            <span>From</span>
            <span>To</span>
          </div>
          {WEEKDAYS.map((day) => {
            const slot = schedule[day];
            return (
              <div
                key={day}
                className="grid grid-cols-[minmax(88px,1.2fr)_52px_120px_120px] items-center gap-3 border-b border-border/40 px-4 py-2.5 last:border-b-0"
              >
                <span className="text-sm font-medium text-foreground">{DAY_LABELS[day]}</span>
                <div className="flex justify-center">
                  <input
                    type="checkbox"
                    checked={slot.enabled}
                    onChange={(e) => updateDay(day, { enabled: e.target.checked })}
                    className="size-4 cursor-pointer rounded border-border accent-primary focus:ring-2 focus:ring-primary/30"
                    aria-label={`${DAY_LABELS[day]} open`}
                  />
                </div>
                <input
                  type="time"
                  value={slot.start}
                  disabled={!slot.enabled}
                  step={900}
                  onChange={(e) => updateDay(day, { start: normalizeTimeValue(e.target.value) })}
                  className="h-9 w-full min-w-[112px] rounded-md border border-border/80 bg-card px-2 text-sm disabled:cursor-not-allowed disabled:bg-muted/40 disabled:opacity-50"
                />
                <input
                  type="time"
                  value={slot.end}
                  disabled={!slot.enabled}
                  step={900}
                  onChange={(e) => updateDay(day, { end: normalizeTimeValue(e.target.value) })}
                  className="h-9 w-full min-w-[112px] rounded-md border border-border/80 bg-card px-2 text-sm disabled:cursor-not-allowed disabled:bg-muted/40 disabled:opacity-50"
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function BusinessHoursDialogFrame({
  title,
  children,
  footer,
}: {
  title: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <>
      <div className="border-b border-border/60 px-6 py-5 pr-14">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
      <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border/60 bg-muted/30 px-6 py-4 sm:flex-row sm:justify-end">
        {footer}
      </div>
    </>
  );
}
