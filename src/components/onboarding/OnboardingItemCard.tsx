'use client';

import { type ReactNode } from 'react';
import { OVERLAY_GROUPED_CARD_CLASS } from '@/components/overlay/overlay-form';
import { OnboardingDeletableRow } from '@/components/onboarding/OnboardingDeletableRow';

type OnboardingItemCardProps = {
  /** Leading badge in the header (provider icon, category glyph…). */
  leading?: ReactNode;
  title: string;
  subtitle?: string;
  canDelete: boolean;
  /** Noun for the confirm copy, e.g. "billetera". */
  itemNoun: string;
  onDelete: () => void;
  children: ReactNode;
};

/**
 * One draft (wallet, income, expense) in the onboarding wizard: a grouped-row
 * card with a header. Delete follows the viewport rule (swipe below `md`,
 * trash from `md`) and always confirms.
 */
export function OnboardingItemCard({
  leading,
  title,
  subtitle,
  canDelete,
  itemNoun,
  onDelete,
  children,
}: OnboardingItemCardProps) {
  const trimmedTitle = title.trim();
  const displayTitle =
    trimmedTitle || `${itemNoun[0].toUpperCase()}${itemNoun.slice(1)} sin nombre`;

  return (
    <OnboardingDeletableRow
      name={title}
      canDelete={canDelete}
      itemNoun={itemNoun}
      onDelete={onDelete}
    >
      {(deleteButton) => (
        <div className={OVERLAY_GROUPED_CARD_CLASS}>
          <div className="flex min-h-11 items-center gap-3 bg-muted/30 px-3 py-2">
            {leading}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground" title={displayTitle}>
                {displayTitle}
              </p>
              {subtitle ? (
                <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
              ) : null}
            </div>
            {deleteButton}
          </div>
          {children}
        </div>
      )}
    </OnboardingDeletableRow>
  );
}
