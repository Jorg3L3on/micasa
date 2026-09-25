import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';

export const size = {
  width: 32,
  height: 32,
};

export const contentType = 'image/png';

export default async function Icon() {
  const png = await readFile(path.join(process.cwd(), 'public/icons/icon-32.png'));
  const src = `data:image/png;base64,${png.toString('base64')}`;

  return new ImageResponse(
    (
      <img src={src} width={32} height={32} alt="" />
    ),
    { ...size },
  );
}
