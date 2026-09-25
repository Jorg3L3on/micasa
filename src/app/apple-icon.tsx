import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';

export const size = {
  width: 180,
  height: 180,
};

export const contentType = 'image/png';

export default async function AppleIcon() {
  const png = await readFile(
    path.join(process.cwd(), 'public/icons/apple-touch-icon.png'),
  );
  const src = `data:image/png;base64,${png.toString('base64')}`;

  return new ImageResponse(
    (
      <img src={src} width={180} height={180} alt="" />
    ),
    { ...size },
  );
}
