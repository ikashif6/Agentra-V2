import fs from "node:fs";
const s = fs.readFileSync("apps/widget/vendor/widget.js", "utf8");

// Extract around mn function and session/message posting
const idx = s.indexOf("function mn(");
console.log("mn:", s.slice(idx, idx + 900));

const idx2 = s.indexOf('session/message"');
console.log("\nmessage call context:", s.slice(idx2 - 200, idx2 + 400));

const idx3 = s.indexOf("agt-new-chat-btn");
// find click handler
const handlers = [...s.matchAll(/agt-new-chat-btn[\s\S]{0,80}/g)].slice(0, 5);
console.log("\nnew-chat refs", handlers.map((m) => m[0]));

const idx4 = s.indexOf('getElementById("agt-new-chat-btn")');
console.log("\nnew chat bind:", s.slice(idx4, idx4 + 250));

const idx5 = s.indexOf("function Vt("); // might be wrong
// search for new chat reset
for (const term of ["startSession", "newConversation", "resetSession", "session/start", "L=!1", "O.clear"]) {
  const i = s.indexOf(term);
  if (i >= 0) console.log(term, s.slice(i - 30, i + 120).replace(/\n/g, " "));
}
