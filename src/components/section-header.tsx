import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { MONTHLY_ICON_PILL_CLASS } from '@/components/monthly/monthly-panel-shell';
import { cn } from '@/lib/utils';

type SectionHeaderProps = {
  id?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Small label above the title. Uses the eyebrow utility. */
  eyebrow?: ReactNode;
  icon?: LucideIcon;
  actions?: ReactNode;
  /** Page sections are h2. Nested sections are h3. */
  level?: 2 | 3;
  className?: string;
  titleClassName?: string;
};

/**
 * The only section heading. PageTitle is the single h1.
 */
export const SectionHeader = ({
  id,
  title,
  subtitle,
  eyebrow,
  icon: Icon,
  actions,
  level = 2,
  className,
  titleClassName,
}: SectionHeaderProps) => {
  const Heading = level === 3 ? 'h3' : 'h2';

  return (
    <div className={cn('flex min-w-0 items-start justify-between gap-3', className)}>
      <div className="flex min-w-0 items-start gap-2.5">
        {Icon ? (
          <span className={MONTHLY_ICON_PILL_CLASS} aria-hidden>
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
        <div className="min-w-0 pt-0.5">
          {eyebrow ? <p className="eyebrow text-muted-foreground">{eyebrow}</p> : null}
          <Heading id={id} className={cn('text-section text-foreground', titleClassName)}>
            {title}
          </Heading>
          {subtitle ? (
            <p className="mt-1.5 text-caption leading-snug text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
    </div>
  );
};
