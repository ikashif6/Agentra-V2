const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "../app/(app)");

function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (p.endsWith(".tsx")) {
      let c = fs.readFileSync(p, "utf8");
      const o = c;
      c = c.replace(/className="([^"]*)"\s+className="([^"]*)"/g, 'className="$1 $2"');
      if (c !== o) {
        fs.writeFileSync(p, c);
        console.log("fixed", p);
      }
    }
  }
}

walk(root);
