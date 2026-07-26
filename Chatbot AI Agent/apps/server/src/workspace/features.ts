import type { ChatbotFeatureId, WorkspaceFeatureFlags } from "./types.js";

/** All features on — preserves current chatbot behaviour until Agentra configures them. */
export function defaultFeatureFlags(): WorkspaceFeatureFlags {
  return {
    product_discovery: true,
    order_lookup: true,
    tracking: true,
    returns: true,
    exchanges: true,
    partial_returns: true,
    cancellations: true,
    address_change: true,
    refund_status: true,
    // Chat-initiated refunds stay off by product decision (handoff instead).
    initiate_refund: false,
    discounts: true,
    shipping_estimates: true,
    payment_help: true,
    handoff: true,
    back_in_stock: true,
    custom_product_request: true,
    abandoned_cart: true,
    product_compare: true,
    reorder: true,
    knowledge_search: true,
  };
}

export function mergeFeatureFlags(
  overrides?: Partial<WorkspaceFeatureFlags>,
): WorkspaceFeatureFlags {
  return { ...defaultFeatureFlags(), ...(overrides || {}) };
}

/** Map tool names → feature flags for backend enforcement. */
export const TOOL_FEATURE_MAP: Record<string, ChatbotFeatureId> = {
  recommendProducts: "product_discovery",
  searchProducts: "product_discovery",
  getProductDetails: "product_discovery",
  listCatalogOptions: "product_discovery",
  checkProductAvailability: "product_discovery",
  compareProducts: "product_compare",
  suggestSimilarProducts: "product_discovery",
  findOrder: "order_lookup",
  getOrderStatus: "order_lookup",
  getTrackingDetails: "tracking",
  checkReturnEligibility: "returns",
  createReturnRequest: "returns",
  createExchangeRequest: "exchanges",
  createPartialReturn: "partial_returns",
  requestCancellation: "cancellations",
  requestAddressChange: "address_change",
  checkRefundStatus: "refund_status",
  requestRefund: "initiate_refund",
  lookupDiscountOrCoupon: "discounts",
  estimateDeliveryDate: "shipping_estimates",
  estimateShippingCost: "shipping_estimates",
  helpPaymentIssue: "payment_help",
  requestHumanHandoff: "handoff",
  subscribeBackInStock: "back_in_stock",
  submitCustomProductRequest: "custom_product_request",
  assistAbandonedCart: "abandoned_cart",
  reorderPreviousProducts: "reorder",
  searchKnowledgeBase: "knowledge_search",
};

export function isFeatureEnabled(
  features: WorkspaceFeatureFlags,
  feature: ChatbotFeatureId,
): boolean {
  return features[feature] !== false;
}

export function featureForTool(toolName: string): ChatbotFeatureId | null {
  return TOOL_FEATURE_MAP[toolName] || null;
}
