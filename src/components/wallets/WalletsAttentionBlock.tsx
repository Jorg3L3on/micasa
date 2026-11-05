import { AlertTriangle } from 'lucide-react';
import { MONTHLY_PANEL_SHELL_CLASS } from '@/components/monthly/monthly-panel-shell';
import type {
  WalletAttentionItem,
  WalletAttentionReason,
} from '@/lib/ui/wallet-cover-flow';
import { cn } from '@/lib/utils';

const reasonLabel = (item: WalletAttentionItem): string => {
  const reason: WalletAttentionReason = item.reason;
  switch (reason) {
    case 'due-soon':
      return item.daysUntilDue === 0
        ? 'Pago vence hoy'
        : item.daysUntilDue === 1
          ? 'Pago vence mañana'
          : `Pago vence en ${item.daysUntilDue} días`;
    case 'missing-due-day':
      return 'Falta la fecha de pago';
    case 'negative-balance':
      return 'Saldo negativo';
    case 'over-limit':
      return 'Límite excedido';
  }
};

type WalletsAttentionBlockProps = {
  items: WalletAttentionItem[];
  onSelect: (walletId: number) => void;
};

export const WalletsAttentionBlock = ({
  items,
  onSelect,
}: WalletsAttentionBlockProps) => {
  if (items.length === 0) return null;
  return (
    <section
      aria-label="Requiere atención"
      className={cn(MONTHLY_PANEL_SHELL_CLASS, 'p-3 sm:p-4')}
    >
      <div className="mb-2 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-status-pending" aria-hidden />
        <h2 className="text-section text-foreground">Requiere atención</h2>
      </div>
      <ul className="divide-y divide-border/60">
        {items.map((item) => (
          <li key={`${item.wallet.id}-${item.reason}`}>
            <button
              type="button"
              onClick={() => onSelect(item.wallet.id)}
              className="flex min-h-11 w-full items-center justify-between gap-3 py-2 text-left"
            >
              <span className="truncate text-sm font-medium text-foreground">
                {item.wallet.name}
              </span>
              <span
                className={cn(
                  'shrink-0 text-caption',
                  item.reason === 'over-limit' ||
                    item.reason === 'negative-balance'
                    ? 'text-status-overdue'
                    : 'text-status-pending',
                )}
              >
                {reasonLabel(item)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
};
