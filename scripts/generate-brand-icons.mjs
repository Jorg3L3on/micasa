/**
 * Build favicon, Apple, and PWA icons from public/brand/mark.png.
 * The mark is the supplied artwork. This script only scales and plates it.
 *
 *   node scripts/generate-brand-icons.mjs
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Resvg } from '@resvg/resvg-js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLATE = '#060914';

const markPng = await readFile(path.join(root, 'public', 'brand', 'mark.png'));
const markHref = `data:image/png;base64,${markPng.toString('base64')}`;

const plateSvg = ({ size, inset, rounded }) => {
  const pad = Math.round(size * inset);
  const mark = size - pad * 2;
  const radius = rounded ? Math.round(size * 0.22) : 0;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="${PLATE}"/>
  <image href="${markHref}" x="${pad}" y="${pad}" width="${mark}" height="${mark}" preserveAspectRatio="xMidYMid meet"/>
</svg>`;
};

const lockupSvg = (wordColor) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 160" role="img" aria-labelledby="micasaLockupTitle">
  <title id="micasaLockupTitle">MiCasa</title>
  <image href="${markHref}" x="8" y="8" width="144" height="144" preserveAspectRatio="xMidYMid meet"/>
  <text x="176" y="104" fill="${wordColor}" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="84" font-weight="600" letter-spacing="-1.5">MiCasa</text>
</svg>`;

const renderPng = (svg, width) =>
  new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    background: 'rgba(0,0,0,0)',
  })
    .render()
    .asPng();

const toIco = (pngs) => {
  const count = pngs.length;
  const header = 6 + count * 16;
  let offset = header;
  const entries = [];
  for (const { size, png } of pngs) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += png.length;
  }
  const dir = Buffer.alloc(6);
  dir.writeUInt16LE(0, 0);
  dir.writeUInt16LE(1, 2);
  dir.writeUInt16LE(count, 4);
  return Buffer.concat([dir, ...entries, ...pngs.map((item) => item.png)]);
};

const iconsDir = path.join(root, 'public', 'icons');
await mkdir(iconsDir, { recursive: true });

const plate = plateSvg({ size: 512, inset: 0.12, rounded: true });
const maskable = plateSvg({ size: 512, inset: 0.22, rounded: false });

await writeFile(path.join(root, 'public', 'logo-white.svg'), lockupSvg('#FFFFFF'));
await writeFile(path.join(root, 'public', 'logo-black.svg'), lockupSvg('#0A0B10'));

const png32 = renderPng(plate, 32);
const png16 = renderPng(plate, 16);
const files = [
  ['icon-32.png', png32],
  ['icon-192.png', renderPng(plate, 192)],
  ['icon-512.png', renderPng(plate, 512)],
  ['apple-touch-icon.png', renderPng(plate, 180)],
  ['icon-maskable-512.png', renderPng(maskable, 512)],
];

for (const [name, png] of files) {
  await writeFile(path.join(iconsDir, name), png);
}

const ico = toIco([
  { size: 16, png: png16 },
  { size: 32, png: png32 },
]);
await writeFile(path.join(iconsDir, 'favicon.ico'), ico);
await writeFile(path.join(root, 'public', 'favicon.ico'), ico);
await writeFile(path.join(root, 'public', 'icon.ico'), ico);

console.log('Wrote icons from public/brand/mark.png');
