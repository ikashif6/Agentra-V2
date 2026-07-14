"use client";

import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Package,
  Plus,
  Tag,
  X,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { storeApi } from "@/lib/api";
import type { StoreOrder, Ticket, TicketDetails } from "@/lib/types";
import { OrderDetailsDialog } from "@/components/inbox/order-details-dialog";
import {
  financialTone,
  formatFinancialLabel,
  formatFulfillmentLabel,
  formatMoney,
  formatOrderListDate,
  fulfillmentTone,
  orderItemCount,
} from "@/components/inbox/order-utils";
import { InboxMetadataPicker } from "@/components/inbox/inbox-metadata-picker";
import { AiOverviewPanel } from "@/components/inbox/ai-overview-panel";
import {
  CONTACT_REASON_OPTIONS,
  CUSTOMER_TYPE_OPTIONS,
  PRODUCT_OPTIONS,
  RESOLUTION_OPTIONS,
} from "@/lib/ticket-metadata-options";
import type { TicketAiIntelligence } from "@/lib/types";

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
  const [detailsOpen, setDetailsOpen] = useState(false);
  const firstItem = order.lineItems?.[0];
  const itemCount = orderItemCount(order);

  return (
    <>
      <div className="rounded-lg border border-border/60 bg-card p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {order.orderNumber || order.name || `#${order.externalId}`}
            </p>
            {order.placedAt ? (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {formatOrderListDate(order.placedAt)}
                {order.channel ? ` · ${order.channel}` : ""}
              </p>
            ) : null}
          </div>
          <span className="shrink-0 text-sm font-semibold text-foreground">
            {formatMoney(order.totalPrice, order.currency)}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {order.financialStatus ? (
            <span
              className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${financialTone(
                order.financialStatus,
              )}`}
            >
              {formatFinancialLabel(order.financialStatus)}
            </span>
          ) : null}
          {order.fulfillmentStatus ? (
            <span
              className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${fulfillmentTone(
                order.fulfillmentStatus,
              )}`}
            >
              {formatFulfillmentLabel(order.fulfillmentStatus)}
            </span>
          ) : null}
          {itemCount > 0 ? (
            <span className="text-[10px] text-muted-foreground">
              {itemCount} item{itemCount === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>

        {firstItem ? (
          <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{firstItem.quantity ?? 1}×</span>{" "}
            {firstItem.title}
            {firstItem.variantTitle ? ` · ${firstItem.variantTitle}` : ""}
          </p>
        ) : null}

        {order.customer?.name ? (
          <p className="mt-1.5 text-[11px] text-muted-foreground">{order.customer.name}</p>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 flex-1 text-xs"
            onClick={() => setDetailsOpen(true)}
          >
            View details
          </Button>
          {order.adminUrl ? (
            <a
              href={order.adminUrl}
              target="_blank"
              rel="noreferrer"
              title="Open in admin"
              className={buttonVariants({ variant: "ghost", size: "sm", className: "h-7 px-2" })}
            >
              <ExternalLink className="size-3.5" />
            </a>
          ) : null}
        </div>
      </div>

      <OrderDetailsDialog
        order={order}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        onUpdated={onUpdated}
      />
    </>
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
  onUseSuggestedReply?: (reply: string) => void;
  onIntelligenceUpdated?: (intelligence: TicketAiIntelligence | null, meta?: Partial<Ticket>) => void;
};

export function InboxTicketDetailsPanel({
  ticket,
  ticketCount = 1,
  onUpdateDetails,
  onUpdateTags,
  onUseSuggestedReply,
  onIntelligenceUpdated,
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
        <AiOverviewPanel
          ticket={ticket}
          onUseSuggestedReply={onUseSuggestedReply}
          onIntelligenceUpdated={onIntelligenceUpdated}
        />

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
