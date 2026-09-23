// One-off icon generator for the PWA. Run: node scripts/gen-icons.mjs
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

// Brand: purple gradient with a white lightning bolt. `bleed` = full-bleed background
// for maskable icons; when false, adds transparent padding (nicer as a favicon/any).
function svg({ size, bleed }) {
  const r = bleed ? 0 : size * 0.22; // rounded corners for non-maskable
  const pad = bleed ? 0 : 0; // background fills; bolt is inside safe zone regardless
  const boltScale = bleed ? 0.42 : 0.5; // smaller for maskable safe zone
  const bw = size * boltScale;
  const bh = bw * 1.35;
  const cx = size / 2;
  const cy = size / 2;
  // Simple lightning bolt path centered around (cx, cy)
  const x0 = cx - bw * 0.28;
  const bolt = `
    M ${cx + bw * 0.18} ${cy - bh * 0.5}
    L ${x0} ${cy + bh * 0.08}
    L ${cx - bw * 0.02} ${cy + bh * 0.08}
    L ${cx - bw * 0.22} ${cy + bh * 0.5}
    L ${cx + bw * 0.30} ${cy - bh * 0.10}
    L ${cx + bw * 0.02} ${cy - bh * 0.10}
    Z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#7a1dff"/>
        <stop offset="1" stop-color="#5200d6"/>
      </linearGradient>
    </defs>
    <rect x="${pad}" y="${pad}" width="${size - pad * 2}" height="${size - pad * 2}" rx="${r}" ry="${r}" fill="url(#g)"/>
    <path d="${bolt}" fill="#ffffff"/>
  </svg>`;
}

async function render(name, size, bleed) {
  const buf = Buffer.from(svg({ size, bleed }));
  await sharp(buf).png().toFile(join(outDir, name));
  console.log('wrote', name);
}

await render('icon-192.png', 192, false);
await render('icon-512.png', 512, false);
await render('icon-maskable-512.png', 512, true);
await render('apple-touch-icon.png', 180, false);
console.log('done');
