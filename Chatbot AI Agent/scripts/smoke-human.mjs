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
    if (m.body) bits.push(m.body.slice(0, 140).replace(/\n/g, " "));
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

// 1. Vague replies should not spam capability blurb
{
  const t = "vague" + stamp;
  const a = await turn(t, "why");
  assert(
    !/i can help with orders, tracking, returns, products, and store policies/i.test(
      a.messages?.[0]?.body || "",
    ),
    "vague 'why' is not capability dump",
  );
  const b = await turn(t, "nothing");
  assert(
    !/i can help with orders, tracking, returns, products, and store policies/i.test(
      b.messages?.[0]?.body || "",
    ),
    "vague 'nothing' is not capability dump",
  );
}

// 2. Policy should be rewritten (not "Returns and refunds: ...")
{
  const t = "pol" + stamp;
  const a = await turn(t, "Return or refund policy");
  const body = a.messages?.[0]?.body || "";
  assert(body.length > 40, "policy answer present");
  assert(!/^Returns and refunds\s*:/i.test(body.trim()), "policy not raw dump");
  assert(/return|refund|14/i.test(body), "policy keeps key facts");
}

// 3. Order lookup uses form card
{
  const t = "ord" + stamp;
  const a = await turn(t, "Where is my order?");
  assert(
    a.messages?.some((m) => m.contentType === "input_form" && m.form?.formId === "order_lookup"),
    "order lookup form shown",
  );
  const b = await turn(t, "Order #1002, kashif.61764@iqra.edu.pk");
  assert(
    b.messages?.some((m) => m.contentType === "order_card"),
    "order card returned for #1002",
  );
}

// 4. Product recommend asks then returns cards
{
  const t = "rec" + stamp;
  const a = await turn(t, "can you recommend me a product");
  assert(
    /looking for|dress|veil|color|budget/i.test(a.messages?.[0]?.body || ""),
    "asks preferences first",
  );
  const b = await turn(t, "wedding dress");
  assert(
    b.messages?.some((m) => m.contentType === "product_cards" && (m.products?.length || 0) > 0),
    "product cards after preference",
  );
}

// 5. Address change shows address form after order verify
{
  const t = "addr" + stamp;
  const a = await turn(
    t,
    "I want to change the shipping address for order 1002. Email kashif.61764@iqra.edu.pk",
  );
  assert(
    a.messages?.some((m) => m.contentType === "order_card") ||
      a.messages?.some((m) => m.contentType === "input_form"),
    "address flow shows order or form",
  );
  const hasAddrForm = a.messages?.some(
    (m) => m.contentType === "input_form" && m.form?.formId === "shipping_address",
  );
  assert(hasAddrForm, "shipping address form shown");
}

console.log("\nAll smoke checks passed.");
