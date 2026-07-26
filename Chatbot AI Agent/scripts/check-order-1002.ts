import { shopifyAdminFetch, resolveShopifyAuth } from "../apps/server/src/commerce/shopify/connection.ts";
import { createShopifyAdapter } from "../apps/server/src/commerce/shopify/index.ts";

async function main() {
  await resolveShopifyAuth();
  const store = createShopifyAdapter();
  const order = await store.findOrder({
    orderNumber: "1002",
    email: "kashif.61764@iqra.edu.pk",
  });
  console.log(
    JSON.stringify(
      {
        orderNumber: order?.orderNumber,
        fulfillmentStatus: order?.fulfillmentStatus,
        shipmentStatus: order?.shipmentStatus,
        addressChangeEligible: order?.addressChangeEligible,
        cancelEligible: order?.cancelEligible,
        shippingAddress: order?.shippingAddress,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
