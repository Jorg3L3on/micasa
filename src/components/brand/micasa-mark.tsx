import Image from 'next/image';

import { cn } from '@/lib/utils';

type MicasaMarkProps = {
  className?: string;
  /** Accessible name when the mark stands alone. Omit when adjacent text labels it. */
  title?: string;
  /** Header mark. Preloads so the first paint is not an empty box. */
  priority?: boolean;
};

/**
 * Brand isotipo (roof over an "M", #2563EB → #8B3FD9). Displays the exported
 * `public/brand/mark.svg`; `scripts/import-brand-assets.mjs` keeps it in sync.
 */
export const MicasaMark = ({ className, title, priority = false }: MicasaMarkProps) => {
  const isDecorative = !title;

  return (
    <span
      className={cn('relative inline-block shrink-0', className)}
      aria-hidden={isDecorative ? true : undefined}
    >
      <Image
        src="/brand/mark.svg"
        alt={isDecorative ? '' : title}
        fill
        unoptimized
        priority={priority}
        className="object-contain"
      />
    </span>
  );
};
