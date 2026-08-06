"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { customersApi } from "@/lib/api";
import { getApiError } from "@/lib/api-error";
import { TicketSourceBadge, TicketSourceIcon, TICKET_SOURCE_META } from "@/lib/ticket-source";
import type { Pagination, TicketSource } from "@/lib/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 15;

type CustomerPurchases = {
  orderCount: number;
  totalSpend: number;
  currency: string | null;
  lastOrderAt: string | null;
  lastOrderNumber: string | null;
  products: string[];
};

type CustomerRow = {
  email: string;
  name: string;
  phone: string | null;
  lastContactedAt: string | null;
  channels: TicketSource[];
  ticketCount: number;
  openTicketCount: number;
  recentTickets?: Array<{
    ticketCode: string;
    title: string;
    status: string;
    source: TicketSource;
    at: string | null;
  }>;
  purchases: CustomerPurchases;
  userId: string | null;
};

type CustomerDetail = CustomerRow & {
  orders: Array<{
    orderNumber: string | null;
    totalPrice?: number;
    currency: string;
    placedAt?: string | null;
    financialStatus?: string | null;
    fulfillmentStatus?: string | null;
    products: string[];
    statusUrl?: string | null;
    adminUrl?: string | null;
  }>;
  tickets: Array<{
    ticketCode: string;
    title: string;
    status: string;
    priority?: string;
    source: TicketSource;
    at?: string | null;
  }>;
};

function initials(name: string, email: string) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  if (parts[0]) return parts[0].slice(0, 2).toUpperCase();
  return String(email || "?").slice(0, 2).toUpperCase();
}

function formatRelative(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatMoney(amount: number, currency?: string | null) {
  const code = currency || "USD";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  } catch {
    return `${code} ${(amount || 0).toFixed(2)}`;
  }
}

function channelLabel(source: TicketSource) {
  return TICKET_SOURCE_META[source]?.label ?? source;
}

export default function CustomersSettingsPanel() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await customersApi.list(search, page, PAGE_SIZE);
      setCustomers(data.data.customers ?? []);
      setPagination(data.data.pagination ?? null);
    } catch (err: unknown) {
      const { message } = getApiError(err, "Failed to load customers");
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    void fetchCustomers();
  }, [fetchCustomers]);

  useEffect(() => {
    if (!selectedEmail) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    customersApi
      .get(selectedEmail)
      .then(({ data }) => {
        if (!cancelled) setDetail(data.data.customer ?? null);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const { message } = getApiError(err, "Failed to load customer");
          toast.error(message);
          setSelectedEmail(null);
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedEmail]);

  const pages = pagination?.pages ?? 1;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Customers</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Everyone who has contacted your workspace or placed an order, with channels, tickets, and
            purchases in one place.
          </p>
        </div>

        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, order…"
            className="pl-9"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:border-white/[0.06] dark:shadow-[0_1px_2px_rgba(0,0,0,0.35)] dark:border-white/[0.06] dark:shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
        <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.4fr)] gap-4 border-b border-border/60 bg-muted/20 px-5 py-3">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Customer
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Email
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Last contact
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Channels
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Purchases
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-5 animate-spin text-primary" />
          </div>
        ) : customers.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-muted-foreground">
            {search
              ? "No customers match your search."
              : "No customers yet. They'll appear here when people message you or place store orders."}
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {customers.map((customer) => (
              <button
                key={customer.email}
                type="button"
                onClick={() => setSelectedEmail(customer.email)}
                className="grid w-full grid-cols-[minmax(0,1.6fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.4fr)] items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-muted/30"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className="size-9 shrink-0">
                    <AvatarFallback className="bg-brand-muted text-xs font-bold text-primary">
                      {initials(customer.name, customer.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{customer.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {customer.openTicketCount > 0
                        ? `${customer.openTicketCount} open · ${customer.ticketCount} total`
                        : `${customer.ticketCount} ticket${customer.ticketCount === 1 ? "" : "s"}`}
                    </p>
                  </div>
                </div>

                <p className="truncate text-sm text-muted-foreground">{customer.email}</p>

                <p className="text-sm text-muted-foreground">
                  {formatRelative(customer.lastContactedAt)}
                </p>

                <div className="flex min-w-0 flex-wrap items-center gap-1">
                  {customer.channels.length === 0 ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : (
                    customer.channels.slice(0, 4).map((source) => (
                      <TicketSourceIcon key={source} source={source} />
                    ))
                  )}
                  {customer.channels.length > 4 ? (
                    <span className="text-[10px] text-muted-foreground">
                      +{customer.channels.length - 4}
                    </span>
                  ) : null}
                </div>

                <div className="min-w-0">
                  {customer.purchases.orderCount > 0 ? (
                    <>
                      <p className="truncate text-sm font-medium text-foreground">
                        {formatMoney(customer.purchases.totalSpend, customer.purchases.currency)}
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                          · {customer.purchases.orderCount} order
                          {customer.purchases.orderCount === 1 ? "" : "s"}
                        </span>
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {customer.purchases.products[0] ||
                          customer.purchases.lastOrderNumber ||
                          "Store order"}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No orders</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {pages > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Page {pagination?.page ?? page} of {pages}
            {pagination?.total != null ? ` · ${pagination.total} customers` : null}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= pages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog open={Boolean(selectedEmail)} onOpenChange={(open) => !open && setSelectedEmail(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detail?.name || selectedEmail || "Customer"}</DialogTitle>
            <DialogDescription>
              {detail?.email || selectedEmail}
              {detail?.phone ? ` · ${detail.phone}` : null}
            </DialogDescription>
          </DialogHeader>

          {detailLoading || !detail ? (
            <div className="flex justify-center py-12">
              <Loader2 className="size-5 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Last contact
                  </p>
                  <p className="mt-1 text-sm font-medium">{formatRelative(detail.lastContactedAt)}</p>
                </div>
                <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Tickets
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    {detail.openTicketCount} open · {detail.ticketCount} total
                  </p>
                </div>
                <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Spend
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    {detail.purchases.orderCount > 0
                      ? formatMoney(detail.purchases.totalSpend, detail.purchases.currency)
                      : "—"}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-foreground">Channels</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {detail.channels.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No channel history yet.</p>
                  ) : (
                    detail.channels.map((source) => (
                      <span
                        key={source}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background px-2 py-1 text-xs"
                      >
                        <TicketSourceIcon source={source} />
                        {channelLabel(source)}
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-foreground">Purchases</h3>
                {detail.orders.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">No store orders matched.</p>
                ) : (
                  <ul className="mt-2 divide-y divide-border/50 rounded-lg border border-border/60">
                    {detail.orders.map((order, index) => (
                      <li key={`${order.orderNumber}-${index}`} className="px-3 py-2.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {order.orderNumber || "Order"}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {order.products.slice(0, 3).join(", ") || "—"}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-medium">
                              {formatMoney(Number(order.totalPrice) || 0, order.currency)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatRelative(order.placedAt)}
                            </p>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h3 className="text-sm font-semibold text-foreground">Recent tickets</h3>
                {detail.tickets.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">No tickets yet.</p>
                ) : (
                  <ul className="mt-2 divide-y divide-border/50 rounded-lg border border-border/60">
                    {detail.tickets.map((ticket) => (
                      <li key={ticket.ticketCode} className="px-3 py-2.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <Link
                              href={`/inbox?ticket=${encodeURIComponent(ticket.ticketCode)}`}
                              className="text-sm font-medium text-primary hover:underline"
                            >
                              {ticket.ticketCode}
                            </Link>
                            <p className="truncate text-xs text-muted-foreground">{ticket.title}</p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <TicketSourceBadge source={ticket.source} />
                            <span
                              className={cn(
                                "text-[10px] font-semibold uppercase tracking-wide text-muted-foreground",
                              )}
                            >
                              {ticket.status.replace(/_/g, " ")}
                            </span>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
