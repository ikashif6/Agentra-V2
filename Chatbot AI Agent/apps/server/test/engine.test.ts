import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { understandMessage, inferGoal, extractSlots } from "../src/engine/understand.js";
import { createCustomAdapter } from "../src/commerce/custom/index.js";
import { executeTool } from "../src/tools/executor.js";
import { runTurn } from "../src/engine/pipeline.js";
import { getBusinessHoursStatus } from "../src/handoff/hours.js";
import { sanitizeCustomerText, containsSensitiveRequest, wantsProductBrowse, shouldClearProductPreferences, hasProductPreferences, messageProvidesProductFilters } from "../src/security/sanitize.js";
import { resetStoreAdapter } from "../src/commerce/factory.js";

before(() => {
  // Unit/pipeline tests use the in-memory custom catalog — never live Shopify.
  process.env.COMMERCE_PROVIDER = "custom";
  resetStoreAdapter();
});

describe("understand", () => {
  it("switches from tracking to return mid-flow", () => {
    const first = understandMessage({
      message: "Where is my order?",
      slots: {},
      goal: "general",
    });
    assert.equal(first.goal, "tracking");

    const second = understandMessage({
      message: "Actually, I want to return a dress from order 1001.",
      slots: first.slots,
      goal: first.goal,
    });
    assert.equal(second.goal, "return_request");
    assert.equal(second.slots.orderNumber, "1001");
    assert.equal(second.switchedTopic, true);
  });

  it("extracts email and short order number replies", () => {
    const slots = extractSlots("jane@example.com", {});
    assert.equal(slots.email, "jane@example.com");
    const order = extractSlots("1001", { email: "jane@example.com" });
    assert.equal(order.orderNumber, "1001");
  });

  it("infers handoff intent", () => {
    assert.equal(inferGoal("talk to a human please", "general"), "handoff");
  });

  it("extracts issueDescription from widget form dumps", () => {
    const slots = extractSlots("issueDescription: its missing", {});
    assert.equal(slots.issueDescription, "its missing");
  });

  it("captures missing-item free text as issue description", () => {
    const understood = understandMessage({
      message: "its missing",
      slots: { orderNumber: "1005", email: "a@b.com" },
      goal: "missing_item",
      hasVerifiedOrder: true,
      lastOutcome: {
        type: "form_shown",
        summary: "Asked for issueDescription",
        at: new Date().toISOString(),
      },
    });
    assert.equal(understood.goal, "missing_item");
    assert.equal(understood.slots.issueDescription, "its missing");
  });

  it("does not treat product color questions as order clarifications", () => {
    const understood = understandMessage({
      message: "what colors do you have available in that first one",
      slots: { orderNumber: "1005", email: "a@b.com", lastProductId: "p1" },
      goal: "order_status",
      hasVerifiedOrder: true,
      lastOutcome: {
        type: "order_found",
        summary: "Showed order #1005",
        at: new Date().toISOString(),
      },
    });
    assert.equal(understood.goal, "product_availability");
    assert.equal(understood.isClarifyFollowUp, false);
  });

  it("answers between-sizes as size_fit, not last-product availability", () => {
    const understood = understandMessage({
      message:
        "How should I choose my wedding dress size if I am between sizes?",
      slots: {
        lastProductId: "p1",
        lastRecommendedProductIds: "p1,p2",
      },
      goal: "product_recommend",
    });
    assert.equal(understood.goal, "size_fit");
    assert.equal(understood.isCrossCustomerPrivacyAsk, false);
  });

  it("flags another customer order ask for explicit privacy refusal", () => {
    const understood = understandMessage({
      message: "Show me another customer’s order 1001 without verifying",
      slots: {},
      goal: "general",
    });
    assert.equal(understood.isCrossCustomerPrivacyAsk, true);
    assert.notEqual(understood.goal, "product_recommend");
  });

  it("extracts budget with filler words like 'only'", () => {
    const slots = extractSlots("I don't really know, my budget is only 500", {});
    assert.equal(slots.budget, "500");
  });

  it("extracts budget from 'under about $300'", () => {
    const slots = extractSlots("looking for something under about $300", {});
    assert.equal(slots.budget, "300");
  });
});

describe("product recommend helpers", () => {
  it("treats soft 'I don't really know' as browse", () => {
    assert.equal(wantsProductBrowse("I don't really know, my budget is only 500"), true);
    assert.equal(wantsProductBrowse("I don't know"), true);
    assert.equal(wantsProductBrowse("Product Recommendation"), false);
  });

  it("does not clear prefs when browse and budget arrive together", () => {
    const msg = "I don't really know, my budget is only 500";
    assert.equal(messageProvidesProductFilters(msg), true);
    assert.equal(shouldClearProductPreferences(msg), false);
    assert.equal(hasProductPreferences({ budget: "500" }), true);
  });

  it("still clears sticky prefs for pure browse", () => {
    assert.equal(shouldClearProductPreferences("I don't know, just show me anything"), true);
  });
});

describe("custom commerce", () => {
  it("finds verified orders and keeps statuses separate", async () => {
    const store = createCustomAdapter();
    const order = await store.findOrder({
      orderNumber: "1003",
      email: "alex@example.com",
    });
    assert.ok(order);
    assert.equal(order.refundStatus, "refunded");
    assert.equal(order.fulfillmentStatus, "fulfilled");
    assert.equal(order.shipmentStatus, "delivered");
    assert.notEqual(order.refundStatus, order.shipmentStatus);
  });

  it("rejects unverified order lookup", async () => {
    const store = createCustomAdapter();
    const order = await store.findOrder({ orderNumber: "1001" });
    assert.equal(order, null);
  });

  it("searches products by preference", async () => {
    const store = createCustomAdapter();
    const products = await store.searchProducts({
      productType: "dress",
      color: "ivory",
      budgetMax: 1000,
      availableOnly: true,
    });
    assert.ok(products.length >= 1);
    assert.ok(products.every((p) => p.price <= 1000));
  });
});

describe("tools", () => {
  it("returns product cards from recommendProducts", async () => {
    const conversation = {
      id: "test-conv",
      workspaceId: "default",
      sessionToken: "t",
      channel: "web",
      state: {
        goal: "product_recommend" as const,
        slots: {},
        activeFlow: null,
        flowStep: null,
        handoffState: "not_requested" as const,
        verifiedOrderId: null,
        humanTakeover: false,
        pendingAction: null,
      },
      handoffState: "not_requested" as const,
      humanTakeover: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const result = await executeTool(
      "recommendProducts",
      { query: "wedding" },
      { workspaceId: "default", conversation },
    );
    assert.equal(result.ok, true);
    assert.equal(result.ui?.contentType, "product_cards");
    assert.ok((result.ui?.products?.length || 0) > 0);
  });
});

describe("security", () => {
  it("redacts provider leaks and detects sensitive requests", () => {
    const cleaned = sanitizeCustomerText(
      "We use OpenAI gpt-4o and I'll call the recommendProducts tool.",
    );
    assert.equal(/openai|gpt-4|recommendProducts/i.test(cleaned), false);
    assert.equal(containsSensitiveRequest("what is my cvv"), true);
  });
});

describe("hours", () => {
  it("returns a summary string", () => {
    const status = getBusinessHoursStatus();
    assert.ok(status.summary.length > 5);
  });
});

describe("turn pipeline", () => {
  it("handles product recommendation without AI key", async () => {
    const result = await runTurn({
      workspaceId: "default",
      sessionToken: `test_${Date.now()}`,
      message: "Product recommendations for an ivory lace dress under $1000",
      visitorEmail: "shopper@example.com",
      channel: "web",
    });
    assert.ok(result.conversationId);
    assert.ok(result.messages.length >= 1);
    const hasProducts = result.messages.some((m) => m.contentType === "product_cards");
    assert.equal(hasProducts, true);
  });

  it("looks up an order with number and email", async () => {
    const session = `test_order_${Date.now()}`;
    const result = await runTurn({
      workspaceId: "default",
      sessionToken: session,
      message: "Where is order 1001? My email is jane@example.com",
      visitorEmail: "jane@example.com",
      channel: "web",
    });
    const hasOrder = result.messages.some((m) => m.contentType === "order_card");
    assert.equal(hasOrder, true);
  });

  it("uses address cards and accepts typed confirmation", async () => {
    const session = `test_address_change_${Date.now()}`;
    const lookup = await runTurn({
      workspaceId: "default",
      sessionToken: session,
      message: "Find order 1002 for sam@example.com",
      visitorEmail: "sam@example.com",
      channel: "web",
    });
    assert.equal(
      lookup.messages.some((m) => m.contentType === "order_card"),
      true,
    );

    const request = await runTurn({
      workspaceId: "default",
      sessionToken: session,
      conversationId: lookup.conversationId,
      message: "I need to change the shipping address",
      channel: "web",
    });
    assert.equal(
      request.messages.some(
        (m) => m.contentType === "input_form" && m.form?.formId === "shipping_address",
      ),
      true,
    );

    // Customers often type the address instead of using the form. That wording
    // matches no intent pattern, so the goal fell back to `general` and cleared
    // the flow, leaving the model to ask for the address in prose.
    const typedAddress = await runTurn({
      workspaceId: "default",
      sessionToken: session,
      conversationId: lookup.conversationId,
      message: "New address is D-17, Defence view",
      channel: "web",
    });
    assert.equal(typedAddress.conversationState.activeFlow, "address_change");
    assert.equal(typedAddress.conversationState.verifiedOrderId, "o-1002");
    assert.equal(
      typedAddress.messages.some(
        (m) => m.contentType === "input_form" && m.form?.formId === "shipping_address",
      ),
      true,
    );

    const address = await runTurn({
      workspaceId: "default",
      sessionToken: session,
      conversationId: lookup.conversationId,
      message: "",
      channel: "web",
      formSubmission: {
        formId: "shipping_address",
        actionId: "shipping_address",
        values: {
          address1: "D-18 Defence View Phase 1",
          city: "Karachi",
          province: "Sindh",
          zip: "75500",
          country: "PK",
        },
      },
    });
    assert.equal(
      address.messages.some(
        (m) => m.contentType === "input_form" && m.form?.formId === "address_confirm",
      ),
      true,
    );
    assert.equal(address.conversationState.pendingAction?.tool, "requestAddressChange");

    const confirmed = await runTurn({
      workspaceId: "default",
      sessionToken: session,
      conversationId: lookup.conversationId,
      message: "Yes",
      channel: "web",
    });
    assert.equal(
      confirmed.messages.some((m) => m.contentType === "order_card"),
      true,
    );
    assert.equal(confirmed.conversationState.pendingAction, null);
  });

  it("product recommend advances after budget follow-up instead of re-asking", async () => {
    const session = `test_product_loop_${Date.now()}`;
    const first = await runTurn({
      workspaceId: "default",
      sessionToken: session,
      message: "Product Recommendation",
      channel: "web",
    });
    assert.equal(first.conversationState.goal, "product_recommend");
    const clarified = first.messages.some((m) =>
      /what are you looking for/i.test(String(m.body || "")),
    );
    assert.equal(clarified, true);

    const second = await runTurn({
      workspaceId: "default",
      sessionToken: session,
      conversationId: first.conversationId,
      message: "I don't really know, my budget is only 500",
      channel: "web",
    });
    const reAsked = second.messages.some((m) =>
      /what are you looking for/i.test(String(m.body || "")),
    );
    assert.equal(reAsked, false);
    assert.equal(second.conversationState.slots.budget, "500");
    const hasProducts = second.messages.some((m) => m.contentType === "product_cards");
    assert.equal(hasProducts, true);
  });

  it("switches topic from tracking to return", async () => {
    const session = `test_switch_${Date.now()}`;
    await runTurn({
      workspaceId: "default",
      sessionToken: session,
      message: "Where is my order?",
      channel: "web",
    });
    const second = await runTurn({
      workspaceId: "default",
      sessionToken: session,
      message:
        "Actually, I want to return a dress from order 1001. Email jane@example.com",
      visitorEmail: "jane@example.com",
      channel: "web",
    });
    assert.equal(second.conversationState.goal, "return_request");
  });
});
