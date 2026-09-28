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

/**
 * Both themes are in the first HTML. `.dark` on `<html>` (next-themes, class
 * strategy) shows one picture and hides the other. Nothing swaps `src` after
 * paint. Every img is `loading="lazy"`, so a `display: none` picture is not
 * fetched. The hero preloads only the picture that is visible for this class.
 */
const HERO_PRELOAD_SCRIPT = `(function(){var s=document.currentScript;if(!s||!s.parentElement)return;var dark=document.documentElement.classList.contains("dark");var picture=s.parentElement.querySelector(dark?".landing-shot-dark":".landing-shot-light");if(!picture)return;var source=Array.prototype.find.call(picture.querySelectorAll("source"),function(node){return node.media&&window.matchMedia(node.media).matches;});var img=picture.querySelector("img");var link=document.createElement("link");link.rel="preload";link.as="image";link.setAttribute("fetchpriority","high");if(source){link.setAttribute("imagesrcset",source.getAttribute("srcset")||"");link.setAttribute("imagesizes",source.getAttribute("sizes")||"");}else if(img){link.href=img.getAttribute("src")||"";}else{return;}document.head.appendChild(link);})();`;

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
  const desktop = getImageProps({
    alt: '',
    src: `/landing/${id}-desktop-${theme}.webp`,
    width: DESKTOP.width,
    height: DESKTOP.height,
    sizes: '(min-width: 768px) 42rem, 100vw',
  });

  const mobile = getImageProps({
    alt,
    src: `/landing/${id}-mobile-${theme}.webp`,
    width: MOBILE.width,
    height: MOBILE.height,
    sizes: '100vw',
  });

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
        {priority ? <script dangerouslySetInnerHTML={{ __html: HERO_PRELOAD_SCRIPT }} /> : null}
      </div>
    </figure>
  );
};
