'use client';

import { getImageProps } from 'next/image';
import { useTheme } from 'next-themes';

import { cn } from '@/lib/utils';

export const PRODUCT_SHOT_IDS = [
  'panel',
  'billeteras',
  'liquidez',
  'plan',
  'prestamos',
  'metas',
  'operaciones',
  'toca-pagar',
] as const;

export type ProductShotId = (typeof PRODUCT_SHOT_IDS)[number];

type ProductShotProps = {
  id: ProductShotId;
  alt: string;
  /** Hero only. Below-fold shots stay lazy so the mobile landing does not preload them. */
  priority?: boolean;
  className?: string;
};

const DESKTOP = { width: 1440, height: 900 } as const;
const MOBILE = { width: 780, height: 1688 } as const;

/**
 * Real app capture. The server render is dark (the default theme) so a mobile
 * Lighthouse pass loads one image. Light swaps in after the theme resolves.
 * `picture` picks the mobile file below `md` and the desktop file from `md` up.
 */
export const ProductShot = ({
  id,
  alt,
  priority = false,
  className,
}: ProductShotProps) => {
  const { resolvedTheme } = useTheme();
  // Server and the first client paint stay on the default dark captures.
  // `resolvedTheme` is unset until next-themes has read the class.
  const theme = resolvedTheme === 'light' ? 'light' : 'dark';

  const desktop = getImageProps({
    alt: '',
    src: `/landing/${id}-desktop-${theme}.webp`,
    width: DESKTOP.width,
    height: DESKTOP.height,
    sizes: '(min-width: 768px) 42rem, 100vw',
    priority,
  });

  const mobile = getImageProps({
    alt,
    src: `/landing/${id}-mobile-${theme}.webp`,
    width: MOBILE.width,
    height: MOBILE.height,
    sizes: '100vw',
    priority,
  });

  const {
    src,
    srcSet,
    width,
    height,
    sizes,
    loading,
    fetchPriority,
    decoding,
  } = mobile.props;

  return (
    <figure
      className={cn(
        'overflow-hidden rounded-xl border border-border bg-card shadow-card',
        className,
      )}
    >
      <div className="relative aspect-[9/16] max-h-[32rem] md:aspect-video md:max-h-none">
        <picture className="absolute inset-0 block">
          <source
            media="(min-width: 768px)"
            srcSet={desktop.props.srcSet}
            sizes={desktop.props.sizes}
          />
          <img
            src={src}
            srcSet={srcSet}
            width={width}
            height={height}
            sizes={sizes}
            loading={loading}
            fetchPriority={fetchPriority}
            decoding={decoding}
            alt={alt}
            className="size-full object-cover object-top"
          />
        </picture>
      </div>
    </figure>
  );
};
