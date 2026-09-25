/**
 * Rasterize the MiCasa mark into favicon, Apple, and PWA icons.
 * Geometry matches src/components/brand/micasa-mark-geometry.ts.
 *
 *   node scripts/generate-brand-icons.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Resvg } from '@resvg/resvg-js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const VIEWBOX = '0 0 512 512';
const MARK_PATH = 'M 88 418 L 88 79 L 254 271 L 424 79 L 424 418';
const STROKE = 136;
const FROM = '#1E63EC';
const TO = '#5D46E6';
const PLATE = '#060914';

const markPaths = (fillId, glossId) => `
  <path d="${MARK_PATH}" fill="none" stroke="url(#${fillId})" stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="${MARK_PATH}" fill="none" stroke="url(#${glossId})" stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round"/>
`;

const gradientDefs = (fillId, glossId) => `
  <linearGradient id="${fillId}" x1="0%" y1="50%" x2="100%" y2="50%">
    <stop offset="0%" stop-color="${FROM}"/>
    <stop offset="100%" stop-color="${TO}"/>
  </linearGradient>
  <linearGradient id="${glossId}" x1="78%" y1="0%" x2="100%" y2="28%">
    <stop offset="0%" stop-color="#ffffff" stop-opacity="0.38"/>
    <stop offset="70%" stop-color="#ffffff" stop-opacity="0"/>
  </linearGradient>
`;

const markSvg = () => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX}" role="img" aria-labelledby="micasaMarkTitle">
  <title id="micasaMarkTitle">MiCasa</title>
  <defs>${gradientDefs('fill', 'gloss')}</defs>
  ${markPaths('fill', 'gloss')}
</svg>
`;

const plateSvg = ({ inset = 0.16, rounded = true }) => {
  const size = 512;
  const pad = Math.round(size * inset);
  const radius = rounded ? Math.round(size * 0.22) : 0;
  const mark = size - pad * 2;
  const origin = pad;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="${PLATE}"/>
  <svg x="${origin}" y="${origin}" width="${mark}" height="${mark}" viewBox="${VIEWBOX}">
    <defs>${gradientDefs('fill', 'gloss')}</defs>
    ${markPaths('fill', 'gloss')}
  </svg>
</svg>`;
};

const lockupSvg = (wordColor) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 160" role="img" aria-labelledby="micasaLockupTitle">
  <title id="micasaLockupTitle">MiCasa</title>
  <svg x="8" y="8" width="144" height="144" viewBox="${VIEWBOX}">
    <defs>${gradientDefs('fill', 'gloss')}</defs>
    ${markPaths('fill', 'gloss')}
  </svg>
  <text x="176" y="104" fill="${wordColor}" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="84" font-weight="600" letter-spacing="-1.5">MiCasa</text>
</svg>
`;

const renderPng = (svg, width) => {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    background: 'rgba(0,0,0,0)',
  });
  return resvg.render().asPng();
};

/** Vista-style ICO containing PNG frames. */
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
const brandDir = path.join(root, 'public', 'brand');
await mkdir(iconsDir, { recursive: true });
await mkdir(brandDir, { recursive: true });

const transparent = markSvg();
const plate = plateSvg({ inset: 0.16, rounded: true });
const maskable = plateSvg({ inset: 0.28, rounded: false });

await writeFile(path.join(brandDir, 'mark.svg'), transparent);
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

console.log('Wrote brand mark, lockups, and icons.');
