"use client";

import { useState } from "react";
import { Loader2, MapPin, Package } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { storeApi } from "@/lib/api";
import { getApiError } from "@/lib/api-error";
import type { StoreOrder } from "@/lib/types";
import { formatAddress, formatFulfillmentLabel } from "@/components/inbox/order-utils";

type RequestFulfillmentDialogProps = {
  order: StoreOrder;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (order: StoreOrder) => void;
  onEditAddress?: () => void;
};

export function RequestFulfillmentDialog({
  order,
  open,
  onOpenChange,
  onUpdated,
  onEditAddress,
}: RequestFulfillmentDialogProps) {
  const [notes, setNotes] = useState("");
  const [notifyCustomer, setNotifyCustomer] = useState(true);
  const [busy, setBusy] = useState(false);
  const items = order.lineItems ?? [];
  const service = order.fulfillmentService || "fulfillment service";

  const handleSubmit = async () => {
    setBusy(true);
    try {
      const { data } = await storeApi.runOrderAction(order._id, {
        action: "request_fulfillment",
        message: notes.trim() || undefined,
        notifyCustomer,
      });
      if (data.data?.order) onUpdated(data.data.order);
      toast.success("Fulfillment request sent");
      onOpenChange(false);
      setNotes("");
    } catch (err: unknown) {
      const { message } = getApiError(err, "Could not request fulfillment");
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,760px)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b border-border/60 px-5 py-4">
          <p className="text-xs text-muted-foreground">
            {order.orderNumber || order.name} › Request fulfillment
          </p>
          <DialogTitle className="text-lg font-semibold">Request fulfillment</DialogTitle>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-5 lg:grid-cols-[1fr_280px]">
          <div className="space-y-4">
            <section className="rounded-lg border border-border/60">
              <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                    {formatFulfillmentLabel(order.fulfillmentStatus)}
                  </span>
                  <span className="text-sm font-semibold">{order.orderNumber || order.name}</span>
                </div>
                <span className="text-xs text-muted-foreground">{service}</span>
              </div>

              {order.customer?.name ? (
                <p className="border-b border-border/60 px-4 py-2 text-sm font-medium">
                  {order.customer.name}
                </p>
              ) : null}

              <ul className="divide-y divide-border/50">
                {items.map((item, index) => (
                  <li key={`${item.title}-${index}`} className="flex gap-3 px-4 py-3">
                    <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/60 bg-muted/30">
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.imageUrl} alt="" className="size-full object-cover" />
                      ) : (
                        <Package className="size-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{item.title}</p>
                      {item.variantTitle ? (
                        <p className="text-xs text-muted-foreground">{item.variantTitle}</p>
                      ) : null}
                      {item.sku ? (
                        <p className="text-[11px] text-muted-foreground">SKU: {item.sku}</p>
                      ) : null}
                      {item.grams ? (
                        <p className="text-[11px] text-muted-foreground">
                          {(item.grams / 1000).toFixed(3)} kg
                        </p>
                      ) : null}
                    </div>
                    <div className="shrink-0">
                      <Input
                        type="number"
                        min={1}
                        max={item.fulfillableQuantity ?? item.quantity ?? 1}
                        value={item.fulfillableQuantity ?? item.quantity ?? 1}
                        readOnly
                        className="h-8 w-16 text-center text-xs"
                      />
                      <p className="mt-1 text-center text-[10px] text-muted-foreground">
                        of {item.fulfillableQuantity ?? item.quantity ?? 1}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <div className="space-y-2">
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={`Add notes to send to ${service}`}
                className="min-h-[88px] text-sm"
              />
            </div>
          </div>

          <aside className="space-y-4">
            <section className="rounded-lg border border-border/60 p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <MapPin className="size-4 text-muted-foreground" />
                  Shipping address
                </div>
                {onEditAddress ? (
                  <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onEditAddress}>
                    Edit
                  </Button>
                ) : null}
              </div>
              <p className="whitespace-pre-line text-sm text-muted-foreground">
                {formatAddress(order.shippingAddress) || "No shipping address"}
              </p>
              {order.shippingMethod ? (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Customer selected {order.shippingMethod} at checkout
                </p>
              ) : null}
            </section>

            <section className="rounded-lg border border-border/60 p-4">
              <p className="text-sm text-muted-foreground">
                Fulfilling from <span className="font-medium text-foreground">{service}</span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {items.length} of {items.length} item{items.length === 1 ? "" : "s"}
              </p>
              <label className="mt-3 flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={notifyCustomer}
                  onChange={(e) => setNotifyCustomer(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  Send a notification to the customer when {service} fulfills the order
                </span>
              </label>
              <Button
                type="button"
                className="mt-4 w-full"
                disabled={busy}
                onClick={() => void handleSubmit()}
              >
                {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Send fulfillment request
              </Button>
            </section>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}
