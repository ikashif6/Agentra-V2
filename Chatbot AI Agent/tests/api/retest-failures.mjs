/** Re-test previously failing cases only */
import { performance } from "node:perf_hooks";

const BASE = process.env.TEST_API_BASE || "http://127.0.0.1:5610";
const WS = "vastora-test";

async function api(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { res, json };
}

async function session(email) {
  const token = `fix-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const { json } = await api("/v1/chat/session", {
    workspaceId: WS,
    sessionToken: token,
    visitorEmail: email,
    channel: "web",
  });
  return {
    sessionToken: json.data.sessionToken,
    conversationId: json.data.conversationId,
  };
}

async function turn(s, message, email) {
  const t0 = performance.now();
  const { res, json } = await api("/v1/chat/turn", {
    workspaceId: WS,
    sessionToken: s.sessionToken,
    conversationId: s.conversationId,
    message,
    visitorEmail: email || undefined,
    channel: "web",
  });
  const msgs = json.data?.messages || [];
  const body = msgs.map((m) => m.body || "").join("\n");
  return { res, data: json.data, msgs, body, ms: Math.round(performance.now() - t0) };
}

function check(id, ok, actual) {
  console.log(`${ok ? "✓" : "✗"} ${id}: ${(actual || "").slice(0, 180)}`);
  return ok;
}

let fails = 0;

{
  const s = await session("oos@example.com");
  const r = await turn(s, "Is the Maya Crepe Sheath Dress in stock?", "oos@example.com");
  if (!check("PRD-004", /out of stock|isn'?t available|not (in )?stock|notify/i.test(r.body), r.body)) fails++;
}
{
  const s = await session("mat@example.com");
  const r = await turn(s, "What material is the Emilia Lace Wedding Dress?", "mat@example.com");
  if (!check("PRD-005", /lace|satin|made of/i.test(r.body), r.body)) fails++;
}
{
  const s = await session("cmp@example.com");
  const r = await turn(s, "Compare the Emilia and Sofia dresses for me", "cmp@example.com");
  if (!check("PRD-006", /emilia/i.test(r.body) && /sofia/i.test(r.body), r.body)) fails++;
}
{
  const s = await session("sticky@example.com");
  await turn(s, "Show me ivory dresses under $500", "sticky@example.com");
  const r = await turn(s, "Actually never mind — just surprise me with anything", "sticky@example.com");
  const stuck = /nothing lined up|couldn.?t find|don.?t have a strong match/i.test(r.body) && /ivory|\$500|500/i.test(r.body);
  const cards = r.msgs.some((m) => m.contentType === "product_cards" && (m.products || []).length);
  if (!check("PRD-009", cards || !stuck, r.body)) fails++;
}
{
  const s = await session("alex@example.com");
  const r = await turn(s, "Was order 1003 refunded? Email alex@example.com", "alex@example.com");
  if (!check("RET-006", /refund/i.test(r.body) && !/couldn.?t find|no matching/i.test(r.body), r.body)) fails++;
}
{
  const s = await session("bis@example.com");
  const r = await turn(
    s,
    "Notify me when the Maya Crepe Sheath Dress is back in stock. Email bis@example.com",
    "bis@example.com",
  );
  if (
    !check(
      "BIS-001",
      (/notify|alert|you.?re set|back in stock|isn'?t available|waitlist/i.test(r.body) &&
        /maya|crepe/i.test(r.body) &&
        !/couldn.?t find|which product|confirm the specific product/i.test(r.body)) ||
        /you.?re set|i.?ll notify|i.?ll email/i.test(r.body),
      r.body,
    )
  )
    fails++;
}
{
  const s = await session("bis2@example.com");
  const r = await turn(
    s,
    "Put me on a waitlist for the Emilia Lace Wedding Dress",
    "bis2@example.com",
  );
  if (!check("BIS-002", /in stock|available|don.?t need|view more|already|no need/i.test(r.body), r.body)) fails++;
}
{
  const s = await session("de@example.com");
  const r = await turn(s, "Ich möchte mit einem Menschen sprechen", "de@example.com");
  if (!check("MUL-003", r.body.length > 5 && !/openai|api key/i.test(r.body), r.body)) fails++;
}

console.log(fails ? `\n${fails} still failing` : "\nAll previously failing cases passed");
process.exit(fails ? 1 : 0);
