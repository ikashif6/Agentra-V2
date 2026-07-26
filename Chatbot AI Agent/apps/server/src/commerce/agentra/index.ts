import type { StoreAdapter, ProductSearchQuery, StoreOrder, StoreProduct } from "../types.js";
import type { RefundDetails } from "../refundStatus.js";

function agentraBase(): string {
  return String(process.env.AGENTRA_API_URL || "http://localhost:5000/api/v1")
    .replace(/\/$/, "");
}

function secret(): string {
  return String(
    process.env.CHATBOT_BRIDGE_SECRET || process.env.ENGINE_SHARED_SECRET || "",
  ).trim();
}

async function agentraFetch(
  workspaceId: string,
  path: string,
  init?: RequestInit,
): Promise<any> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "x-chatbot-bridge-secret": secret(),
  };
  const res = await fetch(
    `${agentraBase()}/chatbot-bridge/workspaces/${encodeURIComponent(workspaceId)}${path}`,
    { ...init, headers: { ...headers, ...(init?.headers as Record<string, string>) } },
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.message || `Agentra commerce error (${res.status})`);
  }
  return json?.data ?? json;
}

export function createAgentraAdapter(workspaceId: string): StoreAdapter {
  return {
    provider: "custom",
    async searchProducts(q: ProductSearchQuery): Promise<StoreProduct[]> {
      const data = await agentraFetch(workspaceId, "/products/search", {
        method: "POST",
        body: JSON.stringify(q || {}),
      });
      return Array.isArray(data?.products) ? data.products : [];
    },
    async getProduct(id: string): Promise<StoreProduct | null> {
      const data = await agentraFetch(workspaceId, `/products/${encodeURIComponent(id)}`);
      return data?.product || null;
    },
    async checkAvailability(productId: string): Promise<{
      available: boolean;
      product: StoreProduct | null;
    }> {
      const product = await this.getProduct(productId);
      return { available: Boolean(product?.available), product };
    },
    async findOrder(input: {
      orderNumber: string;
      email?: string;
      phone?: string;
    }): Promise<StoreOrder | null> {
      const data = await agentraFetch(workspaceId, "/orders/find", {
        method: "POST",
        body: JSON.stringify(input || {}),
      });
      return data?.order || null;
    },
    async getOrder(orderId: string): Promise<StoreOrder | null> {
      const data = await agentraFetch(workspaceId, `/orders/${encodeURIComponent(orderId)}`);
      return data?.order || null;
    },
    async requestCancellation(orderId: string, reason?: string) {
      const data = await agentraFetch(
        workspaceId,
        `/orders/${encodeURIComponent(orderId)}/cancel`,
        { method: "POST", body: JSON.stringify({ reason }) },
      );
      return {
        ok: Boolean(data?.ok),
        message: String(data?.message || ""),
        order: data?.order,
      };
    },
    async requestAddressChange(
      orderId: string,
      address: NonNullable<StoreOrder["shippingAddress"]>,
    ) {
      const data = await agentraFetch(
        workspaceId,
        `/orders/${encodeURIComponent(orderId)}/address`,
        { method: "POST", body: JSON.stringify({ address }) },
      );
      return {
        ok: Boolean(data?.ok),
        message: String(data?.message || ""),
        order: data?.order,
      };
    },
    async createReturn(orderId: string, reason: string) {
      return {
        ok: false,
        message: `Return for order ${orderId} requires a human agent (${reason}).`,
      };
    },
    async createCheckoutLink() {
      return {
        ok: false,
        message: "Checkout links are opened on the storefront.",
      };
    },
    async initiateRefund(input: {
      orderId: string;
      amount: number;
      reason?: string;
    }) {
      const data = await agentraFetch(
        workspaceId,
        `/orders/${encodeURIComponent(input.orderId)}/refund`,
        {
          method: "POST",
          body: JSON.stringify({
            amount: input.amount,
            reason: input.reason,
          }),
        },
      );
      return {
        ok: Boolean(data?.ok),
        message: String(data?.message || ""),
        refundId: data?.refundId,
        amount: data?.amount,
      };
    },
    async getRefundDetails(orderId: string): Promise<RefundDetails | null> {
      const data = await agentraFetch(
        workspaceId,
        `/orders/${encodeURIComponent(orderId)}/refund`,
      );
      return data?.details || null;
    },
  };
}
