import type { StoreAdapter } from "../types.js";

/** WooCommerce-ready stub — wire REST API later. */
export function createWooCommerceAdapter(): StoreAdapter {
  const notReady = async () => {
    throw new Error("WooCommerce adapter is not configured yet.");
  };

  return {
    provider: "woocommerce",
    searchProducts: notReady as StoreAdapter["searchProducts"],
    getProduct: notReady as StoreAdapter["getProduct"],
    checkAvailability: notReady as StoreAdapter["checkAvailability"],
    findOrder: notReady as StoreAdapter["findOrder"],
    getOrder: notReady as StoreAdapter["getOrder"],
    requestCancellation: notReady as StoreAdapter["requestCancellation"],
    requestAddressChange: notReady as StoreAdapter["requestAddressChange"],
    createReturn: notReady as StoreAdapter["createReturn"],
    createCheckoutLink: notReady as StoreAdapter["createCheckoutLink"],
    initiateRefund: notReady as StoreAdapter["initiateRefund"],
    getRefundDetails: notReady as StoreAdapter["getRefundDetails"],
  };
}
