"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { storeApi } from "@/lib/api";
import { getApiError } from "@/lib/api-error";
import type { StoreOrder } from "@/lib/types";

type OrderEditContactDialogProps = {
  order: StoreOrder;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (order: StoreOrder) => void;
};

export function OrderEditContactDialog({
  order,
  open,
  onOpenChange,
  onUpdated,
}: OrderEditContactDialogProps) {
  const [email, setEmail] = useState(order.customer?.email ?? "");
  const [updateProfile, setUpdateProfile] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEmail(order.customer?.email ?? "");
    setUpdateProfile(Boolean(order.customer?.externalId));
  }, [open, order]);

  const handleSave = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      toast.error("Email is required");
      return;
    }
    setBusy(true);
    try {
      const { data } = await storeApi.updateOrder(order._id, {
        email: trimmed,
        updateCustomerProfile: updateProfile,
      });
      if (data.data?.order) onUpdated(data.data.order);
      toast.success("Contact information updated");
      onOpenChange(false);
    } catch (err: unknown) {
      const { message } = getApiError(err, "Could not update contact information");
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit contact information</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label htmlFor="order-contact-email">Email</Label>
            <Input
              id="order-contact-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="customer@example.com"
            />
          </div>

          {order.customer?.externalId ? (
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={updateProfile}
                onChange={(e) => setUpdateProfile(e.target.checked)}
                className="size-4 rounded border border-border"
              />
              Update customer profile
            </label>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={busy || !email.trim()} onClick={() => void handleSave()}>
            {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
