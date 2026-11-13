'use client';

import { useEffect, useState } from 'react';
import { Money } from '@/components/money';
import {
  OVERLAY_GROUPED_CARD_CLASS,
  OverlaySectionLabel,
} from '@/components/overlay/overlay-form';
import { useFinanceContext } from '@/context/finance-context';
import { clientFetchFromApi } from '@/lib/api/client-fetch';
import type { ScheduledHistoryEntry } from '@/lib/finance/scheduled-history.service';
import type { ScheduledKind } from '@/lib/ui/scheduled-items';
import { STATUS_BADGE_CLASS } from '@/lib/status-tone';
import { cn } from '@/lib/utils';
import {
  HISTORY_STATUS,
  HISTORY_TITLE,
  historyEndpoint,
  historyLabel,
} from './scheduled-history';

type ScheduledHistoryProps = {
  kind: ScheduledKind;
  id: number;
};

/**
 * Loads the last records of one programado when the detail opens. Renders
 * nothing while loading, on error, or when the item has created none. The
 * caller keys it by item, so another item starts from an empty state.
 */
export const ScheduledHistory = ({ kind, id }: ScheduledHistoryProps) => {
  const { context } = useFinanceContext();
  const [entries, setEntries] = useState<ScheduledHistoryEntry[] | null>(null);

  useEffect(() => {
    let alive = true;
    clientFetchFromApi<ScheduledHistoryEntry[]>(historyEndpoint(kind, id), undefined, context)
      .then((data) => {
        if (alive) setEntries(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (alive) setEntries([]);
      });
    return () => {
      alive = false;
    };
  }, [kind, id, context]);

  if (!entries || entries.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5" data-testid="scheduled-history">
      <OverlaySectionLabel>{HISTORY_TITLE}</OverlaySectionLabel>
      <ul className={OVERLAY_GROUPED_CARD_CLASS}>
        {entries.map((entry) => {
          const status = HISTORY_STATUS[entry.status];
          return (
            <li
              key={entry.id}
              className="flex min-h-11 items-center justify-between gap-3 px-3 text-sm"
            >
              <span className="min-w-0 truncate">{historyLabel(entry)}</span>
              <span className="flex shrink-0 items-center gap-2.5">
                <Money
                  value={entry.amount}
                  size="row"
                  tone="neutral"
                  className="font-semibold"
                />
                <span
                  className={cn(
                    'rounded-full px-2 py-px text-caption font-medium',
                    STATUS_BADGE_CLASS[status.tone],
                  )}
                >
                  {status.label}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
