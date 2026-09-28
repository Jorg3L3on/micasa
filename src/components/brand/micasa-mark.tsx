import Image from 'next/image';

import { cn } from '@/lib/utils';

type MicasaMarkProps = {
  className?: string;
  /** Accessible name when the mark stands alone. Omit when adjacent text labels it. */
  title?: string;
};

/**
 * Brand isotipo. Display asset is the 160px `public/brand/mark-160.png`.
 * Icon generation still reads the source `public/brand/mark.png`.
 */
export const MicasaMark = ({ className, title }: MicasaMarkProps) => {
  const isDecorative = !title;

  return (
    <span
      className={cn('relative inline-block shrink-0', className)}
      aria-hidden={isDecorative ? true : undefined}
    >
      <Image
        src="/brand/mark-160.png"
        alt={isDecorative ? '' : title}
        fill
        sizes="48px"
        className="object-contain"
      />
    </span>
  );
};
