'use client';

import type { ReactNode } from 'react';
import { Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Money } from '@/components/money';
import { SwipeDeleteRow } from '@/components/ui/swipe-delete-row';
import { useIsMobile } from '@/hooks/use-mobile';
import type { MoneyTone } from '@/lib/money';
import { cn } from '@/lib/utils';

type TemplateSwipeRowProps = {
  name: string;
  subtitle?: ReactNode;
  amount: number | null;
  /** Same tone as the desktop amount cell. */
  tone?: MoneyTone;
  active: boolean;
  onEdit: () => void;
  onRequestDelete: () => void;
};

/** Mobile plantilla row: tap edits, swipe left deletes (Viewport Delete Rule). */
export const TemplateSwipeRow = ({
  name,
  subtitle,
  amount,
  tone = 'auto',
  active,
  onEdit,
  onRequestDelete,
}: TemplateSwipeRowProps) => {
  const isMobile = useIsMobile();

  return (
    <SwipeDeleteRow
      enabled={isMobile}
      onRequestDelete={onRequestDelete}
      deleteAriaLabel={`Eliminar ${name}`}
    >
      <div
        className={cn('px-3 py-2.5', !active && 'text-muted-foreground')}
      >
        <button
          type="button"
          onClick={onEdit}
          className="flex w-full min-w-0 items-center gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <span className="sr-only">Editar </span>
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm font-medium">{name}</span>
              {!active ? (
                <Badge
                  variant="outline"
                  className="shrink-0 px-1.5 py-0 eyebrow"
                >
                  Inactiva
                </Badge>
              ) : null}
            </span>
            {subtitle ? (
              <span
                className="mt-0.5 block text-pretty text-xs text-muted-foreground"
                title={typeof subtitle === 'string' ? subtitle : undefined}
              >
                {subtitle}
              </span>
            ) : null}
          </span>
          <span className="shrink-0">
            {amount != null ? (
              <Money value={amount} size="row" tone={tone} />
            ) : (
              '—'
            )}
          </span>
          <Pencil
            className="h-4 w-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
        </button>
      </div>
    </SwipeDeleteRow>
  );
};
