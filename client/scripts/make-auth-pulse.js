const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const outDir = path.join(__dirname, "..", "public", "auth");

/** Soft layered pulse — Lovable structure, Agentra warmth (no purple). */
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1940" viewBox="0 0 1920 1940">
  <defs>
    <linearGradient id="bg" x1="960" y1="0" x2="960" y2="1940" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#5c2e20"/>
      <stop offset="14%" stop-color="#a34a2e"/>
      <stop offset="32%" stop-color="#d85a30"/>
      <stop offset="50%" stop-color="#ef9070"/>
      <stop offset="68%" stop-color="#f6b99a"/>
      <stop offset="84%" stop-color="#fde0d0"/>
      <stop offset="100%" stop-color="#fff8f3"/>
    </linearGradient>
    <filter id="soft" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="90"/>
    </filter>
  </defs>
  <rect width="1920" height="1940" fill="url(#bg)"/>
  <g filter="url(#soft)">
    <!-- soft V / ribbon layers like Lovable pulse -->
    <ellipse cx="960" cy="180" rx="1300" ry="420" fill="#3f1f16" opacity="0.55"/>
    <ellipse cx="420" cy="620" rx="780" ry="560" fill="#ffd9c6" opacity="0.85"/>
    <ellipse cx="1500" cy="700" rx="860" ry="620" fill="#ff8f5c" opacity="0.55"/>
    <ellipse cx="960" cy="900" rx="1100" ry="700" fill="#ffffff" opacity="0.42"/>
    <path d="M-200 900 C 400 650, 700 1200, 960 1100 C 1220 1000, 1500 700, 2100 980 L 2100 1940 L -200 1940 Z" fill="#f0997b" opacity="0.55"/>
    <ellipse cx="700" cy="1280" rx="900" ry="520" fill="#ffe8dc" opacity="0.75"/>
    <ellipse cx="1300" cy="1400" rx="820" ry="480" fill="#fffaf6" opacity="0.8"/>
    <ellipse cx="960" cy="1650" rx="1200" ry="420" fill="#ffffff" opacity="0.9"/>
  </g>
</svg>`;

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const final = path.join(outDir, "pulse.webp");
  const rendered = path.join(outDir, `pulse-build-${Date.now()}.webp`);
  await sharp(Buffer.from(svg), { density: 72 }).webp({ quality: 92 }).toFile(rendered);
  await sharp(rendered)
    .modulate({ brightness: 1.12, saturation: 1.02 })
    .blur(2)
    .webp({ quality: 90 })
    .toFile(final);
  for (const f of fs.readdirSync(outDir)) {
    if (
      f === "pulse-tmp.webp" ||
      f.startsWith("pulse-build-") ||
      f.startsWith("pulse-178") ||
      f === "_ref-pulse.webp"
    ) {
      try {
        fs.unlinkSync(path.join(outDir, f));
      } catch {
        /* ignore locks */
      }
    }
  }
  console.log("ok", fs.statSync(final).size);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
