const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "../app/(app)");
const reps = [
  [/focus:ring-\[#D85A30\]/g, "focus:ring-primary/30"],
  [/focus:ring-1 focus:ring-\[#D85A30\]/g, "focus:ring-1 focus:ring-primary/30"],
  [/hover:text-\[#D85A30\]/g, "hover:text-primary"],
  [/text-\[#D85A30\]/g, "text-primary"],
  [/hover:border-\[#D85A30\]/g, "hover:border-primary/40"],
  [/border-t border-gray-100/g, "border-t border-border/60"],
  [/border-b border-gray-100/g, "border-b border-border/60"],
  [/border-gray-200/g, "border-border/60"],
  [/border-gray-50/g, "border-border/40"],
  [/hover:bg-gray-100/g, "hover:bg-muted"],
  [/text-gray-600/g, "text-muted-foreground"],
  [/bg-white rounded-xl border border-border\/60 shadow-sm/g, "rounded-[10px] border border-border/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]"],
  [/style=\{\{ background: "#FDEBE4", color: "#D85A30" \}\}/g, 'className="bg-brand-muted text-primary"'],
  [/style=\{\{ background: isMe \? "#D85A30" : "#F3F4F6", color: isMe \? "white" : "#374151" \}\}/g, 'className={isMe ? "bg-primary text-primary-foreground" : "bg-muted text-foreground/80"}'],
  [/style=\{isMe && !msg\.isInternal \? \{ background: "#D85A30" \} : \{\}\}/g, 'className={isMe && !msg.isInternal ? "bg-primary text-primary-foreground" : undefined}'],
];

function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (p.endsWith(".tsx")) {
      let c = fs.readFileSync(p, "utf8");
      const o = c;
      for (const [a, b] of reps) c = c.replace(a, b);
      c = c.replace(/className="([^"]*)"\s+className="([^"]*)"/g, 'className="$1 $2"');
      if (c !== o) {
        fs.writeFileSync(p, c);
        console.log("updated", p);
      }
    }
  }
}

walk(root);
