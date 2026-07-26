import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const designServer = path.resolve(root, "../chatbot-design/server/src");

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "data") continue;
      walk(full, files);
    } else if (/\.(ts|js|mjs|cjs)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

const ourFiles = walk(path.join(root, "apps/server/src"));
const designFiles = walk(designServer);
const designBasenames = new Set(designFiles.map((f) => path.basename(f)));

let suspicious = 0;
for (const file of ourFiles) {
  const content = fs.readFileSync(file, "utf8");
  if (content.includes("chatbot-design/server") || content.includes("from \"../chatbot-design")) {
    console.error("Import from design server:", file);
    suspicious++;
  }
  // Exact file copy heuristic: identical length + same basename as design and high overlap
  const base = path.basename(file);
  if (designBasenames.has(base) && content.length > 500) {
    const designMatch = designFiles.find((f) => path.basename(f) === base);
    if (designMatch) {
      const other = fs.readFileSync(designMatch, "utf8");
      if (other === content) {
        console.error("Exact copy of design file:", file);
        suspicious++;
      }
    }
  }
}

if (suspicious) {
  console.error(`Audit failed: ${suspicious} issue(s)`);
  process.exit(1);
}
console.log(`Copy audit passed (${ourFiles.length} server files checked against design backend).`);
