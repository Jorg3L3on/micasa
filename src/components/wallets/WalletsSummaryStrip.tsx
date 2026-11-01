import { MONTHLY_PANEL_SHELL_CLASS } from '@/components/monthly/monthly-panel-shell';
import type { WalletTotals } from '@/lib/ui/wallet-cover-flow';
import { cn, formatCurrency } from '@/lib/utils';

/** Totals over every active wallet; web only (`md` and up). */
export const WalletsSummaryStrip = ({ totals }: { totals: WalletTotals }) => {
  const items = [
    { label: 'Liquidez total', value: totals.liquidity },
    { label: 'Deuda en tarjetas', value: totals.cardDebt },
    { label: 'Crédito disponible', value: totals.availableCredit },
  ];
  return (
    <div
      className={cn(
        MONTHLY_PANEL_SHELL_CLASS,
        'hidden grid-cols-3 gap-6 p-4 md:grid',
      )}
      aria-label="Resumen de billeteras"
    >
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <p className="text-caption text-muted-foreground">{item.label}</p>
          <p className="truncate text-2xl font-semibold tabular-nums text-foreground">
            {formatCurrency(item.value)}
          </p>
        </div>
      ))}
    </div>
  );
};
