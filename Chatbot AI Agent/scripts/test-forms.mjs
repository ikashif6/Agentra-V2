async function turn(token, msg) {
  const r = await fetch("http://127.0.0.1:5600/v1/chat/turn", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionToken: token,
      message: msg,
      visitorEmail: "kashif.61764@iqra.edu.pk",
    }),
  });
  const j = await r.json();
  console.log("\n> " + msg);
  for (const m of j.data?.messages || []) {
    console.log(
      " ",
      m.contentType,
      (m.body || "").slice(0, 100),
      m.form ? `form=${m.form.formId}` : "",
      m.order ? `order=#${m.order.orderNumber}` : "",
    );
  }
}

const t = "forms" + Date.now();
await turn(t, "Where is my order?");
await turn(t, "I want to change the shipping address for order 1002");
