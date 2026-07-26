import type { RefundDetails } from "./refundStatus.js";

export interface StoreProduct {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  price: number;
  currency: string;
  url?: string;
  available: boolean;
  productType?: string;
  tags?: string[];
  colors?: string[];
  sizes?: string[];
  materials?: string[];
  styles?: string[];
  variants?: Array<{
    id: string;
    title: string;
    available: boolean;
    price?: number;
    size?: string;
    color?: string;
  }>;
}

export interface StoreOrderItem {
  title: string;
  quantity: number;
  sku?: string;
  productId?: string;
  variantId?: string;
  price?: number;
}

export interface StoreOrder {
  id: string;
  orderNumber: string;
  email: string;
  phone?: string;
  total: number;
  currency: string;
  financialStatus: string;
  fulfillmentStatus: string;
  shipmentStatus: string;
  refundStatus: string;
  cancellationStatus: string;
  createdAt: string;
  items: StoreOrderItem[];
  shippingAddress?: {
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    zip: string;
    country: string;
  };
  tracking?: {
    number?: string;
    carrier?: string;
    url?: string;
    estimate?: string;
  };
  returnEligible?: boolean;
  cancelEligible?: boolean;
  addressChangeEligible?: boolean;
  /** ISO timestamp when the order was delivered (if known) */
  deliveredAt?: string | null;
  /** ISO timestamp when the order was fulfilled/shipped (if known) */
  fulfilledAt?: string | null;
}

export interface ProductSearchQuery {
  query?: string;
  productType?: string;
  size?: string;
  color?: string;
  style?: string;
  material?: string;
  budgetMax?: number;
  occasion?: string;
  availableOnly?: boolean;
  limit?: number;
}

export interface StoreAdapter {
  readonly provider: "custom" | "shopify" | "woocommerce";
  searchProducts(q: ProductSearchQuery): Promise<StoreProduct[]>;
  getProduct(id: string): Promise<StoreProduct | null>;
  checkAvailability(
    productId: string,
    variantId?: string,
  ): Promise<{ available: boolean; product: StoreProduct | null }>;
  findOrder(input: {
    orderNumber: string;
    email?: string;
    phone?: string;
  }): Promise<StoreOrder | null>;
  getOrder(orderId: string): Promise<StoreOrder | null>;
  requestCancellation(orderId: string, reason?: string): Promise<{
    ok: boolean;
    message: string;
    order?: StoreOrder;
  }>;
  requestAddressChange(
    orderId: string,
    address: NonNullable<StoreOrder["shippingAddress"]>,
  ): Promise<{ ok: boolean; message: string; order?: StoreOrder }>;
  createReturn(
    orderId: string,
    reason: string,
    itemTitles?: string[],
  ): Promise<{ ok: boolean; message: string; returnId?: string }>;
  createCheckoutLink(input: {
    productId?: string;
    variantId?: string;
    quantity?: number;
    size?: string;
    color?: string;
  }): Promise<{ ok: boolean; url?: string; message: string; productTitle?: string }>;
  initiateRefund(input: {
    orderId: string;
    amount: number;
    reason?: string;
  }): Promise<{ ok: boolean; message: string; refundId?: string; amount?: number }>;
  /** Live refund status for an order (whether money was returned). */
  getRefundDetails(orderId: string): Promise<RefundDetails | null>;
}
