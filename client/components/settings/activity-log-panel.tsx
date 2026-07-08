"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { activityLogApi, usersApi } from "@/lib/api";
import { getApiError } from "@/lib/api-error";
import {
  activityActorInitial,
  activityActorLabel,
  DATE_RANGE_OPTIONS,
  formatActivityDate,
  getDateRangeBounds,
  type ActivityDateRange,
  type ActivityEventOption,
  type ActivityLogEntry,
} from "@/lib/activity-log";
import type { User } from "@/lib/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 25;

export default function ActivityLogPanel() {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [events, setEvents] = useState<ActivityEventOption[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [actorId, setActorId] = useState<string>("all");
  const [eventType, setEventType] = useState<string>("all");
  const [dateRange, setDateRange] = useState<ActivityDateRange>("30d");

  const dateBounds = useMemo(() => getDateRangeBounds(dateRange), [dateRange]);

  const memberFilterLabel = useMemo(() => {
    if (actorId === "all") return "All members";
    return members.find((member) => member._id === actorId)?.email ?? "Selected member";
  }, [actorId, members]);

  const eventFilterLabel = useMemo(() => {
    if (eventType === "all") return "All events";
    return events.find((event) => event.id === eventType)?.label ?? "Selected event";
  }, [eventType, events]);

  const dateFilterLabel = useMemo(
    () => DATE_RANGE_OPTIONS.find((option) => option.id === dateRange)?.label ?? "Last 30 days",
    [dateRange],
  );

  const fetchMembers = useCallback(async () => {
    try {
      const { data } = await usersApi.listWorkspace("", 1, 100);
      setMembers(data.data.users ?? []);
    } catch {
      // Non-blocking — filters still work without member list
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await activityLogApi.list({
        actorId: actorId === "all" ? undefined : actorId,
        event: eventType === "all" ? undefined : eventType,
        from: dateBounds.from,
        to: dateBounds.to,
        page,
        limit: PAGE_SIZE,
      });

      setLogs(data.data.logs ?? []);
      setEvents(data.data.events ?? []);
      setPages(data.data.pagination?.pages ?? 1);
      setTotal(data.data.pagination?.total ?? 0);
    } catch (err: unknown) {
      const { message } = getApiError(err, "Failed to load activity log");
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [actorId, eventType, dateBounds.from, dateBounds.to, page]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  useEffect(() => {
    setPage(1);
  }, [actorId, eventType, dateRange]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Activity log</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Recent actions performed by people in this workspace.
        </p>
      </div>

      <div className="rounded-xl border border-border/80 bg-card p-4 md:p-5">
        <div className="flex flex-wrap gap-5 md:gap-6">
          <div className="flex min-w-[220px] flex-1 flex-col gap-2 sm:max-w-[280px]">
            <label htmlFor="activity-member-filter" className="text-xs font-medium text-muted-foreground">
              Team member
            </label>
            <Select value={actorId} onValueChange={(v) => setActorId(v ?? "all")}>
              <SelectTrigger id="activity-member-filter" className="h-10 w-full px-3">
                <span className="truncate">{memberFilterLabel}</span>
              </SelectTrigger>
              <SelectContent className="p-2" sideOffset={8} alignItemWithTrigger={false}>
                <SelectItem value="all" className="py-2.5 pl-3 pr-9">
                  All members
                </SelectItem>
                {members.map((member) => (
                  <SelectItem key={member._id} value={member._id} className="py-2.5 pl-3 pr-9">
                    {member.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex min-w-[220px] flex-1 flex-col gap-2 sm:max-w-[280px]">
            <label htmlFor="activity-event-filter" className="text-xs font-medium text-muted-foreground">
              Event type
            </label>
            <Select value={eventType} onValueChange={(v) => setEventType(v ?? "all")}>
              <SelectTrigger id="activity-event-filter" className="h-10 w-full px-3">
                <span className="truncate">{eventFilterLabel}</span>
              </SelectTrigger>
              <SelectContent className="p-2" sideOffset={8} alignItemWithTrigger={false}>
                <SelectItem value="all" className="py-2.5 pl-3 pr-9">
                  All events
                </SelectItem>
                {events.map((event) => (
                  <SelectItem key={event.id} value={event.id} className="py-2.5 pl-3 pr-9">
                    {event.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex min-w-[220px] flex-1 flex-col gap-2 sm:max-w-[240px]">
            <label htmlFor="activity-date-filter" className="text-xs font-medium text-muted-foreground">
              Date range
            </label>
            <Select value={dateRange} onValueChange={(v) => setDateRange((v ?? "30d") as ActivityDateRange)}>
              <SelectTrigger id="activity-date-filter" className="h-10 w-full px-3">
                <span className="truncate">{dateFilterLabel}</span>
              </SelectTrigger>
              <SelectContent className="p-2" sideOffset={8} alignItemWithTrigger={false}>
                {DATE_RANGE_OPTIONS.map((option) => (
                  <SelectItem key={option.id} value={option.id} className="py-2.5 pl-3 pr-9">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_minmax(0,1.4fr)_minmax(0,1.2fr)] gap-4 border-b border-border/60 bg-muted/20 px-5 py-3.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Member
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Event
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Object
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Date
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-5 animate-spin text-primary" />
          </div>
        ) : logs.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-muted-foreground">
            No activity matches your filters yet.
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {logs.map((entry) => {
              const label = activityActorLabel(entry);
              const isSystem = label === "System";

              return (
                <div
                  key={entry._id}
                  className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_minmax(0,1.4fr)_minmax(0,1.2fr)] items-center gap-4 px-5 py-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar className="size-8 rounded-md">
                      <AvatarFallback
                        className={cn(
                          "rounded-md text-xs font-semibold",
                          isSystem
                            ? "bg-muted text-muted-foreground"
                            : "bg-brand-muted text-primary",
                        )}
                      >
                        {activityActorInitial(entry)}
                      </AvatarFallback>
                    </Avatar>
                    <p className="truncate text-sm text-foreground">{label}</p>
                  </div>

                  <p className="text-sm text-foreground">{entry.eventLabel}</p>

                  <p className="truncate text-sm text-muted-foreground">
                    {entry.objectLabel || "None"}
                  </p>

                  <p className="text-sm text-muted-foreground">{formatActivityDate(entry.createdAt)}</p>
                </div>
              );
            })}
          </div>
        )}

        {total > PAGE_SIZE ? (
          <div className="flex items-center justify-between border-t border-border/60 bg-muted/10 px-5 py-3">
            <span className="text-xs text-muted-foreground">
              {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, total)} of {total}
            </span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
                Prev
              </Button>
              <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
