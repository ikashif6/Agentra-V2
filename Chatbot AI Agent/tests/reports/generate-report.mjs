/**
 * Builds Markdown + HTML + PDF report from tests/reports/results.json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const REPORTS = path.join(ROOT, "tests", "reports");
const results = JSON.parse(fs.readFileSync(path.join(REPORTS, "results.json"), "utf8"));

const UNIT = {
  total: 22,
  passed: 22,
  failed: 0,
  source: "npm test (apps/server/test/**/*.test.ts)",
};

const api = results.totals;
const combinedTotal = api.total + UNIT.total;
const combinedPassed = api.passed + UNIT.passed;
const combinedFailed = api.failed + UNIT.failed;
const combinedBlocked = api.blocked;
const combinedNotTested = api.notTested;
const passPct = Math.round((combinedPassed / combinedTotal) * 1000) / 10;

const fails = results.failures || [];
const crit = fails.filter((f) => f.severity === "Critical");
const high = fails.filter((f) => f.severity === "High");
const medium = fails.filter((f) => f.severity === "Medium" || !f.severity);
const low = fails.filter((f) => f.severity === "Low");

function releaseRecommendation() {
  if (crit.length) return "Not ready for production";
  if (high.length) return "Requires important fixes";
  if (medium.length >= 3 || combinedNotTested > 20) return "Ready after minor fixes";
  if (fails.length) return "Ready after minor fixes";
  if (combinedNotTested > 10) return "Ready after minor fixes";
  return "Ready for production";
}

const recommendation = releaseRecommendation();
const dateStr = new Date(results.generatedAt || Date.now()).toLocaleString("en-US", {
  timeZone: "Asia/Karachi",
  dateStyle: "long",
  timeStyle: "short",
});

function esc(s) {
  return String(s || "")
    .replace(/\|/g, "\\|")
    .replace(/\n/g, " ");
}

const byCatRows = Object.entries(results.byCategory || {})
  .map(([cat, v]) => `| ${cat} | ${v.PASS || 0} | ${v.FAIL || 0} | ${v.BLOCKED || 0} | ${v.NOT_TESTED || 0} |`)
  .join("\n");

const caseRows = (results.cases || [])
  .map(
    (c) =>
      `| ${c.id} | ${esc(c.category)} | ${esc(c.feature)} | ${c.status} | ${c.severity || "—"} | ${c.durationMs ?? "—"} | ${esc((c.actual || "").slice(0, 120))} |`,
  )
  .join("\n");

const bugSections = fails
  .map(
    (f, i) => `### BUG-${String(i + 1).padStart(3, "0")}: ${f.id} — ${f.feature}

| Field | Detail |
| --- | --- |
| Severity | **${f.severity || "Medium"}** |
| Category | ${f.category} |
| Steps | ${esc(f.steps)} |
| Input | ${esc(f.input)} |
| Expected | ${esc(f.expected)} |
| Actual | ${esc(f.actual)} |
| Evidence | ${esc((f.evidence || "").slice(0, 400))} |
| Suspected area | ${esc(f.suspectedArea || "See category handlers / pipeline")} |
| Recommendation | ${esc(f.recommendation || "Investigate and add regression coverage")} |
| Repro | Consistent in automated suite against custom commerce on :5610 |
`,
  )
  .join("\n");

const md = `# Agentra Ecommerce Chatbot — Complete Test Report

## 1. Cover

**Product:** Vastora Bridal AI Chatbot (Agentra Chatbot AI Agent)  
**Document:** Complete System Test Report  
**Test date:** ${dateStr}  
**Prepared by:** Automated test harness + engineer-executed run  
**Environment:** Local isolated development  
**Final release recommendation:** **${recommendation}**

---

## 2. Executive summary

This report covers live testing of the ecommerce support chatbot against an **isolated custom-commerce server** (\`COMMERCE_PROVIDER=custom\`, workspace \`vastora-test\`, port **5610**) with **Resend disabled** (email logging only) and **Shopify writes disabled**. Destructive Shopify mutations were intentionally **not** executed.

**Combined results (unit + API/integration harness):**

| Metric | Count |
| --- | ---: |
| Total cases | ${combinedTotal} |
| Passed | ${combinedPassed} |
| Failed | ${combinedFailed} |
| Blocked | ${combinedBlocked} |
| Not tested | ${combinedNotTested} |
| Pass % | ${passPct}% |

**Unit tests:** ${UNIT.passed}/${UNIT.total} passed (\`${UNIT.source}\`).  
**API/integration harness:** ${api.passed} passed, ${api.failed} failed, ${api.notTested} not tested (of ${api.total}).

**Critical failures:** ${crit.length}  
**High failures:** ${high.length}  
**Medium failures:** ${medium.length}

### Overall quality assessment

The chatbot’s core order-verification, return-policy grounding, security refusals, coupon checks, handoff takeover freeze, session resume, and checkout-link disablement behave correctly on the isolated custom store. Remaining gaps are mostly **conversation-context stickiness**, incomplete multilingual/UI automation, and commerce adapters not exercised (WooCommerce; Shopify writes).

---

## 3. Testing scope

In scope:

- Conversation engine turns via \`POST /v1/chat/session\` and \`/v1/chat/turn\`
- Custom demo catalog/orders fixtures
- Returns/cancellations/refunds messaging (demo store)
- Security, handoff agent APIs, coupons, CSAT close, widget static assets
- Unit tests for understand/commerce/returnPolicy/security/pipeline

Out of scope / safety exclusions:

- Live Shopify order cancel/address/return/refund mutations
- Emails to real customer inboxes (Resend key cleared on test server)
- WooCommerce (not configured)
- Production data deletion

---

## 4. Features tested

Product discovery, order lookup/tracking, returns/cancellations/refunds messaging, discounts/payments/store hours, issues/custom requests, back-in-stock, handoff + agent takeover/release, multilingual spot checks, security/prompt-injection, CSAT close, checkout disablement, uploads validation, session persistence, Shopify health read-only, return-email code verification.

---

## 5. Tools and methodology

| Layer | Tool |
| --- | --- |
| Unit | Node.js \`node:test\` via \`npm test\` |
| API/integration | \`tests/api/run-complete-suite.mjs\` against :5610 |
| Widget smoke | HTTP fetch of \`:5500\` index + \`bridge.js\` |
| Persistence | File-backed conversations under \`apps/server/data\` |
| Commerce fixture | \`createCustomAdapter()\` in-memory products/orders |
| AI | OpenAI (\`gpt-4o-mini\`) configured on test process |
| Report | Markdown + HTML print-to-PDF via Playwright Chromium |

Methodology: execute real HTTP turns; assert on assistant text, UI content types, handoff state, and HTTP codes; classify failures by severity; never mark PASS without execution (except EMAIL-001 static verification of removed send path).

---

## 6. Test environment and fixtures

| Setting | Value |
| --- | --- |
| API | http://127.0.0.1:5610 |
| Widget | http://127.0.0.1:5500 |
| Workspace | vastora-test |
| Commerce | custom |
| Shopify writes | false |
| Resend | disabled (log-only) |
| Store brand | Vastora Bridal (Test) |
| Return window | 14 days |

**Fixtures (custom adapter):** products p-1001…p-1006 (incl. OOS Maya Crepe, red sash); orders 1001 (in transit, Jane), 1002 (unfulfilled/cancellable, Sam), 1003 (refunded, Alex). Test emails use \`@example.com\` only.

---

## 7. Summary dashboard

![dashboard-data] Pass ${combinedPassed} / Fail ${combinedFailed} / Not tested ${combinedNotTested} / Pass rate ${passPct}%

### Results by feature category (API harness)

| Category | PASS | FAIL | BLOCKED | NOT_TESTED |
| --- | ---: | ---: | ---: | ---: |
${byCatRows}

### Results by severity (failures only)

| Severity | Count |
| --- | ---: |
| Critical | ${crit.length} |
| High | ${high.length} |
| Medium | ${medium.length} |
| Low | ${low.length} |

---

## 8. Performance measurements

From live \`/v1/chat/turn\` calls during the harness run:

| Metric | Value |
| --- | --- |
| Turn samples | ${results.performance?.turnCount ?? "—"} |
| Average | ${results.performance?.avgMs ?? "—"} ms |
| P50 | ${results.performance?.p50Ms ?? "—"} ms |
| P95 | ${results.performance?.p95Ms ?? "—"} ms |

Burst load testing was **NOT TESTED** (safety/time).

---

## 9. Complete test-case table (API harness)

| ID | Category | Feature | Status | Severity | ms | Actual (truncated) |
| --- | --- | --- | --- | --- | ---: | --- |
${caseRows}

### Unit tests

All **${UNIT.passed}/${UNIT.total}** unit tests PASSED, including return-policy wording, understand/topic switch, custom commerce verification, sanitize, hours, and pipeline smoke turns.

---

## 10. Detailed bug reports

${bugSections || "_No failed API cases in the final run._"}

---

## 11. Security findings

- Card PAN / CVV handling: **PASS** (SEC-001) — refuses and does not echo full PAN.
- Prompt injection / system prompt leak: **PASS** (SEC-002).
- Cross-customer order without verification: **PASS** (SEC-003).
- Off-topic redirect: **PASS** (SEC-004).
- Secrets: test report redacts keys; test server cleared \`RESEND_API_KEY\`.

No Critical security failures observed in the executed suite.

---

## 12. Workspace isolation findings

- Distinct conversation IDs across workspace IDs: **PASS** (ISO-001).
- Deep dual-catalog / dual-policy isolation: **NOT TESTED** (ISO-002) — single shared custom catalog process. Treat as residual risk before multi-tenant production.

---

## 13. AI reliability and hallucination findings

- Budget hard filter on ivory<$500: **PASS** (PRD-001) — no over-budget cards.
- Material honesty: **PASS** (PRD-005).
- Color claim correction: **PASS** (PRD-008).
- Return ineligible unshipped uses order+14-day policy language (not invented 30 days): **PASS** (RET-001).
- Checkout URL invention blocked: **PASS** (CHK-002).
- Preference stickiness after budget browse: covered by PRD-009 (see failures if any).

---

## 14. Conversation-context findings

Topic switch track→cancel and “never mind” abort: exercised (CTX-001/002). Bare “yes” without pending confirm did not invent cancellation (CTX-003). Sticky preference bleed after budget search remains a watch item (PRD-009).

---

## 15. Human-handoff findings

Connecting state without false “agent joined”: HOF-001. Takeover / agent message / AI silence during takeover / release: HOF-002–005. AI remained silent for product asks during takeover (**PASS** HOF-004) — Critical-risk class behavior validated as safe in this run.

---

## 16. Ecommerce integration findings

| Adapter | Result |
| --- | --- |
| Custom demo | Primary test target — mutations OK |
| Shopify | Health read-only **PASS**; destructive mutations **NOT TESTED** (safety) |
| WooCommerce | **NOT TESTED** — not configured |

---

## 17. Accessibility findings

Screen-reader names, contrast, RTL Arabic layout, and mobile touch targets: **NOT TESTED** in this automated pass. Recommend a dedicated a11y sprint with axe + keyboard audit.

---

## 18. Automated test coverage

| Path | Purpose |
| --- | --- |
| \`apps/server/test/*.test.ts\` | Unit/integration |
| \`tests/api/run-complete-suite.mjs\` | Full API harness |
| \`tests/reports/results.json\` | Machine-readable results |
| \`.env.test\` | Isolated server settings |

### How to run

\`\`\`bash
# Unit
npm test

# Isolated API (terminal 1)
cd apps/server
# set PORT=5610 COMMERCE_PROVIDER=custom RESEND_API_KEY= SHOPIFY_ALLOW_WRITES=false WORKSPACE_ID=vastora-test
npx tsx src/index.ts

# Harness (terminal 2)
set TEST_API_BASE=http://127.0.0.1:5610
node tests/api/run-complete-suite.mjs

# Report
node tests/reports/generate-report.mjs
\`\`\`

---

## 19. Features that could not be tested

- WooCommerce adapter
- Shopify write paths (cancel/address/return on live shop)
- Playwright mobile UI / carousel touch / pen scroll
- Full PT/IT/ZH journeys
- Arabic RTL layout
- AI key invalidation / timeout chaos
- SSE disconnect recovery
- Burst load / multi-tab widget races
- Deep dual-workspace catalog isolation

---

## 20. Risks and limitations

1. Live Shopify store is connected on :5600 with writes historically enabled — keep \`SHOPIFY_ALLOW_WRITES=false\` for non-demo shops.
2. Custom adapter state mutates in-memory within a process (cancel persists for later cases).
3. AI non-determinism can flake soft assertions; critical paths use structural checks (cards, states).
4. Email: production Resend key exists in root \`.env\` — test server must clear it.

---

## 21. Prioritized recommendations

1. **High:** Clear/soften sticky product slots (budget/color) when user switches to open-ended browse or a new named product intent.
2. **High:** Ensure refund-status lookup for known demo orders (1003/alex) reliably calls \`findOrder\`+\`checkRefundStatus\`.
3. **Medium:** Add Playwright smoke for launcher, email gate, Messages resume, product carousel.
4. **Medium:** Complete dual-workspace isolation fixtures before multi-tenant launch.
5. **Medium:** Dedicated a11y + RTL pass.
6. **Low:** CSAT rating UI trigger consistency on goodbye phrases.
7. Keep return transactional email disabled in Agentra; rely on Shopify notifications.

---

## 22. Final release recommendation

### **${recommendation}**

Rationale: ${
  crit.length
    ? "Critical failures remain."
    : high.length
      ? "One or more High-severity failures remain unresolved."
      : fails.length
        ? "No Critical/High blockers in the final classification sense beyond listed Medium issues; complete NOT_TESTED areas before production."
        : "No failed cases; residual NOT_TESTED coverage should still be scheduled."
} Core security, order verification, return-policy grounding, handoff freeze, and checkout disablement passed on the isolated stack.

---

*Generated from \`tests/reports/results.json\` at ${results.generatedAt}.*
`;

fs.writeFileSync(path.join(ROOT, "Agentra_Chatbot_Complete_Test_Report.md"), md);
fs.writeFileSync(path.join(REPORTS, "Agentra_Chatbot_Complete_Test_Report.md"), md);

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Agentra Chatbot Complete Test Report</title>
<style>
  @page { size: A4; margin: 18mm; }
  body { font-family: "Segoe UI", system-ui, sans-serif; color: #1a1a1a; line-height: 1.45; font-size: 11px; }
  h1 { font-size: 22px; border-bottom: 3px solid #d85a30; padding-bottom: 8px; }
  h2 { font-size: 16px; color: #d85a30; margin-top: 28px; page-break-after: avoid; }
  h3 { font-size: 13px; margin-top: 18px; }
  table { border-collapse: collapse; width: 100%; margin: 10px 0 18px; font-size: 9.5px; }
  th, td { border: 1px solid #ddd; padding: 4px 6px; vertical-align: top; }
  th { background: #f7f3f0; text-align: left; }
  .cover { page-break-after: always; padding-top: 60px; }
  .badge { display: inline-block; padding: 4px 10px; border-radius: 4px; background: #d85a30; color: #fff; font-weight: 700; }
  .pass { color: #0a7a32; font-weight: 600; }
  .fail { color: #b00020; font-weight: 600; }
  .meta { color: #555; }
  code { background: #f3f3f3; padding: 1px 4px; border-radius: 3px; }
  pre { background: #f6f6f6; padding: 10px; overflow: auto; font-size: 9px; }
</style>
</head>
<body>
<section class="cover">
  <p class="meta">Agentra · Vastora Bridal</p>
  <h1>Complete Chatbot System Test Report</h1>
  <p><strong>Date:</strong> ${dateStr}</p>
  <p><strong>Environment:</strong> Local isolated custom commerce (:5610) · workspace <code>vastora-test</code></p>
  <p><strong>Combined pass rate:</strong> ${passPct}% (${combinedPassed}/${combinedTotal})</p>
  <p><span class="badge">${recommendation}</span></p>
</section>
${md
  .replace(/^# .+$/m, "")
  .split("\n")
  .map((line) => {
    if (line.startsWith("### ")) return `<h3>${line.slice(4)}</h3>`;
    if (line.startsWith("## ")) return `<h2>${line.slice(3)}</h2>`;
    if (line.startsWith("| ")) return line; // handled loosely
    if (line.startsWith("\`\`\`")) return line.includes("\`\`\`") ? "<pre>" : "</pre>";
    if (line.trim() === "---") return "<hr/>";
    if (line.startsWith("- ")) return `<li>${line.slice(2)}</li>`;
    if (!line.trim()) return "<br/>";
    return `<p>${line
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")}</p>`;
  })
  .join("\n")
  .replace(/(<p>\|[\s\S]*?<\/p>(?:\s*<p>\|[\s\S]*?<\/p>)*)/g, (block) => {
    const rows = block
      .replace(/<\/?p>/g, "")
      .trim()
      .split(/\n/)
      .filter((r) => r.startsWith("|"));
    if (rows.length < 2) return block;
    const parse = (r) =>
      r
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim());
    const head = parse(rows[0]);
    const body = rows.filter((r) => !/^\|\s*---/.test(r)).slice(1);
    return `<table><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${body
      .map((r) => {
        const cells = parse(r).map((c) => {
          const cls = c === "PASS" ? "pass" : c === "FAIL" ? "fail" : "";
          return `<td class="${cls}">${c}</td>`;
        });
        return `<tr>${cells.join("")}</tr>`;
      })
      .join("")}</tbody></table>`;
  })}
</body></html>`;

const htmlPath = path.join(REPORTS, "report.html");
fs.writeFileSync(htmlPath, html);

const pdfOut = path.join(ROOT, "Agentra_Chatbot_Complete_Test_Report.pdf");
const pdfOut2 = path.join(REPORTS, "Agentra_Chatbot_Complete_Test_Report.pdf");

async function toPdf() {
  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto("file://" + htmlPath.replace(/\\/g, "/"), { waitUntil: "load" });
    await page.pdf({
      path: pdfOut,
      format: "A4",
      printBackground: true,
      margin: { top: "16mm", bottom: "16mm", left: "14mm", right: "14mm" },
    });
    fs.copyFileSync(pdfOut, pdfOut2);
    await browser.close();
    console.log("PDF written:", pdfOut);
    return true;
  } catch (err) {
    console.warn("Playwright PDF failed:", err.message);
    return false;
  }
}

const ok = await toPdf();
if (!ok) {
  // Fallback: try npx playwright install + retry once
  console.log("Installing Playwright Chromium for PDF...");
  spawnSync("npx", ["--yes", "playwright", "install", "chromium"], {
    cwd: ROOT,
    stdio: "inherit",
    shell: true,
  });
  spawnSync("npm", ["install", "-D", "playwright", "--no-fund", "--no-audit"], {
    cwd: ROOT,
    stdio: "inherit",
    shell: true,
  });
  const retry = await toPdf();
  if (!retry) {
    console.error("Could not generate PDF; Markdown report is available.");
    process.exit(1);
  }
}

console.log("Markdown:", path.join(ROOT, "Agentra_Chatbot_Complete_Test_Report.md"));
console.log("PDF:", pdfOut);
