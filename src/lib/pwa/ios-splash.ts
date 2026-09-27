import IOS_SPLASH_DEVICES from '@/lib/pwa/ios-splash-devices.json';

export type IosSplashOrientation = 'portrait' | 'landscape';

type IosSplashDevice = {
  width: number;
  height: number;
  ratio: number;
  tablet?: boolean;
};

/** Pixel size and file name; must match scripts/generate-ios-splash.mjs. */
export const getIosSplashFileName = (
  { width, height, ratio }: IosSplashDevice,
  orientation: IosSplashOrientation,
): string => {
  const portrait = [width * ratio, height * ratio];
  const [pixelWidth, pixelHeight] =
    orientation === 'portrait' ? portrait : [portrait[1], portrait[0]];
  return `apple-splash-${pixelWidth}x${pixelHeight}.png`;
};

const orientationsFor = (device: IosSplashDevice): IosSplashOrientation[] =>
  device.tablet ? ['portrait', 'landscape'] : ['portrait'];

/** `apple-touch-startup-image` entries for Next `metadata.appleWebApp`. */
export const IOS_SPLASH_IMAGES = (IOS_SPLASH_DEVICES as IosSplashDevice[]).flatMap(
  (device) =>
    orientationsFor(device).map((orientation) => ({
      url: `/splash/${getIosSplashFileName(device, orientation)}`,
      media: `(device-width: ${device.width}px) and (device-height: ${device.height}px) and (-webkit-device-pixel-ratio: ${device.ratio}) and (orientation: ${orientation})`,
    })),
);
