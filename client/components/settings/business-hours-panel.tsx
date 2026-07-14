"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { businessHoursApi } from "@/lib/api";
import { getApiError } from "@/lib/api-error";
import {
  BUSINESS_HOURS_TARGETS,
  cloneWeeklySchedule,
  DEFAULT_WEEKLY_SCHEDULE,
  formatScheduleSummary,
  formatTargetLabels,
  getTimezoneOptions,
  type BusinessHoursConfig,
  type CustomBusinessHours,
  type WeeklySchedule,
} from "@/lib/business-hours";
import { getUserTimezone } from "@/lib/user-timezone";
import { useAuth } from "@/contexts/AuthContext";
import { useConfirm } from "@/contexts/ConfirmContext";
import { cn } from "@/lib/utils";
import ScheduleEditor, { BusinessHoursDialogFrame } from "./schedule-editor";

export default function BusinessHoursPanel() {
  const { user, company } = useAuth();
  const confirm = useConfirm();
  const [config, setConfig] = useState<BusinessHoursConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [defaultDialogOpen, setDefaultDialogOpen] = useState(false);
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const [editingCustom, setEditingCustom] = useState<CustomBusinessHours | null>(null);

  const timezoneOptions = useMemo(() => getTimezoneOptions(), []);
  const fallbackTimezone = getUserTimezone(user, company);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await businessHoursApi.get();
      setConfig(data.data.businessHours);
    } catch (err: unknown) {
      const { message } = getApiError(err, "Failed to load business hours");
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreateCustom = () => {
    setEditingCustom(null);
    setCustomDialogOpen(true);
  };

  const openEditCustom = (entry: CustomBusinessHours) => {
    setEditingCustom(entry);
    setCustomDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  const defaultHours = config?.default;
  const hasDefault = Boolean(defaultHours?.enabled && defaultHours.schedule);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h2 className="text-xl font-bold text-foreground">Business hours</h2>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Define when your support team is available. Business hours are used for{" "}
          <Link href="/settings?item=chat" className="font-medium text-foreground underline-offset-4 hover:underline">
            chat widget
          </Link>{" "}
          visibility, channel routing, and future automation rules.
        </p>
      </header>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Default business hours</h3>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Default hours used across Agentra when no custom hours are set. If no business hours
            are configured, all time is treated as outside business hours.
          </p>
        </div>

        <HoursCard
          badge="Default"
          summary={
            hasDefault
              ? formatScheduleSummary(defaultHours?.schedule)
              : "No hours configured"
          }
          timezone={hasDefault ? defaultHours?.timezone ?? fallbackTimezone : fallbackTimezone}
          onEdit={() => setDefaultDialogOpen(true)}
        />
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Custom business hours</h3>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Set custom availability for specific channels. Custom business hours override the
            default schedule where they apply.
          </p>
        </div>

        {config?.custom.length ? (
          <div className="space-y-2">
            {config.custom.map((entry) => (
              <HoursCard
                key={entry.id}
                badge={entry.name}
                subtitle={formatTargetLabels(entry.targets)}
                summary={formatScheduleSummary(entry.schedule)}
                timezone={entry.timezone}
                onEdit={() => openEditCustom(entry)}
                onDelete={async () => {
                  const ok = await confirm({
                    title: "Remove custom hours?",
                    description: `"${entry.name}" will be deleted. Channels using these hours fall back to the default schedule.`,
                    confirmLabel: "Remove",
                  });
                  if (!ok) return;
                  try {
                    await businessHoursApi.deleteCustom(entry.id);
                    toast.success("Custom hours removed");
                    load();
                  } catch (err: unknown) {
                    const { message } = getApiError(err, "Failed to remove custom hours");
                    toast.error(message);
                  }
                }}
              />
            ))}
          </div>
        ) : null}

        <Button onClick={openCreateCustom}>
          <Plus className="mr-2 size-4" />
          Add custom business hours
        </Button>
      </section>

      <DefaultHoursDialog
        open={defaultDialogOpen}
        onOpenChange={setDefaultDialogOpen}
        initial={defaultHours}
        fallbackTimezone={fallbackTimezone}
        timezoneOptions={timezoneOptions}
        onSaved={(next) => {
          setConfig((prev) => (prev ? { ...prev, default: next } : { default: next, custom: [] }));
          load();
        }}
      />

      <CustomHoursDialog
        open={customDialogOpen}
        onOpenChange={setCustomDialogOpen}
        entry={editingCustom}
        fallbackTimezone={fallbackTimezone}
        timezoneOptions={timezoneOptions}
        onSaved={load}
      />
    </div>
  );
}

function HoursCard({
  badge,
  subtitle,
  summary,
  timezone,
  onEdit,
  onDelete,
}: {
  badge: string;
  subtitle?: string;
  summary: string;
  timezone: string;
  onEdit: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/80 bg-card px-4 py-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
        {badge}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{summary}</p>
        {subtitle ? (
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      <span className="hidden shrink-0 text-sm text-muted-foreground sm:inline">{timezone}</span>
      <div className="flex shrink-0 items-center gap-1">
        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-red-600"
            aria-label="Delete"
          >
            <Trash2 className="size-4" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={onEdit}
          className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Edit"
        >
          <Pencil className="size-4" />
        </button>
      </div>
    </div>
  );
}

function DefaultHoursDialog({
  open,
  onOpenChange,
  initial,
  fallbackTimezone,
  timezoneOptions,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: BusinessHoursConfig["default"];
  fallbackTimezone: string;
  timezoneOptions: string[];
  onSaved: (next: BusinessHoursConfig["default"]) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [timezone, setTimezone] = useState(fallbackTimezone);
  const [schedule, setSchedule] = useState<WeeklySchedule>(cloneWeeklySchedule());

  useEffect(() => {
    if (!open) return;
    setTimezone(initial?.timezone || fallbackTimezone);
    setSchedule(cloneWeeklySchedule(initial?.schedule ?? DEFAULT_WEEKLY_SCHEDULE));
  }, [open, initial, fallbackTimezone]);

  const onSave = async () => {
    setSaving(true);
    try {
      const { data } = await businessHoursApi.updateDefault({
        enabled: true,
        timezone,
        schedule,
      });
      toast.success("Default business hours saved");
      onSaved(data.data.businessHours.default);
      onOpenChange(false);
    } catch (err: unknown) {
      const { message } = getApiError(err, "Failed to save business hours");
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="flex max-h-[min(90vh,720px)] w-[calc(100%-2rem)] max-w-[540px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[540px]"
      >
        <BusinessHoursDialogFrame
          title="Edit default business hours"
          footer={
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button disabled={saving} onClick={onSave}>
                {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Save
              </Button>
            </>
          }
        >
          <ScheduleEditor
            schedule={schedule}
            timezone={timezone}
            timezoneOptions={timezoneOptions}
            onScheduleChange={setSchedule}
            onTimezoneChange={setTimezone}
          />
        </BusinessHoursDialogFrame>
      </DialogContent>
    </Dialog>
  );
}

function CustomHoursDialog({
  open,
  onOpenChange,
  entry,
  fallbackTimezone,
  timezoneOptions,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: CustomBusinessHours | null;
  fallbackTimezone: string;
  timezoneOptions: string[];
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [targets, setTargets] = useState<string[]>([]);
  const [timezone, setTimezone] = useState(fallbackTimezone);
  const [schedule, setSchedule] = useState<WeeklySchedule>(cloneWeeklySchedule());

  useEffect(() => {
    if (!open) return;
    setName(entry?.name ?? "");
    setTargets(entry?.targets ?? []);
    setTimezone(entry?.timezone ?? fallbackTimezone);
    setSchedule(cloneWeeklySchedule(entry?.schedule ?? DEFAULT_WEEKLY_SCHEDULE));
  }, [open, entry, fallbackTimezone]);

  const toggleTarget = (id: string) => {
    setTargets((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  };

  const onSave = async () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      const payload = { name: name.trim(), targets, timezone, schedule };
      if (entry) {
        await businessHoursApi.updateCustom(entry.id, payload);
        toast.success("Custom business hours updated");
      } else {
        await businessHoursApi.createCustom(payload);
        toast.success("Custom business hours added");
      }
      onSaved();
      onOpenChange(false);
    } catch (err: unknown) {
      const { message } = getApiError(err, "Failed to save custom hours");
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="flex max-h-[min(90vh,720px)] w-[calc(100%-2rem)] max-w-[540px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[540px]"
      >
        <BusinessHoursDialogFrame
          title={entry ? "Edit custom business hours" : "Add custom business hours"}
          footer={
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button disabled={saving} onClick={onSave}>
                {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Save
              </Button>
            </>
          }
        >
          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Weekend chat coverage"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Applies to</Label>
              <div className="grid grid-cols-2 gap-2">
                {BUSINESS_HOURS_TARGETS.map((target) => {
                  const checked = targets.includes(target.id);
                  return (
                    <label
                      key={target.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                        checked ? "border-primary bg-primary/5" : "border-border/80",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleTarget(target.id)}
                        className="size-4 rounded border-border accent-primary"
                      />
                      {target.label}
                    </label>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Leave all unchecked to apply only when explicitly assigned later.
              </p>
            </div>

            <ScheduleEditor
              schedule={schedule}
              timezone={timezone}
              timezoneOptions={timezoneOptions}
              onScheduleChange={setSchedule}
              onTimezoneChange={setTimezone}
            />
          </div>
        </BusinessHoursDialogFrame>
      </DialogContent>
    </Dialog>
  );
}
