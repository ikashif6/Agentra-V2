import { createOtpChallenge, verifyOtpChallenge } from "../src/security/otp.js";
import { createCustomAdapter } from "../src/commerce/custom/index.js";
import assert from "node:assert/strict";
import test from "node:test";

test("otp reject then accept", async () => {
  const key = `refund:smoke:${Date.now()}`;
  const { code } = await createOtpChallenge({
    key,
    purpose: "refund",
    email: "a@b.com",
    meta: { amount: 50 },
  });
  const bad = await verifyOtpChallenge({ key, purpose: "refund", code: "000000" });
  assert.equal(bad.ok, false);
  const good = await verifyOtpChallenge({ key, purpose: "refund", code });
  assert.equal(good.ok, true);
  assert.equal(good.meta?.amount, 50);
});

test("checkout link builds", async () => {
  const store = createCustomAdapter();
  const link = await store.createCheckoutLink({
    productId: "p-1001",
    quantity: 2,
    size: "m",
  });
  assert.equal(link.ok, true);
  assert.match(String(link.url), /\/cart\/.+:2$/);
});
