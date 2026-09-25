import { ImageResponse } from 'next/og';

import { MicasaIconPlate } from '@/components/brand/micasa-icon-plate';

export const size = {
  width: 32,
  height: 32,
};

export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(<MicasaIconPlate size={32} />, { ...size });
}
