import { Fragment } from 'react';
import { getImageProps } from 'next/image';

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
  /** Hero only. Preloads the visible theme; every img stays lazy so the hidden one is not fetched. */
  priority?: boolean;
  className?: string;
};

const DESKTOP = { width: 1440, height: 900 } as const;
const MOBILE = { width: 780, height: 1688 } as const;

type ShotTheme = 'light' | 'dark';

const shotImageProps = (id: ProductShotId, theme: ShotTheme, mobile: boolean) =>
  getImageProps({
    alt: '',
    src: `/landing/${id}-${mobile ? 'mobile' : 'desktop'}-${theme}.webp`,
    width: mobile ? MOBILE.width : DESKTOP.width,
    height: mobile ? MOBILE.height : DESKTOP.height,
    sizes: mobile ? '100vw' : '(min-width: 768px) 42rem, 100vw',
  });

/**
 * Server preload for the hero. `media` picks theme and breakpoint, and
 * `imageSrcSet` matches the picture the browser will paint. No inline script.
 */
const HeroPreload = ({ id }: { id: ProductShotId }) => (
  <>
    {(['light', 'dark'] as const).map((theme) => {
      const scheme = theme === 'dark' ? 'dark' : 'light';
      const desktop = shotImageProps(id, theme, false);
      const mobile = shotImageProps(id, theme, true);
      return (
        <Fragment key={theme}>
          <link
            rel="preload"
            as="image"
            imageSrcSet={desktop.props.srcSet}
            imageSizes={desktop.props.sizes}
            media={`(prefers-color-scheme: ${scheme}) and (min-width: 768px)`}
            fetchPriority="high"
          />
          <link
            rel="preload"
            as="image"
            imageSrcSet={mobile.props.srcSet}
            imageSizes={mobile.props.sizes}
            media={`(prefers-color-scheme: ${scheme}) and (max-width: 767px)`}
            fetchPriority="high"
          />
        </Fragment>
      );
    })}
  </>
);

const ThemePicture = ({
  id,
  theme,
  alt,
  className,
}: {
  id: ProductShotId;
  theme: ShotTheme;
  alt: string;
  className: string;
}) => {
  const desktop = shotImageProps(id, theme, false);
  const mobile = shotImageProps(id, theme, true);

  const { src, srcSet, width, height, sizes, decoding } = mobile.props;

  return (
    <picture className={className}>
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
        loading="lazy"
        fetchPriority="auto"
        decoding={decoding}
        alt={alt}
        className="size-full object-cover object-top"
      />
    </picture>
  );
};

export const ProductShot = ({
  id,
  alt,
  priority = false,
  className,
}: ProductShotProps) => {
  return (
    <figure
      className={cn(
        'overflow-hidden rounded-xl border border-border bg-card shadow-card',
        className,
      )}
    >
      <div className="relative aspect-[9/16] max-h-[32rem] md:aspect-video md:max-h-none">
        <ThemePicture id={id} theme="light" alt={alt} className="landing-shot-light" />
        <ThemePicture id={id} theme="dark" alt={alt} className="landing-shot-dark" />
        {priority ? <HeroPreload id={id} /> : null}
      </div>
    </figure>
  );
};
