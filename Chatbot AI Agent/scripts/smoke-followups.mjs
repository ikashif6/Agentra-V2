async function turn(token, msg, email = "kashif.61764@iqra.edu.pk") {
  const r = await fetch("http://127.0.0.1:5600/v1/chat/turn", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionToken: token,
      message: msg,
      visitorEmail: email,
    }),
  });
  const j = await r.json();
  const lines = (j.data?.messages || []).map((m) => {
    const bits = [m.contentType];
    if (m.body) bits.push(m.body.slice(0, 160).replace(/\n/g, " "));
    if (m.form) bits.push(`form=${m.form.formId}`);
    if (m.order) bits.push(`order=#${m.order.orderNumber}`);
    if (m.products) bits.push(`products=${m.products.length}`);
    return "  · " + bits.join(" | ");
  });
  console.log(`\n> ${msg}`);
  console.log(lines.join("\n") || "  (no messages)");
  return j.data;
}

function assert(cond, msg) {
  if (!cond) throw new Error("FAIL: " + msg);
  console.log("  OK:", msg);
}

const stamp = Date.now();

// Follow-up: why not packed → text answer, no second order card
{
  const t = "fu" + stamp;
  const a = await turn(t, "Where is my order?");
  assert(
    a.messages?.some((m) => m.contentType === "input_form"),
    "order form first",
  );
  const b = await turn(t, "Order #1002, kashif.61764@iqra.edu.pk");
  assert(
    b.messages?.some((m) => m.contentType === "order_card"),
    "order card on lookup",
  );
  const c = await turn(t, "why is it not packed");
  assert(
    !c.messages?.some((m) => m.contentType === "order_card"),
    "follow-up does not re-show order card",
  );
  const body = c.messages?.[0]?.body || "";
  assert(/pack|prepar|fulfill|placed|warehouse|not packed/i.test(body), "explains packing status");
  assert(!/already (been )?(packed|shipped)/i.test(body), "does not claim already packed/shipped");
  assert(!/here.?s what i found/i.test(body), "not canned lookup caption");
}

// Off-topic
{
  const t = "ot" + stamp;
  const a = await turn(t, "what model are you using?");
  assert(/store|shop|orders|products|can.?t help/i.test(a.messages?.[0]?.body || ""), "off-topic declined");
}

// Policy rewrite still works
{
  const t = "pol2" + stamp;
  const a = await turn(t, "Return or refund policy");
  assert(!/^Returns and refunds\s*:/i.test((a.messages?.[0]?.body || "").trim()), "policy rewritten");
}

// Vague still ok
{
  const t = "vg" + stamp;
  const a = await turn(t, "why");
  assert(
    !/i can help with orders, tracking, returns, products, and store policies/i.test(
      a.messages?.[0]?.body || "",
    ),
    "short why not capability dump",
  );
}

// When will it ship follow-up
{
  const t = "ship" + stamp;
  await turn(t, "Order #1002, kashif.61764@iqra.edu.pk");
  const a = await turn(t, "when will it ship?");
  assert(!a.messages?.some((m) => m.contentType === "order_card"), "ship Q no card");
  assert(/ship|track|prepar|pack|yet/i.test(a.messages?.[0]?.body || ""), "ship Q answered");
  assert(!/marked shipped|already.*shipped|on the way/i.test(a.messages?.[0]?.body || ""), "does not claim shipped early");
}

console.log("\nAll follow-up smoke checks passed.");
