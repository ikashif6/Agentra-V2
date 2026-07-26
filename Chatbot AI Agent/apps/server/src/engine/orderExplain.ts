import type { VerifiedOrderSnapshot } from "@chatbot/shared";

/** True if reply invents shipped/packed when snapshot says otherwise. */
export function replyContradictsOrderSnapshot(
  reply: string,
  snap: VerifiedOrderSnapshot,
): boolean {
  const t = reply.toLowerCase();
  const cancelled = normalizeStatus(snap.cancellationStatus) === "cancelled";
  if (cancelled) {
    if (
      /hasn'?t been cancel|not (been )?cancel|isn'?t cancel|not cancel|still (active|open|unfulfill)|marked as pending|no.*cancel|wasn'?t cancel|sent in error/i.test(
        t,
      )
    ) {
      return true;
    }
    // Describing as active unfulfilled prep without acknowledging cancel
    if (/unfulfill|still being prepared|hasn'?t been shipped yet/i.test(t) && !/cancel/i.test(t)) {
      return true;
    }
  }

  const fulfillment = normalizeStatus(snap.fulfillmentStatus);
  const shipment = normalizeStatus(snap.shipmentStatus);
  const stillPreparing =
    !cancelled &&
    (snap.stepperCurrent === "placed" ||
      fulfillment === "unfulfilled" ||
      (!fulfillment && shipment !== "shipped" && shipment !== "delivered"));

  if (stillPreparing) {
    if (
      /\balready (been )?(packed|shipped|delivered)\b/.test(t) ||
      /\bis (packed|shipped|delivered)\b/.test(t) ||
      /\bmarked shipped\b/.test(t) ||
      /\bon the way\b/.test(t)
    ) {
      return true;
    }
  }
  if (!cancelled && (shipment === "not_shipped" || shipment === "unshipped" || !shipment)) {
    if (/\b(tracking (number|is)|carrier link|on the way)\b/.test(t) && !/won'?t|not|yet|no tracking|only appears/i.test(t)) {
      if (!/only appears|hasn'?t shipped|not shipped|no tracking/i.test(t)) return true;
    }
  }
  return false;
}

/** Human-readable explanation from verified order facts (no invented timelines). */
export function explainOrderFromSnapshot(
  snap: VerifiedOrderSnapshot,
  question: string,
): string {
  const q = question.toLowerCase();
  const n = snap.orderNumber;
  const financial = normalizeStatus(snap.financialStatus);
  const fulfillment = normalizeStatus(snap.fulfillmentStatus);
  const shipment = normalizeStatus(snap.shipmentStatus);
  const cancellation = normalizeStatus(snap.cancellationStatus);

  if (cancellation === "cancelled") {
    return `Order #${n} is cancelled — it won’t ship. If you received a cancellation email, that matches what I’m seeing on the order. Payment shows as ${humanStatus(snap.financialStatus)}. Want help with anything else?`;
  }

  const paid = financial === "paid" || financial === "partially_paid";
  const unfulfilled = fulfillment === "unfulfilled" || fulfillment === "null" || !fulfillment;
  const packed =
    fulfillment === "fulfilled" ||
    fulfillment === "partial" ||
    snap.stepperCurrent === "packed";
  const shipped =
    shipment === "shipped" ||
    shipment === "in_transit" ||
    snap.stepperCurrent === "shipped";
  const delivered =
    shipment === "delivered" || snap.stepperCurrent === "delivered";
  const stillPreparing =
    snap.stepperCurrent === "placed" ||
    (unfulfilled && !shipped && !delivered);

  const nextSteps: string[] = [];
  if (snap.cancelEligible) nextSteps.push("cancel");
  if (snap.addressChangeEligible) nextSteps.push("update the shipping address");
  const nextHint = nextSteps.length
    ? ` While it’s still unfulfilled, I can help you ${nextSteps.join(" or ")}.`
    : "";

  if (/pack|fulfill|prepar|process/i.test(q)) {
    if (delivered) {
      return `Order #${n} has already been delivered, so packing is complete. Want help with a return or something else on this order?`;
    }
    if (shipped) {
      return `Order #${n} has already been packed and shipped${
        snap.trackingNumber ? ` (tracking ${snap.trackingNumber})` : ""
      }. It’s past the packing stage.`;
    }
    if (packed && !shipped) {
      return `Order #${n} is packed and waiting to go out with the carrier. Tracking usually appears once it’s scanned as shipped.`;
    }
    if (stillPreparing || unfulfilled) {
      return `Order #${n} is ${
        paid ? "paid and confirmed" : `showing payment as ${humanStatus(snap.financialStatus)}`
      }, but it hasn’t been packed yet — it’s still being prepared. The tracker stays on Placed until warehouse packing is done; then it moves to Packed and Shipped.${nextHint}`;
    }
  }

  if (/ship|track|carrier|deliver|arriv/i.test(q)) {
    if (delivered) {
      return `Order #${n} shows as delivered. If something’s missing or damaged, I can help with that.`;
    }
    if (shipped && snap.trackingNumber) {
      return `Order #${n} is on the way. Tracking is ${snap.trackingNumber}${
        snap.trackingUrl ? ` — you can open the carrier link from the order card` : ""
      }.`;
    }
    if (shipped) {
      return `Order #${n} is marked shipped. Tracking details will show once the carrier updates the label.`;
    }
    if (stillPreparing || unfulfilled || (packed && !shipped)) {
      return `Order #${n} hasn’t shipped yet${
        stillPreparing || unfulfilled
          ? " — it’s still being prepared (not packed)"
          : " — it’s packed and awaiting carrier pickup"
      }. Tracking only appears after it ships.${nextHint}`;
    }
  }

  if (/refund|money back/i.test(q)) {
    const rs = humanStatus(snap.refundStatus);
    if (/refunded/i.test(String(snap.refundStatus))) {
      return `For order #${n}, the refund shows as ${rs}. Payment status is ${humanStatus(snap.financialStatus)}. Banks often take 5–10 business days after we issue it for the money to appear.`;
    }
    if (/partial/i.test(String(snap.refundStatus))) {
      return `Order #${n} has a partial refund on file (refund status: ${rs}; payment: ${humanStatus(snap.financialStatus)}).`;
    }
    return `I don’t see a refund issued yet for order #${n} (refund status: ${rs}; payment: ${humanStatus(snap.financialStatus)}). I can re-check live status, or connect you with an agent if you need a refund started.`;
  }

  if (/cancel/i.test(q)) {
    if (cancellation === "cancelled") {
      return `Order #${n} is already cancelled.`;
    }
    if (snap.cancelEligible) {
      return `Order #${n} can still be cancelled because it hasn’t been fulfilled yet. Say the word if you want me to start that.`;
    }
    return `Order #${n} can’t be cancelled now (fulfillment is ${humanStatus(snap.fulfillmentStatus)}). After delivery, a return may be the path instead.`;
  }

  if (/pay|paid|payment|money|charg/i.test(q)) {
    return `Payment on order #${n} is ${humanStatus(snap.financialStatus)}. Fulfillment is ${humanStatus(snap.fulfillmentStatus)} — those update separately.`;
  }

  // Generic status summary for other follow-ups (including bare "why?")
  return `On order #${n}: payment is ${humanStatus(snap.financialStatus)}, fulfillment is ${humanStatus(snap.fulfillmentStatus)}, and shipment is ${humanStatus(snap.shipmentStatus)}.${
    stillPreparing || unfulfilled
      ? " It hasn’t been packed or shipped yet — it’s still being prepared, so the tracker stays on Placed."
      : ""
  }${nextHint} What else would you like to know about it?`;
}

function normalizeStatus(raw: string | undefined): string {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function humanStatus(raw: string): string {
  return (raw || "unknown").replace(/_/g, " ");
}

export function formatOrderSnapshotForPrompt(snap: VerifiedOrderSnapshot): string {
  const cancelled =
    String(snap.cancellationStatus || "").toLowerCase() === "cancelled";
  return [
    `order #${snap.orderNumber}`,
    cancelled
      ? "PRIMARY_STATUS=CANCELLED (order will not ship — do not describe as active/unfulfilled)"
      : "",
    `cancellationStatus=${snap.cancellationStatus}`,
    `financialStatus=${snap.financialStatus}`,
    `fulfillmentStatus=${snap.fulfillmentStatus}`,
    `shipmentStatus=${snap.shipmentStatus}`,
    `refundStatus=${snap.refundStatus}`,
    snap.stepperCurrent ? `stepper=${snap.stepperCurrent}` : "",
    snap.trackingNumber ? `tracking=${snap.trackingNumber}` : "",
    snap.cancelEligible ? "cancelEligible=true" : "",
    snap.addressChangeEligible ? "addressChangeEligible=true" : "",
  ]
    .filter(Boolean)
    .join(", ");
}
