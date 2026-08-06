"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Volume2, VolumeX, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { notificationsApi } from "@/lib/api";
import { getApiError } from "@/lib/api-error";
import {
  NOTIFICATION_SECTIONS,
  NOTIFICATION_SOUNDS,
  playNotificationSound,
  soundLabel,
  type NotificationSettings,
  type NotificationSoundId,
} from "@/lib/notifications";
import { cn } from "@/lib/utils";

function RuleTableHeader() {
  return (
    <div className="grid grid-cols-[minmax(0,1.6fr)_160px_100px] gap-4 border-b border-border/60 px-5 py-3">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Event
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Sound
      </span>
      <span className="text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Browser
      </span>
    </div>
  );
}

export default function NotificationsPanel() {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await notificationsApi.getSettings();
      setSettings(data.data.notifications);
    } catch (err: unknown) {
      const { message } = getApiError(err, "Failed to load notification settings");
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const persist = async (
    patch: { volume?: number; rules?: Record<string, { sound?: string; browser?: boolean }> },
    key: string,
  ) => {
    setSavingKey(key);
    try {
      const { data } = await notificationsApi.updateSettings(patch);
      setSettings(data.data.notifications);
    } catch (err: unknown) {
      const { message } = getApiError(err, "Could not save notification settings");
      toast.error(message);
      await load();
    } finally {
      setSavingKey(null);
    }
  };

  const updateVolume = (volume: number) => {
    if (!settings) return;
    setSettings({ ...settings, volume });
    void persist({ volume }, "volume");
  };

  const updateRule = (
    eventId: string,
    patch: { sound?: NotificationSoundId; browser?: boolean },
    preview = false,
  ) => {
    if (!settings) return;

    const nextRules = {
      ...settings.rules,
      [eventId]: {
        ...settings.rules[eventId],
        ...patch,
      },
    };

    setSettings({ ...settings, rules: nextRules });
    void persist({ rules: { [eventId]: patch } }, eventId);

    if (preview && patch.sound && patch.sound !== "none") {
      playNotificationSound(patch.sound, settings.volume);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Notifications</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Choose when Agentra alerts you in the browser and pick a sound for each event.
        </p>
      </div>

      <section className="overflow-hidden rounded-xl border border-border/80 bg-card">
        <div className="border-b border-border/60 px-5 py-4">
          <p className="text-sm font-medium text-foreground">Volume</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Adjust the volume for all notification sounds in this workspace.
          </p>
        </div>
        <div className="flex items-center gap-4 px-5 py-5">
          <VolumeX className="size-4 shrink-0 text-muted-foreground" />
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={settings.volume}
            onChange={(e) => updateVolume(Number(e.target.value))}
            className="h-2 w-full max-w-md flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
            aria-label="Notification volume"
          />
          <Volume2 className="size-4 shrink-0 text-muted-foreground" />
          <span className="w-10 text-right text-sm tabular-nums text-muted-foreground">
            {settings.volume}%
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={savingKey === "volume"}
            onClick={() => playNotificationSound("classic", settings.volume)}
          >
            <Play className="mr-1.5 size-3.5" />
            Test
          </Button>
        </div>
      </section>

      {NOTIFICATION_SECTIONS.map((section) => (
        <section
          key={section.id}
          className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:border-white/[0.06] dark:shadow-[0_1px_2px_rgba(0,0,0,0.35)] dark:border-white/[0.06] dark:shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
        >
          <div className="border-b border-border/60 px-5 py-4">
            <p className="text-sm font-medium text-foreground">{section.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>
          </div>

          <RuleTableHeader />

          <div className="divide-y divide-border/40">
            {section.events.map((event) => {
              const rule = settings.rules[event.id];
              if (!rule) return null;
              const isSaving = savingKey === event.id;

              return (
                <div
                  key={event.id}
                  className="grid grid-cols-[minmax(0,1.6fr)_160px_100px] items-center gap-4 px-5 py-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{event.label}</p>
                    {event.hint ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">{event.hint}</p>
                    ) : null}
                  </div>

                  <Select
                    value={rule.sound}
                    onValueChange={(value) =>
                      updateRule(event.id, { sound: (value ?? "classic") as NotificationSoundId }, true)
                    }
                  >
                    <SelectTrigger className="h-9 w-full px-3" disabled={isSaving}>
                      <span className="truncate">{soundLabel(rule.sound)}</span>
                    </SelectTrigger>
                    <SelectContent className="p-2" sideOffset={8} alignItemWithTrigger={false}>
                      {NOTIFICATION_SOUNDS.map((sound) => (
                        <SelectItem key={sound.id} value={sound.id} className="py-2.5 pl-3 pr-9">
                          {sound.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="flex justify-end">
                    <Switch
                      checked={rule.browser}
                      disabled={isSaving}
                      onCheckedChange={(checked) =>
                        updateRule(event.id, { browser: Boolean(checked) })
                      }
                      aria-label={`Browser notifications for ${event.label}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {savingKey ? (
        <p className={cn("text-xs text-muted-foreground")}>Saving changes…</p>
      ) : null}
    </div>
  );
}
