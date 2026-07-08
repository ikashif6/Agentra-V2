const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "../app/(app)");
const reps = [
  [/focus-visible:ring-\[#D85A30\]/g, "focus-visible:ring-primary/30"],
  [
    /bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden/g,
    "rounded-[10px] border border-border/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden",
  ],
  [/border-b border-gray-100 bg-gray-50/g, "border-b border-border/60 bg-muted/30"],
  [/border-t border-gray-100 bg-gray-50/g, "border-t border-border/60 bg-muted/20"],
  [
    /text-xs font-medium text-gray-500 uppercase tracking-wide/g,
    "text-[10px] font-semibold uppercase tracking-wider text-muted-foreground",
  ],
  [/divide-y divide-gray-50/g, "divide-y divide-border/40"],
  [/hover:bg-gray-50/g, "hover:bg-accent/30"],
  [/group-hover:text-\[#D85A30\]/g, "group-hover:text-primary"],
  [/text-sm font-semibold text-gray-900/g, "text-sm font-semibold text-foreground"],
  [/text-gray-400/g, "text-muted-foreground"],
  [/text-gray-500/g, "text-muted-foreground"],
  [/text-gray-700/g, "text-foreground/80"],
  [/text-gray-300/g, "text-muted-foreground/50"],
  [/text-gray-200/g, "text-muted-foreground/30"],
  [/style=\{\{ color: "#D85A30" \}\}/g, 'className="text-primary"'],
  [/text-xs text-\[#D85A30\] font-medium/g, "text-xs text-primary font-medium"],
  [/border border-gray-100/g, "border border-border/60"],
  [/bg-gray-50/g, "bg-muted/30"],
  [/text-gray-900/g, "text-foreground"],
  [/rounded-xl hover:bg-gray-100/g, "rounded-[10px] hover:bg-muted"],
];

function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (p.endsWith(".tsx")) {
      let c = fs.readFileSync(p, "utf8");
      const o = c;
      for (const [a, b] of reps) c = c.replace(a, b);
      if (c !== o) {
        fs.writeFileSync(p, c);
        console.log("updated", p);
      }
    }
  }
}

walk(root);
