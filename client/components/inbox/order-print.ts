import type { StoreOrder } from "@/lib/types";
import {
  formatAddress,
  formatFinancialLabel,
  formatFulfillmentLabel,
  formatMoney,
  formatOrderDate,
  orderItemCount,
} from "@/components/inbox/order-utils";

function printHtml(title: string, bodyHtml: string) {
  const win = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
  if (!win) return;
  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111; padding: 24px; }
    h1 { font-size: 20px; margin: 0 0 8px; }
    .muted { color: #666; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { border-bottom: 1px solid #ddd; padding: 8px; text-align: left; font-size: 13px; }
    .right { text-align: right; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>${bodyHtml}</body>
</html>`);
  win.document.close();
  win.focus();
  win.print();
}

export function printOrderPage(order: StoreOrder) {
  const items = (order.lineItems ?? [])
    .map(
      (item) => `
      <tr>
        <td>${item.quantity ?? 1}× ${item.title ?? ""}${item.variantTitle ? ` · ${item.variantTitle}` : ""}</td>
        <td class="right">${formatMoney((item.price ?? 0) * (item.quantity ?? 1), order.currency)}</td>
      </tr>`,
    )
    .join("");

  printHtml(
    `Order ${order.orderNumber || order.name || ""}`,
    `
      <h1>${order.orderNumber || order.name || "Order"}</h1>
      <div class="muted">${formatOrderDate(order.placedAt)} · ${formatFinancialLabel(order.financialStatus)} · ${formatFulfillmentLabel(order.fulfillmentStatus)}</div>
      <p><strong>Customer:</strong> ${order.customer?.name || "—"}<br>${order.customer?.email || ""}</p>
      <p><strong>Ship to:</strong><br>${formatAddress(order.shippingAddress).replace(/\n/g, "<br>")}</p>
      <table>
        <thead><tr><th>Item</th><th class="right">Total</th></tr></thead>
        <tbody>${items}</tbody>
      </table>
      <p class="right"><strong>Total: ${formatMoney(order.totalPrice, order.currency)}</strong></p>
    `,
  );
}

export function printPackingSlip(order: StoreOrder) {
  const items = (order.lineItems ?? [])
    .map(
      (item) => `
      <tr>
        <td>${item.quantity ?? 1}</td>
        <td>${item.sku || "—"}</td>
        <td>${item.title ?? ""}${item.variantTitle ? ` · ${item.variantTitle}` : ""}</td>
      </tr>`,
    )
    .join("");

  printHtml(
    `Packing slip ${order.orderNumber || order.name || ""}`,
    `
      <h1>Packing slip</h1>
      <div class="muted">${order.orderNumber || order.name} · ${orderItemCount(order)} item(s)</div>
      <p><strong>Ship to:</strong><br>${formatAddress(order.shippingAddress).replace(/\n/g, "<br>")}</p>
      <table>
        <thead><tr><th>Qty</th><th>SKU</th><th>Item</th></tr></thead>
        <tbody>${items}</tbody>
      </table>
    `,
  );
}
