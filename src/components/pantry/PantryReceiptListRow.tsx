'use client';

import type { KeyboardEvent } from 'react';
import {
  AlertTriangle,
  Download,
  Loader2,
  MoreHorizontal,
  Trash2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn, formatCurrency } from '@/lib/utils';
import type { PantryReceiptListItemDto } from '@/types/pantry-receipt';
import { SHOPPING_STORE_LABELS } from '@/types/shopping-store';

const formatShortDate = (iso: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const getReceiptDisplayTotal = (receipt: PantryReceiptListItemDto): number =>
  receipt.grand_total ?? receipt.lines_sum;

export type PantryReceiptListRowProps = {
  receipt: PantryReceiptListItemDto;
  downloading: boolean;
  onOpenDetail: () => void;
  onDownload: () => void;
  onDelete: () => void;
};

export const PantryReceiptListRow = ({
  receipt,
  downloading,
  onOpenDetail,
  onDownload,
  onDelete,
}: PantryReceiptListRowProps) => {
  const total = getReceiptDisplayTotal(receipt);
  const title = receipt.title ?? 'Sin título';
  const storeLabel = receipt.store ? SHOPPING_STORE_LABELS[receipt.store] : '—';

  const handleRowKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpenDetail();
    }
  };

  return (
    <li className="list-none">
      <div
        className={cn(
          'flex gap-2 rounded-xl border border-border/60 bg-card p-3 shadow-sm transition-colors',
          'hover:bg-muted/40',
        )}
      >
        <button
          type="button"
          className="min-w-0 flex-1 rounded-lg px-1 py-0.5 text-left outline-none transition-colors hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onOpenDetail}
          onKeyDown={handleRowKeyDown}
          aria-label={`Abrir recibo ${title}`}
        >
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium leading-tight">{title}</span>
            {receipt.parse_warnings.length > 0 ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
                Avisos al importar
              </span>
            ) : null}
            <span className="text-[11px] text-muted-foreground">
              <span className="font-mono tabular-nums">
                {formatShortDate(receipt.purchased_at)}
              </span>
              <span aria-hidden> · </span>
              <span>{storeLabel}</span>
              <span aria-hidden> · </span>
              <span className="font-mono tabular-nums">{receipt.line_count} ítems</span>
            </span>
            <div className="mt-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Total{' '}
                <span className="font-mono text-sm font-bold tabular-nums text-foreground">
                  {formatCurrency(total)}
                </span>
              </span>
            </div>
          </div>
        </button>

        <div
          className="flex shrink-0 items-start gap-0.5 pt-0.5"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {receipt.file_name ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              aria-label="Descargar archivo del recibo"
              disabled={downloading}
              onClick={() => void onDownload()}
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Download className="h-4 w-4" aria-hidden />
              )}
            </Button>
          ) : (
            <span className="flex h-9 w-9 items-center justify-center text-xs text-muted-foreground">
              —
            </span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                aria-label="Acciones del recibo"
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="h-4 w-4" />
                Eliminar recibo
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </li>
  );
};
