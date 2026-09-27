/**
 * Build iOS PWA startup images (apple-touch-startup-image) that match the
 * streamed BrandLoader splash in src/app/loading.tsx, plus the small mark
 * the loader uses. Devices: src/lib/pwa/ios-splash-devices.json.
 *
 *   node scripts/generate-ios-splash.mjs
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Resvg } from '@resvg/resvg-js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CANVAS = '#060914';
const TRAIL_COLORS = ['#3a37fc', '#4935f7', '#5833f1', '#6831ec', '#782fe7', '#8a2be2'];

/*
 * Mirrors src/app/loading.tsx in CSS px so the iOS image and the streamed
 * splash line up: BrandLoader (104) · gap-6 · text-xl (28) · gap-1.5 · text-xs (16).
 */
const LOADER = 104;
const GAP = 24;
const WORDMARK_LINE = 28;
const TEXT_GAP = 6;
const CAPTION_LINE = 16;
const GROUP_HEIGHT = LOADER + GAP + WORDMARK_LINE + TEXT_GAP + CAPTION_LINE;

const markPng = await readFile(path.join(root, 'public', 'brand', 'mark.png'));
const markHref = `data:image/png;base64,${markPng.toString('base64')}`;
const devices = JSON.parse(
  await readFile(path.join(root, 'src', 'lib', 'pwa', 'ios-splash-devices.json'), 'utf8'),
);

const loaderSvg = (cx, cy) => {
  const head = LOADER * 0.12;
  const orbit = LOADER / 2 - head / 2;
  const tile = LOADER * 0.62;
  const mark = LOADER * 0.42;
  const trail = TRAIL_COLORS.map((color, index) => {
    const r = (head * (1 - index * 0.13)) / 2;
    const angle = ((-index * 15 - 90) * Math.PI) / 180;
    const x = cx + Math.cos(angle) * orbit;
    const y = cy + Math.sin(angle) * orbit;
    const glow = index === 0 ? ' filter="url(#glow)"' : '';
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" opacity="${1 - index * 0.16}"${glow}/>`;
  }).join('');

  return `
  <circle cx="${cx}" cy="${cy}" r="${orbit}" fill="none" stroke="#ffffff" stroke-opacity="0.1"/>
  <rect x="${cx - tile / 2}" y="${cy - tile / 2}" width="${tile}" height="${tile}" rx="${tile * 0.28}"
    fill="#ffffff" fill-opacity="0.04" stroke="#ffffff" stroke-opacity="0.08" filter="url(#tileGlow)"/>
  <image href="${markHref}" x="${cx - mark / 2}" y="${cy - mark / 2}" width="${mark}" height="${mark}"
    preserveAspectRatio="xMidYMid meet"/>
  ${trail}`;
};

const splashSvg = ({ width, height }) => {
  const top = (height - GROUP_HEIGHT) / 2;
  const cx = width / 2;
  const cy = top + LOADER / 2;
  const wordmarkY = top + LOADER + GAP + 21;
  const captionY = top + LOADER + GAP + WORDMARK_LINE + TEXT_GAP + 12;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <filter id="glow" x="-200%" y="-200%" width="500%" height="500%">
      <feGaussianBlur stdDeviation="4"/>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="tileGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="0" stdDeviation="10" flood-color="#3a37fc" flood-opacity="0.45"/>
    </filter>
  </defs>
  <rect width="${width}" height="${height}" fill="${CANVAS}"/>
  ${loaderSvg(cx, cy)}
  <text x="${cx}" y="${wordmarkY}" text-anchor="middle" fill="#f7f8ff"
    font-family="Manrope, ui-sans-serif, system-ui, -apple-system, Helvetica, Arial, sans-serif"
    font-size="20" font-weight="700" letter-spacing="-0.4">MiCasa</text>
  <text x="${cx}" y="${captionY}" text-anchor="middle" fill="#ffffff" fill-opacity="0.55"
    font-family="ui-sans-serif, system-ui, -apple-system, Helvetica, Arial, sans-serif"
    font-size="12">Cargando tu panel…</text>
</svg>`;
};

const render = (svg, pixelWidth) =>
  new Resvg(svg, { fitTo: { mode: 'width', value: pixelWidth } }).render().asPng();

const splashDir = path.join(root, 'public', 'splash');
await mkdir(splashDir, { recursive: true });

/* File names must match getIosSplashFileName in src/lib/pwa/ios-splash.ts. */
let written = 0;
for (const device of devices) {
  const orientations = device.tablet ? ['portrait', 'landscape'] : ['portrait'];
  for (const orientation of orientations) {
    const cssSize =
      orientation === 'portrait'
        ? { width: device.width, height: device.height }
        : { width: device.height, height: device.width };
    const pixelWidth = cssSize.width * device.ratio;
    const pixelHeight = cssSize.height * device.ratio;
    await writeFile(
      path.join(splashDir, `apple-splash-${pixelWidth}x${pixelHeight}.png`),
      render(splashSvg(cssSize), pixelWidth),
    );
    written += 1;
  }
}

const smallMarkSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
  <image href="${markHref}" width="160" height="160" preserveAspectRatio="xMidYMid meet"/>
</svg>`;
await writeFile(
  path.join(root, 'public', 'brand', 'mark-160.png'),
  new Resvg(smallMarkSvg, { fitTo: { mode: 'width', value: 160 }, background: 'rgba(0,0,0,0)' })
    .render()
    .asPng(),
);

console.log(`Wrote ${written} splash images and brand/mark-160.png`);
