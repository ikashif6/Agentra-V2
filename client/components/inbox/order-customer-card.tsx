"use client";

import type { ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { StoreOrder, StoreOrderConversion } from "@/lib/types";
import {
  addressMapUrl,
  billingMatchesShipping,
  customerAdminUrl,
  formatShippingAddressLines,
  orderIsFulfilled,
} from "@/components/inbox/order-utils";

type OrderCustomerCardProps = {
  order: StoreOrder;
  conversion?: StoreOrderConversion | null;
  onEditContact: () => void;
  onEditShipping: () => void;
  onRemoveCustomer: () => void;
  busy?: boolean;
};

function SectionHeading({ children }: { children: ReactNode }) {
  return <h4 className="text-sm font-semibold text-foreground">{children}</h4>;
}

export function OrderCustomerCard({
  order,
  conversion,
  onEditContact,
  onEditShipping,
  onRemoveCustomer,
  busy,
}: OrderCustomerCardProps) {
  const customer = order.customer;
  const hasCustomer =
    Boolean(customer?.name) ||
    Boolean(customer?.email) ||
    Boolean(customer?.phone) ||
    Boolean(order.shippingAddress) ||
    Boolean(order.billingAddress);

  if (!hasCustomer) return null;

  const customerUrl = customerAdminUrl(order);
  const orderCount = conversion?.customerOrderIndex;
  const shippingLines = formatShippingAddressLines(order.shippingAddress);
  const mapUrl = addressMapUrl(order.shippingAddress);
  const sameBilling = billingMatchesShipping(order.shippingAddress, order.billingAddress);
  const shipped = orderIsFulfilled(order);
  const canEdit = order.provider === "shopify" && !shipped;

  return (
    <section className="rounded-lg border border-border/60 p-4">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">Customer</h3>
        {order.provider === "shopify" ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              className={buttonVariants({ variant: "ghost", size: "icon", className: "size-8" })}
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEditContact}>Edit contact information</DropdownMenuItem>
              <DropdownMenuItem onClick={onEditShipping} disabled={!canEdit}>
                Edit shipping address
              </DropdownMenuItem>
              {customer?.externalId ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    disabled={busy}
                    onClick={onRemoveCustomer}
                  >
                    Remove customer
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <div className="space-y-4">
        {customer?.name || orderCount != null ? (
          <div className="space-y-1">
            {customer?.name ? (
              customerUrl ? (
                <a
                  href={customerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  {customer.name}
                </a>
              ) : (
                <p className="text-sm font-medium text-primary">{customer.name}</p>
              )
            ) : null}
            {orderCount != null ? (
              <p className="text-sm text-primary">
                {orderCount} order{orderCount === 1 ? "" : "s"}
              </p>
            ) : null}
          </div>
        ) : null}

        {customer?.email || customer?.phone ? (
          <div className="space-y-2">
            <SectionHeading>Contact information</SectionHeading>
            {customer.email ? (
              <a href={`mailto:${customer.email}`} className="block text-sm text-primary hover:underline">
                {customer.email}
              </a>
            ) : null}
            {customer.phone ? (
              <a href={`tel:${customer.phone}`} className="block text-sm text-primary hover:underline">
                {customer.phone}
              </a>
            ) : null}
          </div>
        ) : null}

        {shippingLines.length > 0 ? (
          <div className="space-y-2">
            <SectionHeading>Shipping address</SectionHeading>
            <div className="space-y-0.5 text-sm text-foreground">
              {shippingLines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
            {mapUrl ? (
              <a
                href={mapUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-block text-sm text-primary hover:underline"
              >
                View map
              </a>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-2">
          <SectionHeading>Billing address</SectionHeading>
          {sameBilling ? (
            <p className="text-sm text-muted-foreground">Same as shipping address</p>
          ) : order.billingAddress ? (
            <div className="space-y-0.5 text-sm text-foreground">
              {formatShippingAddressLines(order.billingAddress).map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No billing address</p>
          )}
        </div>
      </div>
    </section>
  );
}
