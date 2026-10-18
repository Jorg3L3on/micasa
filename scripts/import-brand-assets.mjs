/**
 * Import the brand export (mark, plated icons, favicons) into public/.
 * The export is the supplied artwork: this script only renames files, strips
 * embedded C2PA provenance metadata (~6-8 KB per file) and packs favicon.ico.
 *
 *   node scripts/import-brand-assets.mjs ~/Downloads/export/MiCasa
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exportDir = process.argv[2];
if (!exportDir) {
  console.error('Usage: node scripts/import-brand-assets.mjs <export-dir>');
  process.exit(1);
}

const source = (name) => path.join(exportDir, `MiCasa-${name}`);
const target = (...parts) => path.join(root, ...parts);

const SVGS = [
  ['mark.svg', target('public', 'brand', 'mark.svg')],
  ['icon-rounded.svg', target('public', 'brand', 'icon-rounded.svg')],
  ['icon-square.svg', target('public', 'brand', 'icon-square.svg')],
];

const PNGS = [
  ['favicon-32.png', [target('public', 'icons', 'icon-32.png')]],
  ['icon-192.png', [target('public', 'icons', 'icon-192.png')]],
  // The glyph sits inside the maskable safe zone, so one file serves both purposes.
  ['icon-512.png', [target('public', 'icons', 'icon-512.png')]],
  [
    'apple-touch-180.png',
    [target('public', 'icons', 'apple-touch-icon.png'), target('public', 'apple-touch-icon.png')],
  ],
];

const ICO_SIZES = [16, 32, 64];
const ICO_TARGETS = [
  target('public', 'favicon.ico'),
  target('public', 'icon.ico'),
  target('public', 'icons', 'favicon.ico'),
  target('src', 'app', 'favicon.ico'),
];

const stripSvgMetadata = (svg) =>
  svg
    .replace(/<metadata>[\s\S]*?<\/metadata>/g, '')
    .replace(/\s+xmlns:c2pa="[^"]*"/g, '')
    .trim()
    .concat('\n');

/** Keep the chunks needed to render; drop provenance (caBX) and text chunks. */
const KEEP_CHUNKS = new Set(['IHDR', 'PLTE', 'tRNS', 'gAMA', 'cHRM', 'sRGB', 'iCCP', 'pHYs', 'IDAT', 'IEND']);
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const stripPngMetadata = (png) => {
  if (!png.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error('Not a PNG');
  const chunks = [PNG_SIGNATURE];
  let offset = 8;
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (KEEP_CHUNKS.has(png.toString('latin1', offset + 4, offset + 8))) {
      chunks.push(png.subarray(offset, end));
    }
    offset = end;
  }
  return Buffer.concat(chunks);
};

const toIco = (pngs) => {
  const header = 6 + pngs.length * 16;
  let offset = header;
  const entries = pngs.map(({ size, png }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });
  const dir = Buffer.alloc(6);
  dir.writeUInt16LE(1, 2);
  dir.writeUInt16LE(pngs.length, 4);
  return Buffer.concat([dir, ...entries, ...pngs.map((item) => item.png)]);
};

await mkdir(target('public', 'brand'), { recursive: true });
await mkdir(target('public', 'icons'), { recursive: true });

for (const [name, out] of SVGS) {
  await writeFile(out, stripSvgMetadata(await readFile(source(name), 'utf8')));
}

for (const [name, outs] of PNGS) {
  const png = stripPngMetadata(await readFile(source(name)));
  for (const out of outs) await writeFile(out, png);
}

const ico = toIco(
  await Promise.all(
    ICO_SIZES.map(async (size) => ({
      size,
      png: stripPngMetadata(await readFile(source(`favicon-${size}.png`))),
    })),
  ),
);
for (const out of ICO_TARGETS) await writeFile(out, ico);

console.log(`Imported brand assets from ${exportDir}`);
