async function turn(token, msg) {
  const r = await fetch("http://127.0.0.1:5600/v1/chat/turn", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionToken: token,
      message: msg,
      visitorEmail: "test@example.com",
    }),
  });
  const j = await r.json();
  console.log("> " + msg);
  for (const m of j.data?.messages || []) {
    console.log(
      " ",
      m.contentType,
      (m.body || "").slice(0, 160),
      m.products ? "n=" + m.products.length : "",
    );
  }
}

const t = "rec" + Date.now();
await turn(t, "can you recommend me a product");
await turn(t, "wedding dress");
await turn(t, "sure, just show popular ones");
