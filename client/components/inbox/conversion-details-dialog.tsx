"use client";

import { CalendarCheck, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { StoreOrderConversion, StoreOrderConversionSession } from "@/lib/types";
import { formatConversionDate } from "@/components/inbox/order-utils";

type ConversionDetailsDialogProps = {
  conversion: StoreOrderConversion | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onViewSession: (session: StoreOrderConversionSession) => void;
};

export function ConversionDetailsDialog({
  conversion,
  open,
  onOpenChange,
  onViewSession,
}: ConversionDetailsDialogProps) {
  if (!conversion) return null;

  const totalSessions = conversion.totalSessions ?? conversion.sessions.length ?? 0;
  const daysToConversion = conversion.daysToConversion ?? 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,640px)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border/60 px-5 py-4">
          <DialogTitle className="text-lg font-semibold">Conversion details</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/40 p-4">
            <div>
              <p className="text-xs text-muted-foreground">Total sessions</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{totalSessions}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Days to conversion</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{daysToConversion}</p>
            </div>
          </div>

          <ul className="divide-y divide-border/60 rounded-lg border border-border/60">
            {conversion.sessions.map((session, index) => {
              const label = session.rowLabel || session.sourceDescription || session.visitLabel || "Session";
              const buttonLabel =
                totalSessions > 1 && index === 0 ? "View full sessions" : "View full session";

              return (
                <li key={session.id || `session-${index}`} className="flex items-start gap-3 px-4 py-3">
                  {index === 0 ? (
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-border/80 text-[11px] font-medium text-muted-foreground">
                      1
                    </span>
                  ) : (
                    <CalendarCheck className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground">{label}</p>
                    {session.occurredAt ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatConversionDate(session.occurredAt)}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 shrink-0 text-xs"
                    onClick={() => onViewSession(session)}
                  >
                    {buttonLabel}
                  </Button>
                </li>
              );
            })}
            {conversion.sessions.length === 0 ? (
              <li className="flex items-center gap-3 px-4 py-3 text-sm text-muted-foreground">
                <Circle className="size-4" />
                No session data available for this order.
              </li>
            ) : null}
          </ul>
        </div>

        <div className="flex justify-end border-t border-border/60 px-5 py-3">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
