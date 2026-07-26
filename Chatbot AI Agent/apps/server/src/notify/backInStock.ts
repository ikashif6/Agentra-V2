import { env } from "../config/env.js";
import { sendEmail } from "./email.js";
import {
  listCustomerAlerts,
  markCustomerAlertNotified,
} from "../storage/store.js";

/**
 * Email pending back-in-stock subscribers for a product that is available again.
 * Call from a cron/webhook when inventory recovers.
 */
export async function notifyBackInStockSubscribers(input: {
  workspaceId: string;
  productId: string;
  productTitle?: string;
  productUrl?: string;
}): Promise<{ notified: number }> {
  const pending = await listCustomerAlerts(input.workspaceId, {
    productId: input.productId,
    status: "pending",
    type: "back_in_stock",
  });
  let notified = 0;
  const title = input.productTitle || "your item";
  for (const alert of pending) {
    const link = input.productUrl ? `\n\nView it here: ${input.productUrl}` : "";
    const result = await sendEmail({
      to: alert.email,
      subject: `${title} is back in stock at ${env.storeName}`,
      text: `Good news — ${title} is available again${
        alert.size ? ` (size ${alert.size})` : ""
      }${alert.color ? ` in ${alert.color}` : ""}.${link}\n\n— ${env.storeName}`,
    });
    if (result.ok) {
      await markCustomerAlertNotified(alert.id);
      notified += 1;
    }
  }
  return { notified };
}
