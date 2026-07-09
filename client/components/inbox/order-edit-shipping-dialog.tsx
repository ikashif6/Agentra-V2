"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { storeApi } from "@/lib/api";
import { getApiError } from "@/lib/api-error";
import type { StoreOrder, StoreOrderAddress } from "@/lib/types";
import { formatAddress, orderIsFulfilled } from "@/components/inbox/order-utils";

type OrderEditShippingDialogProps = {
  order: StoreOrder;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (order: StoreOrder) => void;
};

function splitName(name?: string) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: "", lastName: "" };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function joinName(firstName: string, lastName: string) {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
}

function addressFromOrder(address?: StoreOrderAddress) {
  const { firstName, lastName } = splitName(address?.name);
  return {
    firstName,
    lastName,
    company: "",
    address1: address?.address1 ?? "",
    address2: address?.address2 ?? "",
    city: address?.city ?? "",
    zip: address?.zip ?? "",
    country: address?.country ?? "",
    phone: address?.phone ?? "",
  };
}

export function OrderEditShippingDialog({
  order,
  open,
  onOpenChange,
  onUpdated,
}: OrderEditShippingDialogProps) {
  const shipped = orderIsFulfilled(order);
  const original = useMemo(() => addressFromOrder(order.shippingAddress), [order.shippingAddress]);
  const [form, setForm] = useState(original);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(addressFromOrder(order.shippingAddress));
  }, [open, order.shippingAddress]);

  const changes = useMemo(() => {
    const lines: string[] = [];
    if (form.firstName !== original.firstName) lines.push("First name updated");
    if (form.lastName !== original.lastName) lines.push("Last name updated");
    if (form.address1 !== original.address1) lines.push("Address updated");
    if (form.address2 !== original.address2) lines.push("Apartment updated");
    if (form.city !== original.city) lines.push("City updated");
    if (form.zip !== original.zip) lines.push("Postal code updated");
    if (form.country !== original.country) lines.push("Country updated");
    if (form.phone !== original.phone) lines.push("Phone updated");
    return lines;
  }, [form, original]);

  const handleSave = async () => {
    setBusy(true);
    try {
      const { data } = await storeApi.updateOrder(order._id, {
        shippingAddress: {
          name: joinName(form.firstName, form.lastName),
          address1: form.address1.trim() || undefined,
          address2: form.address2.trim() || undefined,
          city: form.city.trim() || undefined,
          zip: form.zip.trim() || undefined,
          country: form.country.trim() || undefined,
          phone: form.phone.trim() || undefined,
        },
      });
      if (data.data?.order) onUpdated(data.data.order);
      toast.success("Shipping address updated");
      onOpenChange(false);
    } catch (err: unknown) {
      const { message } = getApiError(err, "Could not update shipping address");
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92vh,760px)] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="flex flex-row items-center justify-between border-b border-border/60 px-5 py-4">
          <DialogTitle className="text-base font-semibold">
            Edit shipping address for order {order.orderNumber || order.name}
          </DialogTitle>
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-5 lg:grid-cols-[1fr_280px]">
          <section className="rounded-lg border border-border/60 p-4">
            <h3 className="mb-4 text-sm font-semibold text-foreground">Current</h3>
            {shipped ? (
              <p className="mb-4 text-xs text-muted-foreground">
                Shipping address cannot be changed after the order has shipped.
              </p>
            ) : null}

            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Country/region</Label>
                <Input
                  value={form.country}
                  onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                  disabled={shipped}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>First name</Label>
                  <Input
                    value={form.firstName}
                    onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                    disabled={shipped}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Last name</Label>
                  <Input
                    value={form.lastName}
                    onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                    disabled={shipped}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Company</Label>
                <Input
                  value={form.company}
                  onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                  disabled={shipped}
                />
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input
                  value={form.address1}
                  onChange={(e) => setForm((f) => ({ ...f, address1: e.target.value }))}
                  disabled={shipped}
                />
              </div>
              <div className="space-y-2">
                <Label>Apartment, suite, etc.</Label>
                <Input
                  value={form.address2}
                  onChange={(e) => setForm((f) => ({ ...f, address2: e.target.value }))}
                  disabled={shipped}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input
                    value={form.city}
                    onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                    disabled={shipped}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Postal code</Label>
                  <Input
                    value={form.zip}
                    onChange={(e) => setForm((f) => ({ ...f, zip: e.target.value }))}
                    disabled={shipped}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  disabled={shipped}
                />
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-border/60 p-4">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Summary</h3>
            {changes.length > 0 ? (
              <ul className="space-y-2 text-sm text-foreground">
                {changes.map((change) => (
                  <li key={change}>{change}</li>
                ))}
              </ul>
            ) : (
              <p className="rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                No changes have been made
              </p>
            )}
            {order.shippingAddress ? (
              <div className="mt-4 border-t border-border/60 pt-4">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Original address</p>
                <p className="whitespace-pre-line text-xs text-muted-foreground">
                  {formatAddress(order.shippingAddress)}
                </p>
              </div>
            ) : null}
          </section>
        </div>

        <div className="flex justify-end gap-2 border-t border-border/60 px-5 py-3">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={busy || shipped || changes.length === 0}
            onClick={() => void handleSave()}
          >
            {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
