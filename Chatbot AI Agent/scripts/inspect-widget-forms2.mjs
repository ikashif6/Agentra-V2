import fs from "node:fs";
const s = fs.readFileSync("apps/widget/vendor/widget.js", "utf8");
console.log("MN FULL:\n", s.slice(s.indexOf("function mn("), s.indexOf("function mn(") + 2200));
console.log("\n\nYN:\n", s.slice(s.indexOf("function yn("), s.indexOf("function yn(") + 900));
const sub = s.indexOf('addEventListener("submit"');
console.log("\n\nSUBMIT:\n", s.slice(sub - 150, sub + 700));
