"use client";

import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  Package,
  Plus,
  Tag,
  Truck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { storeApi } from "@/lib/api";
import { getApiError } from "@/lib/api-error";
import type { StoreOrder, Ticket, TicketDetails } from "@/lib/types";
import { InboxMetadataPicker } from "@/components/inbox/inbox-metadata-picker";
import {
  CONTACT_REASON_OPTIONS,
  CUSTOMER_TYPE_OPTIONS,
  PRODUCT_OPTIONS,
  RESOLUTION_OPTIONS,
} from "@/lib/ticket-metadata-options";

function formatMoney(amount?: number, currency?: string) {
  if (amount == null) return "";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
    }).format(amount);
  } catch {
    return `${amount} ${currency ?? ""}`.trim();
  }
}

function financialTone(status?: string) {
  const s = (status || "").toLowerCase();
  if (s === "paid") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (s === "refunded" || s === "cancelled" || s === "failed")
    return "bg-red-50 text-red-700 border-red-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

function orderIsCancelled(order: StoreOrder) {
  const fin = (order.financialStatus || "").toLowerCase();
  const ful = (order.fulfillmentStatus || "").toLowerCase();
  return fin === "cancelled" || fin === "refunded" || ful === "cancelled";
}

function orderIsFulfilled(order: StoreOrder) {
  const ful = (order.fulfillmentStatus || "").toLowerCase();
  return ful === "fulfilled" || ful === "shipped" || ful === "completed";
}

function CustomerOrders({ email, phone }: { email: string; phone: string }) {
  const [orders, setOrders] = useState<StoreOrder[] | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    let active = true;
    const cleanEmail = email.trim();
    const cleanPhone = phone.trim();
    if (!cleanEmail && !cleanPhone) {
      setOrders([]);
      setConnected(false);
      return;
    }
    setLoading(true);
    storeApi
      .listOrders({ email: cleanEmail || undefined, phone: cleanPhone || undefined })
      .then(({ data }) => {
        if (!active) return;
        setConnected(Boolean(data.data.connected));
        setOrders(data.data.orders ?? []);
      })
      .catch(() => {
        if (active) {
          setConnected(false);
          setOrders([]);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [email, phone]);

  const handleOrderUpdated = (updated: StoreOrder) => {
    setOrders((prev) => prev?.map((o) => (o._id === updated._id ? updated : o)) ?? []);
  };

  // Hide entirely when no store is connected.
  if (!connected && !loading) return null;

  return (
    <section className="border-b border-border/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Package className="size-4 text-muted-foreground" />
          Orders
          {orders && orders.length > 0 ? (
            <Badge variant="secondary" className="h-5 min-w-5 justify-center px-1.5 text-[10px]">
              {orders.length}
            </Badge>
          ) : null}
        </span>
        {open ? (
          <ChevronUp className="size-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground" />
        )}
      </button>

      {open ? (
        <div className="space-y-2 px-4 pb-4">
          {loading && !orders ? (
            <p className="text-xs text-muted-foreground">Loading orders…</p>
          ) : orders && orders.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No matching orders for this customer.
            </p>
          ) : (
            orders?.map((order) => (
              <OrderCard key={order._id} order={order} onUpdated={handleOrderUpdated} />
            ))
          )}
        </div>
      ) : null}
    </section>
  );
}

function OrderCard({
  order,
  onUpdated,
}: {
  order: StoreOrder;
  onUpdated: (order: StoreOrder) => void;
}) {
  const [busy, setBusy] = useState<"cancel" | "fulfill" | null>(null);
  const [showFulfillForm, setShowFulfillForm] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingCompany, setTrackingCompany] = useState("");

  const cancelled = orderIsCancelled(order);
  const fulfilled = orderIsFulfilled(order);
  const tracking = order.fulfillments?.find((f) => f.trackingUrl || f.trackingNumber);

  const handleCancel = async () => {
    if (!confirm(`Cancel order ${order.orderNumber || order.name}? The customer can be notified.`)) {
      return;
    }
    setBusy("cancel");
    try {
      const { data } = await storeApi.cancelOrder(order._id, {
        reason: "customer",
        restock: true,
        notifyCustomer: true,
      });
      if (data.data?.order) onUpdated(data.data.order);
      toast.success("Order cancelled");
    } catch (err: unknown) {
      const { message } = getApiError(err, "Could not cancel order");
      toast.error(message);
    } finally {
      setBusy(null);
    }
  };

  const handleFulfill = async () => {
    setBusy("fulfill");
    try {
      const { data } = await storeApi.fulfillOrder(order._id, {
        trackingNumber: trackingNumber.trim() || undefined,
        trackingCompany: trackingCompany.trim() || undefined,
        notifyCustomer: true,
      });
      if (data.data?.order) onUpdated(data.data.order);
      toast.success("Order marked as fulfilled");
      setShowFulfillForm(false);
      setTrackingNumber("");
      setTrackingCompany("");
    } catch (err: unknown) {
      const { message } = getApiError(err, "Could not fulfill order");
      toast.error(message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-lg border border-border/60 bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-foreground">
          {order.orderNumber || order.name || `#${order.externalId}`}
        </span>
        <span className="text-sm font-medium text-foreground">
          {formatMoney(order.totalPrice, order.currency)}
        </span>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {order.financialStatus ? (
          <span
            className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium capitalize ${financialTone(
              order.financialStatus,
            )}`}
          >
            {order.financialStatus}
          </span>
        ) : null}
        {order.fulfillmentStatus ? (
          <span className="rounded-full border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium capitalize text-muted-foreground">
            {order.fulfillmentStatus}
          </span>
        ) : null}
        {order.placedAt ? (
          <span className="text-[10px] text-muted-foreground">
            {new Date(order.placedAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
          </span>
        ) : null}
      </div>

      {order.lineItems && order.lineItems.length > 0 ? (
        <ul className="mt-2.5 space-y-1.5 border-t border-border/50 pt-2.5">
          {order.lineItems.map((item, i) => (
            <li key={`${item.title}-${i}`} className="flex items-start justify-between gap-2 text-xs">
              <span className="min-w-0 text-foreground">
                <span className="font-medium">{item.quantity ?? 1}×</span> {item.title}
                {item.variantTitle ? (
                  <span className="text-muted-foreground"> · {item.variantTitle}</span>
                ) : null}
              </span>
              {item.price != null ? (
                <span className="shrink-0 text-muted-foreground">
                  {formatMoney((item.price ?? 0) * (item.quantity ?? 1), order.currency)}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {tracking ? (
        <div className="mt-2.5 rounded-md bg-muted/40 px-2.5 py-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1 font-medium text-foreground">
            <Truck className="size-3" />
            Shipment
          </span>
          {tracking.trackingCompany ? <p className="mt-0.5">{tracking.trackingCompany}</p> : null}
          {tracking.trackingNumber ? <p>{tracking.trackingNumber}</p> : null}
          {tracking.trackingUrl ? (
            <a
              href={tracking.trackingUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-0.5 inline-block font-medium text-primary hover:underline"
            >
              Track package
            </a>
          ) : null}
        </div>
      ) : null}

      {!cancelled && !fulfilled ? (
        <div className="mt-3 space-y-2 border-t border-border/50 pt-2.5">
          {showFulfillForm ? (
            <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-2.5">
              <p className="text-[11px] font-medium text-foreground">Fulfillment details (optional)</p>
              <Input
                value={trackingCompany}
                onChange={(e) => setTrackingCompany(e.target.value)}
                placeholder="Carrier (e.g. UPS)"
                className="h-8 text-xs"
              />
              <Input
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="Tracking number"
                className="h-8 text-xs"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="h-7 flex-1 text-xs"
                  disabled={busy === "fulfill"}
                  onClick={() => void handleFulfill()}
                >
                  {busy === "fulfill" ? <Loader2 className="mr-1 size-3 animate-spin" /> : null}
                  Confirm fulfill
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => setShowFulfillForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                disabled={busy !== null}
                onClick={() => setShowFulfillForm(true)}
              >
                Mark fulfilled
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs text-destructive hover:text-destructive"
                disabled={busy !== null}
                onClick={() => void handleCancel()}
              >
                {busy === "cancel" ? <Loader2 className="mr-1 size-3 animate-spin" /> : null}
                Cancel order
              </Button>
            </div>
          )}
        </div>
      ) : null}

      {order.adminUrl ? (
        <a
          href={order.adminUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground hover:underline"
        >
          <ExternalLink className="size-2.5" />
          Open in Shopify admin
        </a>
      ) : null}
    </div>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function customerFromTicket(ticket: Ticket) {
  const customer = ticket.peoples?.find((person) => person.role === "customer")?.user;
  if (customer && typeof customer === "object") {
    return customer;
  }
  if (ticket.createdBy && typeof ticket.createdBy === "object") {
    return ticket.createdBy;
  }
  return null;
}

type InboxTicketDetailsPanelProps = {
  ticket: Ticket;
  ticketCount?: number;
  onUpdateDetails: (patch: Partial<TicketDetails>) => void;
  onUpdateTags: (tags: string[]) => void;
};

export function InboxTicketDetailsPanel({
  ticket,
  ticketCount = 1,
  onUpdateDetails,
  onUpdateTags,
}: InboxTicketDetailsPanelProps) {
  const [ticketOpen, setTicketOpen] = useState(true);
  const [customerOpen, setCustomerOpen] = useState(true);
  const [tagDraft, setTagDraft] = useState("");
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState(ticket.details?.customerNote ?? "");
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneDraft, setPhoneDraft] = useState(ticket.details?.customerPhone ?? "");
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailDraft, setEmailDraft] = useState(ticket.details?.customerEmail ?? "");

  const customer = customerFromTicket(ticket);
  const customerName = customer
    ? customer.fullName || `${customer.firstName} ${customer.lastName}`
    : "Customer";
  const tags = ticket.tags ?? [];
  const details = ticket.details ?? {};

  const addTag = () => {
    const next = tagDraft.trim();
    if (!next || tags.includes(next)) {
      setTagDraft("");
      return;
    }
    onUpdateTags([...tags, next]);
    setTagDraft("");
  };

  const removeTag = (tag: string) => {
    onUpdateTags(tags.filter((item) => item !== tag));
  };

  const saveNote = () => {
    onUpdateDetails({ customerNote: noteDraft.trim() });
    setEditingNote(false);
  };

  const savePhone = () => {
    onUpdateDetails({ customerPhone: phoneDraft.trim() });
    setEditingPhone(false);
  };

  const saveEmail = () => {
    onUpdateDetails({ customerEmail: emailDraft.trim() });
    setEditingEmail(false);
  };

  const rawEmail = customer?.email ?? "";
  // Facebook/Messenger customers get a synthetic placeholder address.
  const isPlaceholderEmail =
    /@messenger\.agentra\.local$/i.test(rawEmail) || /@.*agentra\.local$/i.test(rawEmail);
  const savedEmail = details.customerEmail ?? "";

  return (
    <aside className="hidden w-[280px] shrink-0 flex-col border-l border-border/70 bg-muted/10 xl:flex">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Ticket details */}
        <section className="border-b border-border/60">
          <button
            type="button"
            onClick={() => setTicketOpen((value) => !value)}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Tag className="size-4 text-muted-foreground" />
              Ticket details
            </span>
            {ticketOpen ? (
              <ChevronUp className="size-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="size-4 text-muted-foreground" />
            )}
          </button>

          {ticketOpen ? (
            <div className="space-y-1 px-4 pb-4">
              <div className="flex flex-wrap items-center gap-1.5 pb-2">
                <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="rounded-sm p-0.5 hover:bg-muted"
                        aria-label={`Remove ${tag}`}
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  <Input
                    value={tagDraft}
                    onChange={(e) => setTagDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                    placeholder="Tag"
                    className="h-7 w-20 text-xs"
                  />
                  <Button type="button" variant="outline" size="icon" className="size-7" onClick={addTag}>
                    <Plus className="size-3.5" />
                  </Button>
                </div>
              </div>

              <InboxMetadataPicker
                label="Contact reason"
                value={details.contactReason}
                options={CONTACT_REASON_OPTIONS}
                onSelect={(value) => onUpdateDetails({ contactReason: value })}
                onClear={() => onUpdateDetails({ contactReason: "" })}
              />
              <InboxMetadataPicker
                label="Product"
                value={details.product}
                options={PRODUCT_OPTIONS}
                onSelect={(value) => onUpdateDetails({ product: value })}
                onClear={() => onUpdateDetails({ product: "" })}
              />
              <InboxMetadataPicker
                label="Resolution"
                value={details.resolution}
                options={RESOLUTION_OPTIONS}
                onSelect={(value) => onUpdateDetails({ resolution: value })}
                onClear={() => onUpdateDetails({ resolution: "" })}
              />
            </div>
          ) : null}
        </section>

        {/* Customer */}
        <section className="border-b border-border/60">
          <button
            type="button"
            onClick={() => setCustomerOpen((value) => !value)}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <span className="flex min-w-0 items-center gap-2">
              <Avatar className="size-7">
                <AvatarFallback className="bg-primary/10 text-[10px] text-primary">
                  {initials(customerName)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate text-sm font-semibold text-foreground">{customerName}</span>
            </span>
            {customerOpen ? (
              <ChevronUp className="size-4 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
            )}
          </button>

          {customerOpen ? (
            <div className="space-y-1 px-4 pb-4">
              <InboxMetadataPicker
                label="Customer type"
                value={details.customerType}
                options={CUSTOMER_TYPE_OPTIONS}
                onSelect={(value) => onUpdateDetails({ customerType: value })}
                onClear={() => onUpdateDetails({ customerType: "" })}
              />

              <div className="py-2">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Note</span>
                  {!editingNote ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-muted-foreground"
                      onClick={() => {
                        setNoteDraft(details.customerNote ?? "");
                        setEditingNote(true);
                      }}
                    >
                      {details.customerNote ? "Edit" : "+ Add"}
                    </Button>
                  ) : null}
                </div>
                {editingNote ? (
                  <div className="space-y-2">
                    <Textarea
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      className="min-h-[72px] text-xs"
                      placeholder="Internal note about this customer…"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7"
                        onClick={() => setEditingNote(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="button" size="sm" className="h-7" onClick={saveNote}>
                        Save
                      </Button>
                    </div>
                  </div>
                ) : details.customerNote ? (
                  <p className="rounded-md bg-muted/40 px-2 py-1.5 text-xs text-foreground">
                    {details.customerNote}
                  </p>
                ) : null}
              </div>

              <div className="py-2">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Email</span>
                  {!editingEmail ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-muted-foreground"
                      onClick={() => {
                        setEmailDraft(savedEmail);
                        setEditingEmail(true);
                      }}
                    >
                      {savedEmail ? "Edit" : "+ Add"}
                    </Button>
                  ) : null}
                </div>
                {editingEmail ? (
                  <div className="space-y-2">
                    <Input
                      value={emailDraft}
                      onChange={(e) => setEmailDraft(e.target.value)}
                      placeholder="name@example.com"
                      className="h-8 text-xs"
                      type="email"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && emailDraft.trim()) {
                          e.preventDefault();
                          saveEmail();
                        }
                      }}
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7"
                        onClick={() => setEditingEmail(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="h-7"
                        onClick={saveEmail}
                        disabled={!emailDraft.trim()}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {savedEmail ? (
                      <button
                        type="button"
                        onClick={() => {
                          setEmailDraft(savedEmail);
                          setEditingEmail(true);
                        }}
                        className="w-full truncate rounded-md bg-muted/40 px-2 py-1.5 text-left text-xs text-foreground hover:bg-muted/60"
                        title={savedEmail}
                      >
                        {savedEmail}
                      </button>
                    ) : !isPlaceholderEmail && rawEmail ? (
                      <p className="truncate text-xs text-foreground" title={rawEmail}>
                        {rawEmail}
                      </p>
                    ) : null}
                    {isPlaceholderEmail && rawEmail ? (
                      <p
                        className="truncate text-[11px] text-muted-foreground"
                        title={rawEmail}
                      >
                        Messenger ID: {rawEmail}
                      </p>
                    ) : null}
                  </div>
                )}
              </div>

              <div className="py-2">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Phone</span>
                  {!editingPhone && details.customerPhone ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-muted-foreground"
                      onClick={() => {
                        setPhoneDraft(details.customerPhone ?? "");
                        setEditingPhone(true);
                      }}
                    >
                      Edit
                    </Button>
                  ) : !editingPhone ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-muted-foreground"
                      onClick={() => {
                        setPhoneDraft("");
                        setEditingPhone(true);
                      }}
                    >
                      + Add
                    </Button>
                  ) : null}
                </div>
                {editingPhone ? (
                  <div className="space-y-2">
                    <Input
                      value={phoneDraft}
                      onChange={(e) => setPhoneDraft(e.target.value)}
                      placeholder="+1 555 0100"
                      className="h-8 text-xs"
                      type="tel"
                      autoFocus
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7"
                        onClick={() => setEditingPhone(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="h-7"
                        onClick={savePhone}
                        disabled={!phoneDraft.trim()}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                ) : details.customerPhone ? (
                  <button
                    type="button"
                    onClick={() => {
                      setPhoneDraft(details.customerPhone ?? "");
                      setEditingPhone(true);
                    }}
                    className="w-full truncate rounded-md bg-muted/40 px-2 py-1.5 text-left text-xs text-foreground hover:bg-muted/60"
                  >
                    {details.customerPhone}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>

        {/* Store orders */}
        <CustomerOrders
          email={savedEmail || (!isPlaceholderEmail ? rawEmail : "")}
          phone={details.customerPhone ?? ""}
        />

        {/* Ticket history */}
        <section className="px-4 py-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">Tickets</span>
            <Badge variant="secondary" className="h-5 min-w-5 justify-center px-1.5 text-[10px]">
              {ticketCount}
            </Badge>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {ticketCount <= 1
              ? `This is ${customerName}'s first ticket`
              : `${customerName} has ${ticketCount} tickets`}
          </p>
        </section>
      </div>
    </aside>
  );
}
