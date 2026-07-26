import { shopifyAdminFetch, resolveShopifyAuth } from "../apps/server/src/commerce/shopify/connection.ts";

async function main() {
  const auth = await resolveShopifyAuth();
  console.log("shop", auth.shop, auth.source);
  const d = await shopifyAdminFetch<{ orders: any[] }>(
    "/orders.json?status=any&limit=5",
  );
  console.log(
    JSON.stringify(
      (d.orders || []).map((o) => ({
        name: o.name,
        n: o.order_number,
        email: o.email,
      })),
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
