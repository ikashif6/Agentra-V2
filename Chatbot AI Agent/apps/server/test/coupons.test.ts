import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getKnownCoupons } from "../src/engine/featureHelpers.js";
import { extraHandlers } from "../src/tools/extraHandlers.js";
import { clearWorkspaceConfigCache } from "../src/workspace/index.js";

describe("coupons", () => {
  it("uses demo codes only for custom commerce", () => {
    const prevProvider = process.env.COMMERCE_PROVIDER;
    const prevJson = process.env.KNOWN_COUPONS_JSON;
    try {
      delete process.env.KNOWN_COUPONS_JSON;
      process.env.COMMERCE_PROVIDER = "custom";
      clearWorkspaceConfigCache();
      const codes = getKnownCoupons().map((c) => c.code);
      assert.deepEqual(codes, ["BRIDAL10", "WELCOME15", "FREESHIP"]);

      process.env.COMMERCE_PROVIDER = "shopify";
      clearWorkspaceConfigCache();
      assert.equal(getKnownCoupons().length, 0);
    } finally {
      if (prevProvider == null) delete process.env.COMMERCE_PROVIDER;
      else process.env.COMMERCE_PROVIDER = prevProvider;
      if (prevJson == null) delete process.env.KNOWN_COUPONS_JSON;
      else process.env.KNOWN_COUPONS_JSON = prevJson;
      clearWorkspaceConfigCache();
    }
  });

  it("does not invent promo codes when none are configured", async () => {
    const prevProvider = process.env.COMMERCE_PROVIDER;
    const prevJson = process.env.KNOWN_COUPONS_JSON;
    try {
      delete process.env.KNOWN_COUPONS_JSON;
      process.env.COMMERCE_PROVIDER = "shopify";
      clearWorkspaceConfigCache();
      const result = await extraHandlers.lookupDiscountOrCoupon(
        { query: "What discount codes are available?" },
        {} as never,
      );
      const message = String((result.data as { message?: string }).message || "");
      assert.match(message, /won.?t invent|don.?t have a live list/i);
      assert.equal(/BRIDAL10|WELCOME15|FREESHIP/i.test(message), false);
    } finally {
      if (prevProvider == null) delete process.env.COMMERCE_PROVIDER;
      else process.env.COMMERCE_PROVIDER = prevProvider;
      if (prevJson == null) delete process.env.KNOWN_COUPONS_JSON;
      else process.env.KNOWN_COUPONS_JSON = prevJson;
      clearWorkspaceConfigCache();
    }
  });
});
