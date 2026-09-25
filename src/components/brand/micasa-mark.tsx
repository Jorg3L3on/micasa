import { cn } from '@/lib/utils';

type MicasaMarkProps = {
  className?: string;
  /** Accessible name when the mark stands alone. Omit when adjacent text labels it. */
  title?: string;
};

/** Brand isotipo. Artwork is `public/brand/mark.png` — do not redraw it. */
export const MicasaMark = ({ className, title }: MicasaMarkProps) => {
  const isDecorative = !title;

  return (
    // Sized by the caller (h-7, size-10, …). next/image's width style would override that.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/mark.png"
      alt={isDecorative ? '' : title}
      aria-hidden={isDecorative ? true : undefined}
      className={cn('shrink-0 object-contain', className)}
    />
  );
};
