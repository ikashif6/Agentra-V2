"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { StoreOrder } from "@/lib/types";
import { formatMoney } from "@/components/inbox/order-utils";

type OrderRefundDialogProps = {
  order: StoreOrder;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy?: boolean;
  onConfirm: () => void;
};

export function OrderRefundDialog({
  order,
  open,
  onOpenChange,
  busy = false,
  onConfirm,
}: OrderRefundDialogProps) {
  const label = order.orderNumber || order.name || `#${order.externalId}`;
  const amount = formatMoney(order.totalPrice, order.currency);

  const storeLabel =
    order.provider === "woocommerce"
      ? "WooCommerce"
      : order.provider === "custom"
        ? "your store"
        : "Shopify";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="px-5 py-4">
          <DialogTitle>Refund order</DialogTitle>
          <DialogDescription>
            Refund {amount || "the full payment"} for {label}? This will create a refund in{" "}
            {storeLabel} and return the payment to the customer.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" disabled={busy} onClick={onConfirm}>
            {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Refund order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
