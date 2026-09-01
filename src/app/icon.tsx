import { createMicasaAppIcon } from '@/components/brand/micasa-app-icon';

export const contentType = 'image/png';

/** PWA / Android install sizes. iOS home screen uses apple-icon (180). */
export function generateImageMetadata() {
  return [
    {
      contentType: 'image/png',
      size: { width: 192, height: 192 },
      id: '192',
    },
    {
      contentType: 'image/png',
      size: { width: 512, height: 512 },
      id: '512',
    },
  ];
}

export default async function Icon({ id }: { id: Promise<string> }) {
  const iconId = await id;
  const size = Number(iconId);

  return createMicasaAppIcon(Number.isFinite(size) ? size : 512);
}
