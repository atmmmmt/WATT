/**
 * Regenerates the VAYRO icon set from one vector source.
 *
 *   npm run icons
 *
 * Mark: the brand "V" in white with the orange brand dot in its notch, on the deep
 * primary green. Flat colour only — the identity uses no gradients.
 * Produces public/icons/{icon-192,icon-512,icon-maskable-512,apple-touch-icon}.png.
 * Maskable draws the mark smaller because Android crops it to a circle.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../public/icons');

const PRIMARY = '#064E3B'; // Primary Green — trust & growth
const ORANGE = '#F59E0B'; // Accent Orange — energy & focus
const WHITE = '#FFFFFF';

/**
 * The V mark. Drawn around a 512 box: two thick strokes meeting at the bottom, with the
 * dot sitting in the opening between them.
 */
function mark(scale, color = WHITE) {
  return `
    <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
      <path d="M128 150 L186 150 L256 322 L326 150 L384 150 L288 386 L224 386 Z"
            fill="${color}" stroke-linejoin="round"/>
      <circle cx="256" cy="228" r="34" fill="${ORANGE}"/>
    </g>`;
}

function squircle() {
  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <rect width="512" height="512" rx="114" fill="${PRIMARY}"/>
    ${mark(0.82)}
  </svg>`;
}

function maskable() {
  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <rect width="512" height="512" fill="${PRIMARY}"/>
    ${mark(0.58)}
  </svg>`;
}

const targets = [
  { file: 'icon-512.png', svg: squircle(), size: 512 },
  { file: 'icon-192.png', svg: squircle(), size: 192 },
  { file: 'apple-touch-icon.png', svg: squircle(), size: 180 },
  { file: 'icon-maskable-512.png', svg: maskable(), size: 512 },
];

await mkdir(OUT_DIR, { recursive: true });

for (const target of targets) {
  const png = await sharp(Buffer.from(target.svg))
    .resize(target.size, target.size)
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(resolve(OUT_DIR, target.file), png);
  console.log(`wrote ${target.file} (${target.size}px, ${(png.length / 1024).toFixed(1)}KB)`);
}
