import fs from "node:fs";
const s = fs.readFileSync("apps/widget/vendor/widget.js", "utf8");
const idx = s.indexOf("function hn(");
console.log(s.slice(idx, idx + 1200));
