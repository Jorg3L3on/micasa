import { createMicasaAppIcon } from '@/components/brand/micasa-app-icon';

export const size = {
  width: 180,
  height: 180,
};

export const contentType = 'image/png';

export default function AppleIcon() {
  return createMicasaAppIcon(size.width);
}
