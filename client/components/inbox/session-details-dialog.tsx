"use client";

import { ArrowLeft, Calendar, MessageCircle, MousePointerClick } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { StoreOrderConversionSession } from "@/lib/types";
import { formatLandingPath, formatSessionTimestamp } from "@/components/inbox/order-utils";

type SessionDetailsDialogProps = {
  session: StoreOrderConversionSession | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBack?: () => void;
};

function visitSourceLabel(session: StoreOrderConversionSession) {
  if (session.visitLabel) return session.visitLabel;
  if (session.sourceDescription) return session.sourceDescription;
  if (session.referrerUrl) return `Referred from ${session.referrerUrl}`;
  return "Store visit was direct";
}

function hasUtmParams(session: StoreOrderConversionSession) {
  const utm = session.utmParameters;
  if (!utm) return false;
  return Boolean(utm.campaign || utm.content || utm.medium || utm.source || utm.term);
}

export function SessionDetailsDialog({
  session,
  open,
  onOpenChange,
  onBack,
}: SessionDetailsDialogProps) {
  if (!session) return null;

  const landingPath = formatLandingPath(session.landingPage);
  const utm = session.utmParameters;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,560px)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border/60 px-5 py-4">
          <div className="flex items-center gap-2 pr-8">
            {onBack ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                onClick={onBack}
              >
                <ArrowLeft className="size-4" />
              </Button>
            ) : null}
            <DialogTitle className="text-lg font-semibold">Session details</DialogTitle>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <ul className="space-y-4">
            <li className="flex items-start gap-3 text-sm text-foreground">
              <MessageCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span>{visitSourceLabel(session)}</span>
            </li>
            {landingPath ? (
              <li className="flex items-start gap-3 text-sm text-foreground">
                <MousePointerClick className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span>
                  The first page they visited was{" "}
                  <span className="font-medium text-primary">{landingPath}</span>
                </span>
              </li>
            ) : null}
            {session.occurredAt ? (
              <li className="flex items-start gap-3 text-sm text-foreground">
                <Calendar className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span>Visited on {formatSessionTimestamp(session.occurredAt)}</span>
              </li>
            ) : null}
          </ul>

          <div>
            <h4 className="mb-2 text-sm font-semibold text-foreground">UTM Parameters</h4>
            {hasUtmParams(session) ? (
              <dl className="space-y-2 text-sm">
                {utm?.source ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Source</dt>
                    <dd className="text-right text-foreground">{utm.source}</dd>
                  </div>
                ) : null}
                {utm?.medium ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Medium</dt>
                    <dd className="text-right text-foreground">{utm.medium}</dd>
                  </div>
                ) : null}
                {utm?.campaign ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Campaign</dt>
                    <dd className="text-right text-foreground">{utm.campaign}</dd>
                  </div>
                ) : null}
                {utm?.term ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Term</dt>
                    <dd className="text-right text-foreground">{utm.term}</dd>
                  </div>
                ) : null}
                {utm?.content ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Content</dt>
                    <dd className="text-right text-foreground">{utm.content}</dd>
                  </div>
                ) : null}
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">
                No UTM parameters were available for this session.
              </p>
            )}
          </div>
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
