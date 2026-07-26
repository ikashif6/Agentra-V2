import fs from "node:fs";

const raw = fs.readFileSync("_design_css_extract.txt", "utf8");
const parts = [];
const re = /`([^`]*)`/g;
let x;
while ((x = re.exec(raw))) {
  const chunk = x[1];
  if (
    chunk.includes("{") &&
    (chunk.includes("#agt") ||
      chunk.includes(".agt") ||
      chunk.includes("--brand") ||
      chunk.includes("box-sizing") ||
      chunk.includes("#agt-launcher") ||
      chunk.includes("font-family"))
  ) {
    parts.push(chunk);
  }
}

let css = parts.join("\n");
css = css.replace(/\$\{[^}]+\}/g, "");
// Prefix rules that start with #agt or .agt — already scoped via t+ in original.
// Inject root variables block
const root = `#agentra-widget-root {
  font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
  --brand: #d85a30;
  --brand-dk: #c6481e;
  --ink: #111214;
  --ink-2: #1f2124;
  --white: #ffffff;
  --gray-50: #f7f8f9;
  --gray-100: #f0f2f4;
  --gray-200: #e4e7eb;
  --gray-300: #cbd0d8;
  --gray-400: #9aa1ac;
  --gray-500: #6b7280;
  --gray-700: #374151;
  --gray-900: #111827;
  --w: 370px;
  --h: 500px;
  --r: 20px;
  --shadow: none;
  --btn-shadow: none;
}
`;

// Scope selectors: lines that are selectors need #agentra-widget-root prefix
// The original used t = "#agentra-widget-root " prefix on every rule.
// Our extracted chunks already include selectors like #agt-launcher without root.
// Wrap by prefixing common selectors.

function scopeCss(input) {
  // Prefix top-level selectors that start with #agt, .agt, or *
  return input.replace(
    /(^|})\s*([^{}@/]+)\s*\{/g,
    (match, brace, selectors) => {
      const trimmed = selectors.trim();
      if (!trimmed || trimmed.startsWith("@") || trimmed.startsWith("from") || trimmed.startsWith("to") || trimmed.startsWith("%")) {
        return match;
      }
      const scoped = trimmed
        .split(",")
        .map((s) => {
          s = s.trim();
          if (!s) return s;
          if (s.startsWith("#agentra-widget-root")) return s;
          if (s === "*") return "#agentra-widget-root *, #agentra-widget-root *::before, #agentra-widget-root *::after";
          return `#agentra-widget-root ${s}`;
        })
        .join(", ");
      return `${brace}\n${scoped} {`;
    },
  );
}

const out = `/* Visual styles matched from chatbot-design widget — logic rebuilt separately */\n@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');\n\n${root}\n${scopeCss(css)}\n`;
fs.writeFileSync("apps/widget/src/widget.css", out);
console.log("Wrote widget.css", out.length, "chars from", parts.length, "parts");
