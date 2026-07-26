async function turn(token, msg, email) {
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
    if (m.body) bits.push(m.body.slice(0, 170).replace(/\n/g, " "));
    if (m.form) bits.push(`form=${m.form.formId}`);
    if (m.order) bits.push(`order=#${m.order.orderNumber}`);
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
const goodEmail = "kashif.61764@iqra.edu.pk";
const badEmail = "kaashifahmed02@gmail.com";

// A) Wrong email → follow-up questions + show again
{
  const t = "nf" + stamp;
  await turn(t, "Where is my order?", badEmail);
  const fail = await turn(t, `Order #1002, ${badEmail}`, badEmail);
  assert(
    /no matching|couldn.?t match|not found/i.test(
      fail.messages?.map((m) => m.body || "").join(" ") || "",
    ),
    "wrong email → not found",
  );
  const q = await turn(t, "is it not correct?", badEmail);
  assert(
    !/no matching order found for that number and contact details/i.test(
      q.messages?.[0]?.body || "",
    ),
    "does not blindly repeat not-found error",
  );
  assert(
    /email|match|order|try|checkout|records/i.test(q.messages?.[0]?.body || ""),
    "explains the mismatch in context",
  );
  const again = await turn(t, "show again", badEmail);
  assert(
    again.messages?.some((m) => m.contentType === "input_form"),
    "show again reopens lookup form",
  );
}

// B) Correct lookup → bare "why?" → text answer, no card
{
  const t = "why" + stamp;
  await turn(t, "Where is my order?", goodEmail);
  const found = await turn(t, `Order #1002, ${goodEmail}`, goodEmail);
  assert(
    found.messages?.some((m) => m.contentType === "order_card"),
    "order card on first lookup",
  );
  const why = await turn(t, "why?", goodEmail);
  assert(
    !why.messages?.some((m) => m.contentType === "order_card"),
    "bare why? does not re-show card",
  );
  assert(
    /pack|prepar|ship|placed|fulfill|payment|pending/i.test(why.messages?.[0]?.body || ""),
    "why? explains order context",
  );
}

// C) Correction from 1002 → 1001
{
  const t = "corr" + stamp;
  await turn(t, "Where is my order?", goodEmail);
  await turn(t, `Order #1002, ${goodEmail}`, goodEmail);
  const corr = await turn(t, `sorry, I said 1001, ${goodEmail}`, goodEmail);
  assert(
    corr.messages?.some(
      (m) => m.contentType === "order_card" && m.order?.orderNumber === "1001",
    ) ||
      /#?1001/.test(corr.messages?.map((m) => m.body || "").join(" ") || ""),
    "correction looks up order 1001",
  );
  assert(
    !corr.messages?.some(
      (m) => m.contentType === "order_card" && m.order?.orderNumber === "1002",
    ),
    "correction does not keep showing 1002",
  );
}

console.log("\nAll context smoke checks passed.");
