// Renders social-preview + icon PNGs from the favicon artwork.
// Run: node scripts/gen-og.mjs  (outputs into public/)
import sharp from "sharp";
import { readFileSync } from "node:fs";

const out = (f) => new URL(`../public/${f}`, import.meta.url).pathname;
const favicon = readFileSync(out("favicon.svg"));

// Logo mark only (no rounded rect), reused inside the OG card.
const mark = `
  <path d="M41.5 38.9A14 14 0 0 1 25.1 22.5a14 14 0 1 0 16.4 16.4Z" fill="none" stroke="#fdf6e3"
    stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" transform="translate(-0.5 1)"/>
  <circle cx="44" cy="20" r="3" fill="#c8851f"/>`;

const og = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="glow" cx="0.85" cy="0.1" r="0.9">
      <stop offset="0" stop-color="#f0d9a8" stop-opacity="0.9"/>
      <stop offset="1" stop-color="#f5eedf" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="#f5eedf"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <g transform="translate(96 150)">
    <rect width="176" height="176" rx="44" fill="#3b3a96"/>
    <g transform="scale(2.75)">${mark}</g>
  </g>
  <g font-family="Plus Jakarta Sans, Helvetica Neue, Arial, sans-serif">
    <text x="316" y="232" font-size="92" font-weight="800" fill="#1d1a3d" letter-spacing="-2">Nusuk Keys</text>
    <text x="320" y="296" font-size="36" font-weight="500" fill="#6b6483">Kode akses &amp; kunci jawaban Nusuk</text>
  </g>
  <g font-family="Plus Jakarta Sans, Helvetica Neue, Arial, sans-serif" font-size="30" font-weight="600">
    <rect x="96" y="420" width="250" height="64" rx="32" fill="#fffaf0" stroke="#dccfb2" stroke-width="2"/>
    <text x="221" y="463" text-anchor="middle" fill="#2b2760">Salin kode</text>
    <rect x="366" y="420" width="290" height="64" rx="32" fill="#fffaf0" stroke="#dccfb2" stroke-width="2"/>
    <text x="511" y="463" text-anchor="middle" fill="#2b2760">Kunci jawaban</text>
    <rect x="676" y="420" width="300" height="64" rx="32" fill="#3b3a96"/>
    <text x="826" y="463" text-anchor="middle" fill="#fdf6e3">Tandai terpakai</text>
  </g>
  <text x="96" y="568" font-family="JetBrains Mono, Menlo, monospace" font-size="26" fill="#c8851f">nusuk-keys.web.id</text>
</svg>`;

await sharp(Buffer.from(og)).png().toFile(out("og.png"));
const icon = (size, file) => sharp(favicon, { density: 72 * (size / 64) * 2 }).resize(size, size).png().toFile(out(file));
await icon(180, "apple-touch-icon.png");
await icon(192, "icon-192.png");
await icon(512, "icon-512.png");
await icon(32, "favicon-32.png");
console.log("ok");
