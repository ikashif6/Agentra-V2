import type { InputFormPayload } from "@chatbot/shared";
import type { FlowId } from "./flows/index.js";

export function orderLookupForm(): InputFormPayload {
  return {
    formId: "order_lookup",
    title: "Verify your order",
    fields: [
      {
        name: "orderNumber",
        label: "Order number",
        required: true,
        placeholder: "e.g. 1002",
      },
      {
        name: "email",
        label: "Email on the order",
        type: "email",
        required: true,
        placeholder: "you@example.com",
      },
    ],
    submitLabel: "Look up order",
    actionId: "order_lookup",
  };
}

export function shippingAddressForm(summary?: string[]): InputFormPayload {
  return {
    formId: "shipping_address",
    title: "New shipping address",
    summary,
    fields: [
      {
        name: "name",
        label: "Full name",
        required: false,
        placeholder: "Name on the shipment",
      },
      {
        name: "address1",
        label: "Street address",
        required: true,
        placeholder: "Street and number",
      },
      {
        name: "address2",
        label: "Apartment, suite, etc.",
        required: false,
        placeholder: "Optional",
      },
      { name: "city", label: "City", required: true },
      { name: "province", label: "State / Province", required: true },
      { name: "zip", label: "Postal / ZIP code", required: true },
      {
        name: "country",
        label: "Country",
        required: true,
        placeholder: "e.g. PK, US, GB",
      },
      { name: "phone", label: "Phone", type: "tel", required: false },
    ],
    submitLabel: "Continue",
    actionId: "shipping_address",
  };
}

export function contactForm(): InputFormPayload {
  return {
    formId: "contact_request",
    title: "How can we reach you?",
    fields: [
      {
        name: "email",
        label: "Email",
        type: "email",
        required: true,
        placeholder: "you@example.com",
      },
      {
        name: "phone",
        label: "Phone",
        type: "tel",
        required: false,
        placeholder: "Optional",
      },
    ],
    submitLabel: "Submit",
    actionId: "contact_request",
  };
}

export function returnReasonForm(): InputFormPayload {
  return {
    formId: "return_reason",
    title: "Return reason",
    fields: [
      {
        name: "returnReason",
        label: "Why are you returning this?",
        required: true,
        placeholder: "e.g. wrong size, damaged, changed mind",
      },
    ],
    submitLabel: "Continue",
    actionId: "return_reason",
  };
}

export function damageReportForm(): InputFormPayload {
  return {
    formId: "damage_report",
    title: "Report an issue",
    fields: [
      {
        name: "issueDescription",
        label: "What went wrong?",
        required: true,
        placeholder: "Describe the damaged, missing, or incorrect item",
      },
    ],
    submitLabel: "Submit report",
    actionId: "damage_report",
  };
}

export function backInStockForm(): InputFormPayload {
  return {
    formId: "back_in_stock",
    title: "Get notified when it’s back",
    summary: [
      "We’ll email you when this item is available again. You can add a size or color preference if you like.",
    ],
    fields: [
      {
        name: "email",
        label: "Email",
        type: "email",
        required: true,
        placeholder: "you@example.com",
      },
      {
        name: "phone",
        label: "Phone",
        type: "tel",
        required: false,
        placeholder: "Optional",
      },
      {
        name: "size",
        label: "Preferred size",
        required: false,
        placeholder: "e.g. M or 8",
      },
      {
        name: "color",
        label: "Preferred color",
        required: false,
        placeholder: "e.g. ivory",
      },
    ],
    submitLabel: "Notify me",
    actionId: "back_in_stock",
  };
}

export function exchangeReasonForm(): InputFormPayload {
  return {
    formId: "exchange_reason",
    title: "Exchange details",
    fields: [
      {
        name: "exchangeReason",
        label: "Why are you exchanging?",
        required: true,
        placeholder: "e.g. need a different size",
      },
      {
        name: "desiredSize",
        label: "Desired size",
        required: false,
        placeholder: "e.g. M",
      },
      {
        name: "desiredColor",
        label: "Desired color",
        required: false,
        placeholder: "e.g. ivory",
      },
    ],
    submitLabel: "Continue",
    actionId: "exchange_reason",
  };
}

export function partialReturnForm(): InputFormPayload {
  return {
    formId: "partial_return",
    title: "Partial return",
    fields: [
      {
        name: "partialReturnItems",
        label: "Which item(s) to return?",
        required: true,
        placeholder: "Product name(s), comma-separated",
      },
      {
        name: "returnReason",
        label: "Reason",
        required: true,
        placeholder: "e.g. wrong size, changed mind",
      },
    ],
    submitLabel: "Continue",
    actionId: "partial_return",
  };
}

export function customProductForm(): InputFormPayload {
  return {
    formId: "custom_product",
    title: "Custom product request",
    fields: [
      {
        name: "email",
        label: "Email",
        type: "email",
        required: true,
        placeholder: "you@example.com",
      },
      {
        name: "phone",
        label: "Phone",
        type: "tel",
        required: false,
      },
      {
        name: "customRequestDescription",
        label: "What do you need?",
        required: true,
        placeholder: "Describe the custom dress / alterations / design",
      },
      { name: "budget", label: "Budget", required: false },
      { name: "size", label: "Size", required: false },
      { name: "color", label: "Color", required: false },
    ],
    submitLabel: "Submit request",
    actionId: "custom_product_request",
  };
}

export function formForMissing(
  flow: FlowId | null,
  missing: string[],
): InputFormPayload | null {
  if (!flow || !missing.length) return null;

  // Always verify order first when needed
  if (missing.includes("orderNumber") || missing.includes("email")) {
    if (
      [
        "order_lookup",
        "return",
        "exchange",
        "partial_return",
        "cancellation",
        "address_change",
        "damage_report",
      ].includes(flow)
    ) {
      return orderLookupForm();
    }
    if (flow === "contact" || flow === "handoff") {
      return contactForm();
    }
    if (flow === "back_in_stock") {
      return backInStockForm();
    }
    if (flow === "custom_product") {
      return customProductForm();
    }
  }

  if (flow === "address_change") {
    if (
      missing.some((m) =>
        ["addressLine1", "city", "state", "zip", "country"].includes(m),
      )
    ) {
      return shippingAddressForm();
    }
  }

  if (flow === "return" && missing.includes("returnReason")) {
    return returnReasonForm();
  }

  if (flow === "exchange" && missing.includes("exchangeReason")) {
    return exchangeReasonForm();
  }

  if (
    flow === "partial_return" &&
    (missing.includes("partialReturnItems") || missing.includes("returnReason"))
  ) {
    return partialReturnForm();
  }

  if (flow === "damage_report" && missing.includes("issueDescription")) {
    return damageReportForm();
  }

  if (flow === "back_in_stock" && missing.includes("email")) {
    return backInStockForm();
  }

  if (
    flow === "custom_product" &&
    (missing.includes("email") || missing.includes("customRequestDescription"))
  ) {
    return customProductForm();
  }

  return null;
}

export function introForForm(form: InputFormPayload): string {
  switch (form.formId) {
    case "order_lookup":
      return "Sure — enter your order number and the email on the order below.";
    case "shipping_address":
      return "Please enter the new shipping address below.";
    case "contact_request":
      return "Share your contact details below and we’ll follow up.";
    case "return_reason":
      return "Tell us why you’d like to return the item.";
    case "exchange_reason":
      return "Tell us what you’d like to exchange for (size/color) and why.";
    case "partial_return":
      return "Which items should we return, and why?";
    case "damage_report":
      return "Describe the issue below and we’ll open a report.";
    case "back_in_stock":
      return "Share your email below and I’ll notify you when this item is back in stock.";
    case "custom_product":
      return "Share your email and describe the custom piece you need — our team will follow up.";
    default:
      return "Please fill in the details below.";
  }
}
