import fs from "node:fs";
const s = fs.readFileSync("apps/widget/vendor/widget.js", "utf8");
const markers = ["product_cards", "order_card", "input_form", "bn(", "fn(", ".products"];
for (const m of markers) {
  const i = s.indexOf(m);
  console.log(m, i);
  if (i >= 0) console.log(s.slice(Math.max(0, i - 40), i + 120).replace(/\n/g, " "));
}
