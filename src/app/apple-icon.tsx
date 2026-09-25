import { ImageResponse } from 'next/og';

import { MicasaIconPlate } from '@/components/brand/micasa-icon-plate';

export const size = {
  width: 180,
  height: 180,
};

export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(<MicasaIconPlate size={180} />, { ...size });
}
