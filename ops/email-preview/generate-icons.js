const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const out = path.join(__dirname, '../../client/public/email/icons');
fs.mkdirSync(out, { recursive: true });

const stroke = '#1A1D26';
const accent = '#D85A30';

const icons = {
  shield: `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48" fill="none"><path d="M24 6L10 12v12c0 9.2 5.9 17.7 14 20 8.1-2.3 14-10.8 14-20V12L24 6z" stroke="${stroke}" stroke-width="2.5" stroke-linejoin="round"/><path d="M18 24l4.5 4.5L31 20" stroke="${accent}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  mail: `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48" fill="none"><rect x="8" y="12" width="32" height="24" rx="3" stroke="${stroke}" stroke-width="2.5"/><path d="M10 16l14 11L38 16" stroke="${accent}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  key: `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48" fill="none"><circle cx="18" cy="24" r="8" stroke="${stroke}" stroke-width="2.5"/><path d="M24 24h16v4h-4v4h-4v-4h-4" stroke="${accent}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  link: `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48" fill="none"><path d="M20 28a8 8 0 010-11.3l4-4a8 8 0 0111.3 11.3l-2 2" stroke="${stroke}" stroke-width="2.5" stroke-linecap="round"/><path d="M28 20a8 8 0 010 11.3l-4 4A8 8 0 0112.7 24l2-2" stroke="${accent}" stroke-width="2.5" stroke-linecap="round"/></svg>`,
  lock: `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48" fill="none"><rect x="12" y="22" width="24" height="18" rx="3" stroke="${stroke}" stroke-width="2.5"/><path d="M18 22v-5a6 6 0 0112 0v5" stroke="${accent}" stroke-width="2.5" stroke-linecap="round"/></svg>`,
  users: `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48" fill="none"><circle cx="18" cy="16" r="5" stroke="${stroke}" stroke-width="2.5"/><path d="M8 36c0-5.5 4.5-10 10-10h0c5.5 0 10 4.5 10 10" stroke="${stroke}" stroke-width="2.5" stroke-linecap="round"/><circle cx="32" cy="16" r="4" stroke="${accent}" stroke-width="2.5"/><path d="M28 36c.5-3.5 3-6.5 6.5-7.5" stroke="${accent}" stroke-width="2.5" stroke-linecap="round"/></svg>`,
  spark: `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48" fill="none"><path d="M24 6v8M24 34v8M6 24h8M34 24h8M12 12l5.5 5.5M30.5 30.5L36 36M36 12l-5.5 5.5M17.5 30.5L12 36" stroke="${accent}" stroke-width="2.5" stroke-linecap="round"/><circle cx="24" cy="24" r="5" stroke="${stroke}" stroke-width="2.5"/></svg>`,
  ticket: `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48" fill="none"><path d="M8 16h32v6a4 4 0 010 8v6H8v-6a4 4 0 010-8v-6z" stroke="${stroke}" stroke-width="2.5" stroke-linejoin="round"/><path d="M18 18v16" stroke="${accent}" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="3 4"/></svg>`,
  help: `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="16" stroke="${stroke}" stroke-width="2.5"/><path d="M19.5 19a5 5 0 019 2.5c0 2.5-2.5 3.5-4 4.5" stroke="${accent}" stroke-width="2.5" stroke-linecap="round"/><circle cx="24" cy="32" r="1.8" fill="${accent}"/></svg>`,
  channel: `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48" fill="none"><rect x="8" y="10" width="20" height="28" rx="3" stroke="${stroke}" stroke-width="2.5"/><path d="M28 18h8a4 4 0 014 4v12a4 4 0 01-4 4h-8" stroke="${accent}" stroke-width="2.5" stroke-linecap="round"/><path d="M16 34h4" stroke="${accent}" stroke-width="2.5" stroke-linecap="round"/></svg>`,
  bot: `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48" fill="none"><rect x="10" y="14" width="28" height="22" rx="5" stroke="${stroke}" stroke-width="2.5"/><path d="M24 8v6" stroke="${accent}" stroke-width="2.5" stroke-linecap="round"/><circle cx="24" cy="8" r="2" fill="${accent}"/><circle cx="18" cy="24" r="2.5" fill="${accent}"/><circle cx="30" cy="24" r="2.5" fill="${accent}"/><path d="M19 31h10" stroke="${stroke}" stroke-width="2.5" stroke-linecap="round"/></svg>`,
  check: `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="16" stroke="${stroke}" stroke-width="2.5"/><path d="M16 24l5.5 5.5L33 18" stroke="${accent}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

(async () => {
  for (const [name, svg] of Object.entries(icons)) {
    await sharp(Buffer.from(svg)).png().toFile(path.join(out, `${name}.png`));
  }
  console.log('Wrote icons:', Object.keys(icons).join(', '));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
