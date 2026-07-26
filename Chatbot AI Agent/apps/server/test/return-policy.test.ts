import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluateReturnEligibility } from "../src/commerce/returnPolicy.js";
import {
  containsSensitiveRequest,
  sanitizeCustomerText,
  shouldClearProductPreferences,
  clearProductPreferenceSlots,
} from "../src/security/sanitize.js";
import {
  pickBestProductsByName,
  extractProductNameHints,
} from "../src/engine/featureHelpers.js";
import { inferGoal } from "../src/engine/understand.js";
import { createCustomAdapter } from "../src/commerce/custom/index.js";

describe("returnPolicy", () => {
  it("rejects unshipped orders with order+policy wording", () => {
    const r = evaluateReturnEligibility({
      orderNumber: "1002",
      fulfillmentStatus: "unfulfilled",
      shipmentStatus: "not_shipped",
      createdAt: "2026-01-01T00:00:00Z",
    });
    assert.equal(r.eligible, false);
    assert.match(r.message, /Looking at order #1002/i);
    assert.match(r.message, /According to our policy/i);
    assert.match(r.message, /14/);
    assert.doesNotMatch(r.message, /30 days/i);
  });

  it("accepts delivered within window", () => {
    const r = evaluateReturnEligibility(
      {
        orderNumber: "1001",
        fulfillmentStatus: "fulfilled",
        shipmentStatus: "delivered",
        deliveredAt: "2026-07-15T00:00:00Z",
      },
      { now: new Date("2026-07-23T00:00:00Z"), windowDays: 14 },
    );
    assert.equal(r.eligible, true);
    assert.match(r.message, /you can start a return/i);
  });

  it("rejects after window with actual day count", () => {
    const r = evaluateReturnEligibility(
      {
        orderNumber: "1008",
        fulfillmentStatus: "fulfilled",
        shipmentStatus: "delivered",
        deliveredAt: "2026-06-01T00:00:00Z",
      },
      { now: new Date("2026-07-23T00:00:00Z"), windowDays: 14 },
    );
    assert.equal(r.eligible, false);
    assert.match(r.message, /14-day return window/i);
    assert.match(r.message, /52 days/i);
  });
});

describe("security sanitize", () => {
  it("detects sensitive payment content", () => {
    assert.equal(
      containsSensitiveRequest("card 4111111111111111 cvv 123"),
      true,
    );
  });

  it("sanitize does not throw on normal text", () => {
    const out = sanitizeCustomerText("Where is my order?");
    assert.match(out, /order/i);
  });

  it("clears sticky prefs on surprise-me / never mind", () => {
    assert.equal(shouldClearProductPreferences("surprise me"), true);
    assert.equal(
      shouldClearProductPreferences(
        "Actually never mind — just surprise me with anything",
      ),
      true,
    );
    const cleared = clearProductPreferenceSlots({
      budget: "500",
      color: "ivory",
      productType: "dress",
      email: "a@b.com",
    });
    assert.equal(cleared.budget, undefined);
    assert.equal(cleared.color, undefined);
    assert.equal(cleared.email, "a@b.com");
  });
});

describe("product name resolve", () => {
  it("matches Maya and Emilia from catalog titles", async () => {
    const store = createCustomAdapter();
    const catalog = await store.searchProducts({ limit: 40 });
    const maya = pickBestProductsByName(catalog, "Maya Crepe Sheath Dress", {
      limit: 1,
    })[0];
    const emilia = pickBestProductsByName(
      catalog,
      "Emilia Lace Wedding Dress",
      { limit: 1 },
    )[0];
    assert.equal(maya?.id, "p-1005");
    assert.equal(emilia?.id, "p-1001");
    const hints = extractProductNameHints(
      "Compare the Emilia and Sofia dresses for me",
    );
    assert.ok(hints.length >= 2);
  });

  it("infers refund_status for was-order-refunded", () => {
    assert.equal(
      inferGoal("Was order 1003 refunded? Email alex@example.com", "general"),
      "refund_status",
    );
  });
});
