"use client";

import { useEffect, useState } from "react";
import {
  ChevronDown,
  Clock,
  ExternalLink,
  Loader2,
  Mail,
  MoreHorizontal,
  Package,
  Pencil,
  Printer,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { storeApi } from "@/lib/api";
import { getApiError } from "@/lib/api-error";
import type { StoreOrder, StoreOrderConversion, StoreOrderConversionSession, StoreOrderTimelineEvent } from "@/lib/types";
import { ConversionDetailsDialog } from "@/components/inbox/conversion-details-dialog";
import { ConversionSummaryCard } from "@/components/inbox/conversion-summary-card";
import { OrderCustomerCard } from "@/components/inbox/order-customer-card";
import { OrderEditContactDialog } from "@/components/inbox/order-edit-contact-dialog";
import { OrderEditDialog } from "@/components/inbox/order-edit-dialog";
import { OrderEditShippingDialog } from "@/components/inbox/order-edit-shipping-dialog";
import { OrderRefundDialog } from "@/components/inbox/order-refund-dialog";
import { printOrderPage, printPackingSlip } from "@/components/inbox/order-print";
import { RequestFulfillmentDialog } from "@/components/inbox/request-fulfillment-dialog";
import { SessionDetailsDialog } from "@/components/inbox/session-details-dialog";
import {
  financialTone,
  formatFinancialLabel,
  formatFulfillmentLabel,
  formatMoney,
  formatOrderDate,
  formatOrderShippingDetail,
  formatOrderTaxDetail,
  fulfillmentTone,
  canPerformOrderAction,
  storeAdminLabel,
  orderAmountPaid,
  orderBalance,
  orderIsCancelled,
  orderIsFulfilled,
  orderItemCount,
  orderShippingAmount,
  orderTaxAmount,
} from "@/components/inbox/order-utils";

type OrderDetailsDialogProps = {
  order: StoreOrder;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (order: StoreOrder) => void;
};

function PaymentLineRow({
  label,
  detail,
  amount,
  strong,
}: {
  label: string;
  detail?: string;
  amount: string;
  strong?: boolean;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,4.5rem)_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-0.5 text-sm">
      <span className={strong ? "font-semibold text-foreground" : "text-muted-foreground"}>
        {label}
      </span>
      {detail ? (
        <span className="text-xs leading-snug text-muted-foreground sm:text-sm">{detail}</span>
      ) : (
        <span />
      )}
      <span
        className={`text-right ${strong ? "font-semibold text-foreground" : "text-foreground"}`}
      >
        {amount}
      </span>
    </div>
  );
}

export function OrderDetailsDialog({
  order: initialOrder,
  open,
  onOpenChange,
  onUpdated,
}: OrderDetailsDialogProps) {
  const [order, setOrder] = useState(initialOrder);
  const [timeline, setTimeline] = useState<StoreOrderTimelineEvent[]>([]);
  const [conversion, setConversion] = useState<StoreOrderConversion | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [showFulfillForm, setShowFulfillForm] = useState(false);
  const [requestFulfillmentOpen, setRequestFulfillmentOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [contactEditOpen, setContactEditOpen] = useState(false);
  const [shippingEditOpen, setShippingEditOpen] = useState(false);
  const [conversionDetailsOpen, setConversionDetailsOpen] = useState(false);
  const [refundConfirmOpen, setRefundConfirmOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<StoreOrderConversionSession | null>(null);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingCompany, setTrackingCompany] = useState("");

  useEffect(() => {
    setOrder(initialOrder);
  }, [initialOrder]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoadingDetail(true);
    storeApi
      .getOrder(initialOrder._id)
      .then(({ data }) => {
        if (!active) return;
        if (data.data?.order) {
          setOrder(data.data.order);
          onUpdated(data.data.order);
        }
        setTimeline(data.data?.timeline ?? []);
        setConversion(data.data?.conversion ?? null);
      })
      .catch(() => {
        if (active) {
          setTimeline([]);
          setConversion(null);
        }
      })
      .finally(() => {
        if (active) setLoadingDetail(false);
      });
    return () => {
      active = false;
    };
  }, [open, initialOrder._id]);

  const updateOrder = (next: StoreOrder) => {
    setOrder(next);
    onUpdated(next);
  };

  const runAction = async (action: string, payload: Record<string, unknown> = {}) => {
    setBusy(action);
    try {
      const { data } = await storeApi.runOrderAction(order._id, { action, ...payload });
      if (data.data?.duplicateUrl) {
        window.open(data.data.duplicateUrl, "_blank", "noopener,noreferrer");
        toast.success(
          order.provider === "shopify"
            ? "Draft order created in Shopify"
            : order.provider === "woocommerce"
              ? "Duplicate order opened in WooCommerce"
              : "Duplicate order opened in store admin",
        );
        return;
      }
      if (data.data?.archived) {
        toast.success("Order archived");
        onOpenChange(false);
        return;
      }
      if (action === "resend_order_email") {
        if (data.data?.order) updateOrder(data.data.order);
        toast.success(
          order.provider === "woocommerce"
            ? "Order details added as a customer note (WooCommerce has no REST email API)"
            : "Order email sent to customer",
        );
        return;
      }
      if (action === "remove_customer") {
        if (data.data?.order) updateOrder(data.data.order);
        toast.success("Customer removed from order");
        return;
      }
      if (action === "refund") {
        if (data.data?.order) updateOrder(data.data.order);
        setRefundConfirmOpen(false);
        toast.success("Order refunded");
        return;
      }
      if (data.data?.order) {
        updateOrder(data.data.order);
        toast.success("Order updated");
      }
    } catch (err: unknown) {
      const { message } = getApiError(err, "Action failed");
      toast.error(message);
    } finally {
      setBusy(null);
    }
  };

  const cancelled = orderIsCancelled(order);
  const fulfilled = orderIsFulfilled(order);
  const tracking = order.fulfillments?.find((f) => f.trackingUrl || f.trackingNumber);
  const items = order.lineItems ?? [];
  const itemCount = orderItemCount(order);
  const paid = orderAmountPaid(order);
  const balance = orderBalance(order);
  const shippingAmount = orderShippingAmount(order);
  const taxAmount = orderTaxAmount(order);
  const shippingDetail = formatOrderShippingDetail(order);
  const taxDetail = formatOrderTaxDetail(order);
  const canResendOrderEmail = canPerformOrderAction(order, "resend_order_email");
  const canRefundOrder = canPerformOrderAction(order, "refund");
  const canHoldOrder = canPerformOrderAction(order, "hold");
  const canRequestFulfillment = canPerformOrderAction(order, "request_fulfillment");
  const canFulfillOrder = canPerformOrderAction(order, "fulfill");
  const canSendInvoice = canPerformOrderAction(order, "send_invoice");
  const canMarkPaid = canPerformOrderAction(order, "mark_paid");
  const canEditOrder = canPerformOrderAction(order, "edit");
  const canDuplicateOrder = canPerformOrderAction(order, "duplicate");
  const canArchiveOrder = canPerformOrderAction(order, "archive");
  const adminLabel = storeAdminLabel(order.provider);

  const handleFulfill = async () => {
    await runAction("fulfill", {
      trackingNumber: trackingNumber.trim() || undefined,
      trackingCompany: trackingCompany.trim() || undefined,
      notifyCustomer: true,
    });
    setShowFulfillForm(false);
    setTrackingNumber("");
    setTrackingCompany("");
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[min(92vh,860px)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="space-y-3 border-b border-border/60 px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
              <div className="space-y-1">
                <DialogTitle className="text-lg font-semibold">
                  {order.orderNumber || order.name || `#${order.externalId}`}
                </DialogTitle>
                {order.placedAt ? (
                  <p className="text-xs text-muted-foreground">
                    {formatOrderDate(order.placedAt)}
                    {order.channel ? ` · ${order.channel}` : ""}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {order.financialStatus ? (
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${financialTone(
                      order.financialStatus,
                    )}`}
                  >
                    {formatFinancialLabel(order.financialStatus)}
                  </span>
                ) : null}
                {order.fulfillmentStatus ? (
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${fulfillmentTone(
                      order.fulfillmentStatus,
                    )}`}
                  >
                    {formatFulfillmentLabel(order.fulfillmentStatus)}
                  </span>
                ) : null}
                {order.onHold ? (
                  <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                    On hold
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {canHoldOrder ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  disabled={busy !== null}
                  onClick={() => void runAction("hold")}
                >
                  {busy === "hold" ? <Loader2 className="mr-1 size-3 animate-spin" /> : null}
                  Mark as on hold
                </Button>
              ) : null}
              {canRequestFulfillment ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  disabled={busy !== null}
                  onClick={() => setRequestFulfillmentOpen(true)}
                >
                  Request fulfillment
                </Button>
              ) : null}
              {canFulfillOrder ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  disabled={busy !== null}
                  onClick={() => setShowFulfillForm((v) => !v)}
                >
                  Mark fulfilled
                </Button>
              ) : null}

              {canSendInvoice ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  disabled={busy !== null}
                  onClick={() => void runAction("send_invoice", { message: "Here is your invoice." })}
                >
                  {busy === "send_invoice" ? <Loader2 className="mr-1 size-3 animate-spin" /> : null}
                  Send invoice
                </Button>
              ) : null}
              {canMarkPaid ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  disabled={busy !== null}
                  onClick={() => void runAction("mark_paid")}
                >
                  {busy === "mark_paid" ? <Loader2 className="mr-1 size-3 animate-spin" /> : null}
                  Mark as paid
                </Button>
              ) : null}
              {canRefundOrder ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  disabled={busy !== null}
                  onClick={() => setRefundConfirmOpen(true)}
                >
                  {busy === "refund" ? <Loader2 className="mr-1 size-3 animate-spin" /> : null}
                  Refund
                </Button>
              ) : null}

              {canResendOrderEmail ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  disabled={busy !== null}
                  onClick={() => void runAction("resend_order_email")}
                >
                  {busy === "resend_order_email" ? (
                    <Loader2 className="mr-1 size-3 animate-spin" />
                  ) : (
                    <Mail className="mr-1 size-3" />
                  )}
                  Resend order email
                </Button>
              ) : null}

              {canEditOrder ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => setEditOpen(true)}
                >
                  <Pencil className="mr-1 size-3" />
                  Edit
                </Button>
              ) : null}

              <DropdownMenu>
                <DropdownMenuTrigger
                  className={buttonVariants({ variant: "outline", size: "sm", className: "h-8 text-xs" })}
                >
                  <Printer className="mr-1 size-3" />
                  Print
                  <ChevronDown className="ml-1 size-3" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => printOrderPage(order)}>
                    Print order page
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => printPackingSlip(order)}>
                    Print packing slip
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger
                  className={buttonVariants({ variant: "outline", size: "sm", className: "h-8 px-2" })}
                >
                  <MoreHorizontal className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {canResendOrderEmail ? (
                    <DropdownMenuItem
                      disabled={busy !== null}
                      onClick={() => void runAction("resend_order_email")}
                    >
                      Resend order email
                    </DropdownMenuItem>
                  ) : null}
                  {canDuplicateOrder ? (
                    <DropdownMenuItem onClick={() => void runAction("duplicate")}>
                      Duplicate order
                    </DropdownMenuItem>
                  ) : null}
                  {canPerformOrderAction(order, "cancel") ? (
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => {
                        if (confirm(`Cancel order ${order.orderNumber || order.name}?`)) {
                          void runAction("cancel", {
                            reason: "customer",
                            restock: true,
                            notifyCustomer: true,
                          });
                        }
                      }}
                    >
                      Cancel order
                    </DropdownMenuItem>
                  ) : null}
                  {canRefundOrder ? (
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => setRefundConfirmOpen(true)}
                    >
                      Refund order
                    </DropdownMenuItem>
                  ) : null}
                  {canArchiveOrder ? (
                    <DropdownMenuItem onClick={() => void runAction("archive")}>
                      Archive order
                    </DropdownMenuItem>
                  ) : null}
                  {order.statusUrl ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => window.open(order.statusUrl, "_blank", "noopener,noreferrer")}
                      >
                        View order status page
                      </DropdownMenuItem>
                    </>
                  ) : null}
                  {order.adminUrl ? (
                    <DropdownMenuItem
                      onClick={() => window.open(order.adminUrl, "_blank", "noopener,noreferrer")}
                    >
                      {adminLabel}
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {showFulfillForm && !cancelled && !fulfilled ? (
              <section className="rounded-lg border border-border/60 bg-muted/20 p-4">
                <p className="mb-3 text-sm font-medium text-foreground">Fulfillment details</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    value={trackingCompany}
                    onChange={(e) => setTrackingCompany(e.target.value)}
                    placeholder="Carrier (e.g. UPS)"
                    className="h-9 text-sm"
                  />
                  <Input
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="Tracking number"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="mt-3 flex gap-2">
                  <Button type="button" size="sm" disabled={busy === "fulfill"} onClick={() => void handleFulfill()}>
                    {busy === "fulfill" ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
                    Confirm fulfill
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setShowFulfillForm(false)}>
                    Cancel
                  </Button>
                </div>
              </section>
            ) : null}

            <section className="rounded-lg border border-border/60">
              <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
                <Package className="size-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">
                  {fulfilled ? "Fulfilled" : "Unfulfilled"}
                </h3>
                <span className="text-xs text-muted-foreground">
                  {itemCount} item{itemCount === 1 ? "" : "s"}
                </span>
                {order.fulfillmentService ? (
                  <span className="ml-auto text-xs text-muted-foreground">{order.fulfillmentService}</span>
                ) : null}
              </div>
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
                      <p className="text-sm font-medium text-foreground">{item.title}</p>
                      {item.variantTitle ? (
                        <p className="text-xs text-muted-foreground">{item.variantTitle}</p>
                      ) : null}
                      {item.sku ? (
                        <p className="text-[11px] text-muted-foreground">SKU: {item.sku}</p>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-right text-sm">
                      <p className="text-muted-foreground">
                        {formatMoney(item.price, order.currency)} × {item.quantity ?? 1}
                      </p>
                      {item.price != null ? (
                        <p className="font-medium text-foreground">
                          {formatMoney((item.price ?? 0) * (item.quantity ?? 1), order.currency)}
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {tracking ? (
              <section className="rounded-lg border border-border/60 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Truck className="size-4 text-muted-foreground" />
                  Shipment
                </div>
                {tracking.trackingCompany ? <p className="text-sm text-foreground">{tracking.trackingCompany}</p> : null}
                {tracking.trackingNumber ? <p className="text-sm text-muted-foreground">{tracking.trackingNumber}</p> : null}
                {tracking.trackingUrl ? (
                  <a
                    href={tracking.trackingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-sm font-medium text-primary hover:underline"
                  >
                    Track package
                  </a>
                ) : null}
              </section>
            ) : null}

            <section className="rounded-lg border border-border/60 p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                {order.financialStatus ? (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${financialTone(
                      order.financialStatus,
                    )}`}
                  >
                    {(order.financialStatus || "").toLowerCase() === "pending" ? (
                      <Clock className="size-3" />
                    ) : null}
                    {formatFinancialLabel(order.financialStatus)}
                  </span>
                ) : (
                  <h3 className="text-sm font-semibold text-foreground">Payment</h3>
                )}
              </div>
              <div className="space-y-2">
                {order.subtotalPrice != null ? (
                  <PaymentLineRow
                    label="Subtotal"
                    detail={`${itemCount} item${itemCount === 1 ? "" : "s"}`}
                    amount={formatMoney(order.subtotalPrice, order.currency)}
                  />
                ) : null}
                {shippingAmount != null ? (
                  <PaymentLineRow
                    label="Shipping"
                    detail={shippingDetail}
                    amount={formatMoney(shippingAmount, order.currency)}
                  />
                ) : null}
                {taxAmount != null ? (
                  <PaymentLineRow
                    label="Taxes"
                    detail={taxDetail}
                    amount={formatMoney(taxAmount, order.currency)}
                  />
                ) : null}
                <PaymentLineRow
                  label="Total"
                  amount={formatMoney(order.totalPrice, order.currency)}
                  strong
                />
                <div className="border-t border-border/60 pt-2">
                  <PaymentLineRow
                    label="Paid"
                    amount={formatMoney(paid, order.currency)}
                  />
                  <div className="mt-2">
                    <PaymentLineRow
                      label="Balance"
                      amount={formatMoney(balance, order.currency)}
                      strong
                    />
                  </div>
                </div>
              </div>
              {canSendInvoice || canMarkPaid ? (
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  {canSendInvoice ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      disabled={busy !== null}
                      onClick={() => void runAction("send_invoice", { message: "Here is your invoice." })}
                    >
                      {busy === "send_invoice" ? <Loader2 className="mr-1 size-3 animate-spin" /> : null}
                      Send invoice
                    </Button>
                  ) : null}
                  {canMarkPaid ? (
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 text-xs"
                      disabled={busy !== null}
                      onClick={() => void runAction("mark_paid")}
                    >
                      {busy === "mark_paid" ? <Loader2 className="mr-1 size-3 animate-spin" /> : null}
                      Mark as paid
                    </Button>
                  ) : null}
                </div>
              ) : null}
              {canRefundOrder ? (
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    disabled={busy !== null}
                    onClick={() => setRefundConfirmOpen(true)}
                  >
                    {busy === "refund" ? <Loader2 className="mr-1 size-3 animate-spin" /> : null}
                    Refund
                  </Button>
                </div>
              ) : null}
            </section>

            <OrderCustomerCard
              order={order}
              conversion={conversion}
              busy={busy !== null}
              onEditContact={() => setContactEditOpen(true)}
              onEditShipping={() => setShippingEditOpen(true)}
              onRemoveCustomer={() => {
                if (confirm("Remove customer from this order?")) {
                  void runAction("remove_customer");
                }
              }}
            />

            {conversion && conversion.highlights.length > 0 ? (
              <ConversionSummaryCard
                conversion={conversion}
                onViewDetails={() => setConversionDetailsOpen(true)}
              />
            ) : null}

            {order.note ? (
              <section className="rounded-lg border border-border/60 p-4">
                <h3 className="mb-2 text-sm font-semibold text-foreground">Note</h3>
                <p className="text-sm text-muted-foreground">{order.note}</p>
              </section>
            ) : null}

            {order.tags && order.tags.length > 0 ? (
              <section className="rounded-lg border border-border/60 p-4">
                <h3 className="mb-2 text-sm font-semibold text-foreground">Tags</h3>
                <div className="flex flex-wrap gap-1.5">
                  {order.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-[11px]">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="rounded-lg border border-border/60 p-4">
              <h3 className="mb-3 text-sm font-semibold text-foreground">Timeline</h3>
              {loadingDetail ? (
                <p className="text-sm text-muted-foreground">Loading timeline…</p>
              ) : timeline.length > 0 ? (
                <ul className="space-y-3">
                  {timeline.map((event) => (
                    <li key={event.id} className="border-l-2 border-border/60 pl-3">
                      <p className="text-sm text-foreground">{event.message}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatOrderDate(event.at)}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No timeline events yet.</p>
              )}
            </section>
          </div>
        </DialogContent>
      </Dialog>

      <OrderRefundDialog
        order={order}
        open={refundConfirmOpen}
        onOpenChange={setRefundConfirmOpen}
        busy={busy === "refund"}
        onConfirm={() => void runAction("refund")}
      />

      <RequestFulfillmentDialog
        order={order}
        open={requestFulfillmentOpen}
        onOpenChange={setRequestFulfillmentOpen}
        onUpdated={updateOrder}
        onEditAddress={() => {
          setRequestFulfillmentOpen(false);
          setShippingEditOpen(true);
        }}
      />

      <OrderEditDialog
        order={order}
        open={editOpen}
        onOpenChange={setEditOpen}
        onUpdated={updateOrder}
      />

      <OrderEditContactDialog
        order={order}
        open={contactEditOpen}
        onOpenChange={setContactEditOpen}
        onUpdated={updateOrder}
      />

      <OrderEditShippingDialog
        order={order}
        open={shippingEditOpen}
        onOpenChange={setShippingEditOpen}
        onUpdated={updateOrder}
      />

      <ConversionDetailsDialog
        conversion={conversion}
        open={conversionDetailsOpen}
        onOpenChange={setConversionDetailsOpen}
        onViewSession={(session) => setSelectedSession(session)}
      />

      <SessionDetailsDialog
        session={selectedSession}
        open={Boolean(selectedSession)}
        onOpenChange={(open) => {
          if (!open) setSelectedSession(null);
        }}
        onBack={() => setSelectedSession(null)}
      />
    </>
  );
}
