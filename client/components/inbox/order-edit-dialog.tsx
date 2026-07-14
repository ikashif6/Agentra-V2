"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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
import type { StoreOrder, StoreOrderAddress } from "@/lib/types";
import { orderIsFulfilled } from "@/components/inbox/order-utils";

type OrderEditDialogProps = {
  order: StoreOrder;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (order: StoreOrder) => void;
};

export function OrderEditDialog({
  order,
  open,
  onOpenChange,
  onUpdated,
}: OrderEditDialogProps) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(order.note ?? "");
  const [tags, setTags] = useState((order.tags ?? []).join(", "));
  const [address, setAddress] = useState<StoreOrderAddress>(order.shippingAddress ?? {});
  const shipped = orderIsFulfilled(order);
  const isShopify = order.provider === "shopify";

  useEffect(() => {
    if (!open) return;
    setNote(order.note ?? "");
    setTags((order.tags ?? []).join(", "));
    setAddress(order.shippingAddress ?? {});
  }, [open, order]);

  const handleSave = async () => {
    setBusy(true);
    try {
      const { data } = await storeApi.updateOrder(order._id, {
        note: note.trim(),
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        shippingAddress: shipped
          ? undefined
          : {
              name: address.name,
              address1: address.address1,
              address2: address.address2,
              city: address.city,
              province: address.province,
              zip: address.zip,
              country: address.country,
              phone: address.phone,
            },
      });
      if (data.data?.order) onUpdated(data.data.order);
      toast.success("Order updated");
      onOpenChange(false);
    } catch (err: unknown) {
      const { message } = getApiError(err, "Could not update order");
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,720px)] max-w-lg overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit order {order.orderNumber || order.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            {isShopify
              ? "Product quantities can only be changed in Shopify before fulfillment. Shipped orders cannot have their address updated."
              : `Updates are sent to your ${order.provider === "woocommerce" ? "WooCommerce" : "store"} order in real time. Shipped orders cannot have their address updated.`}
          </p>

          <div className="space-y-2">
            <label className="text-sm font-medium">Note</label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} className="min-h-[72px]" />
          </div>

          {isShopify ? (
            <div className="space-y-2">
              <label className="text-sm font-medium">Tags</label>
              <Input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="vip, wholesale"
              />
            </div>
          ) : null}

          <div className="space-y-3 rounded-lg border border-border/60 p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Shipping address</p>
              {shipped ? (
                <span className="text-[11px] text-muted-foreground">Locked — order shipped</span>
              ) : null}
            </div>
            <Input
              value={address.name ?? ""}
              onChange={(e) => setAddress((a) => ({ ...a, name: e.target.value }))}
              placeholder="Full name"
              disabled={shipped}
            />
            <Input
              value={address.address1 ?? ""}
              onChange={(e) => setAddress((a) => ({ ...a, address1: e.target.value }))}
              placeholder="Address line 1"
              disabled={shipped}
            />
            <Input
              value={address.address2 ?? ""}
              onChange={(e) => setAddress((a) => ({ ...a, address2: e.target.value }))}
              placeholder="Address line 2"
              disabled={shipped}
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={address.city ?? ""}
                onChange={(e) => setAddress((a) => ({ ...a, city: e.target.value }))}
                placeholder="City"
                disabled={shipped}
              />
              <Input
                value={address.province ?? ""}
                onChange={(e) => setAddress((a) => ({ ...a, province: e.target.value }))}
                placeholder="State / Province"
                disabled={shipped}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={address.zip ?? ""}
                onChange={(e) => setAddress((a) => ({ ...a, zip: e.target.value }))}
                placeholder="ZIP / Postal code"
                disabled={shipped}
              />
              <Input
                value={address.country ?? ""}
                onChange={(e) => setAddress((a) => ({ ...a, country: e.target.value }))}
                placeholder="Country"
                disabled={shipped}
              />
            </div>
            <Input
              value={address.phone ?? ""}
              onChange={(e) => setAddress((a) => ({ ...a, phone: e.target.value }))}
              placeholder="Phone"
              disabled={shipped}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={busy} onClick={() => void handleSave()}>
              {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Save changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
