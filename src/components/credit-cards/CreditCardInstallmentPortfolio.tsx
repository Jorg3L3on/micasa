'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { CalendarClock, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CreditCardFeedEmpty } from '@/components/credit-cards/CreditCardTransactionFeed';
import {
  buildInstallmentPortfolio,
  sumInstallmentExposure,
} from '@/lib/finance/credit-card-installment-portfolio';
import type { CreditCardStatementPurchaseItem } from '@/types/catalog';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { CategoryLabel } from '@/components/categories/CategoryLabel';

type CreditCardInstallmentPortfolioProps = {
  purchases: CreditCardStatementPurchaseItem[];
  ownerQueryString: string;
  onRegisterPurchase: () => void;
};

export const CreditCardInstallmentPortfolio = ({
  purchases,
  ownerQueryString,
  onRegisterPurchase,
}: CreditCardInstallmentPortfolioProps) => {
  const portfolio = useMemo(
    () => buildInstallmentPortfolio(purchases),
    [purchases],
  );

  const totalExposure = useMemo(
    () => sumInstallmentExposure(portfolio),
    [portfolio],
  );

  if (portfolio.length === 0) {
    return (
      <CreditCardFeedEmpty
        message="Sin cuotas vigentes"
        description="Las compras a meses con pagos pendientes aparecerán aquí como un portafolio con progreso y saldo restante."
        action={{
          label: 'Registrar compra a meses',
          onClick: onRegisterPurchase,
        }}
      />
    );
  }

  return (
    <div className="space-y-4" role="region" aria-label="Cuotas vigentes">
      <div className="rounded-2xl border border-border/60 border-l-[3px] border-l-violet-500/50 bg-card px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Exposición MSI total
        </p>
        <p className="font-mono text-2xl font-bold tabular-nums tracking-tight">
          {formatCurrency(totalExposure)}
        </p>
        <p className="text-xs text-muted-foreground">
          {portfolio.length} compra{portfolio.length === 1 ? '' : 's'} activa
          {portfolio.length === 1 ? '' : 's'}
        </p>
      </div>

      <ul className="space-y-3">
        {portfolio.map((item) => {
          const href = `/fortnight/${item.purchase.fortnight_year}/${String(item.purchase.fortnight_month).padStart(2, '0')}/${item.purchase.fortnight_period}${ownerQueryString}`;
          return (
            <li key={item.purchase.id}>
              <Link
                href={href}
                className="block rounded-2xl border border-border/60 bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {item.purchase.description}
                    </p>
                    <CategoryLabel
                      name={item.purchase.category}
                      icon={item.purchase.categoryIcon}
                      className="text-[11px] text-muted-foreground"
                    />
                  </div>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
                    <CreditCard className="h-4 w-4" aria-hidden />
                  </span>
                </div>

                <div className="mb-2 flex items-end justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Cuota {item.currentInstallment} de {item.totalInstallments}
                    </p>
                    <p className="font-mono text-lg font-bold tabular-nums">
                      {formatCurrency(item.purchase.amount)}
                      <span className="text-xs font-normal text-muted-foreground"> / mes</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground">Restante</p>
                    <p className="font-mono text-sm font-bold tabular-nums text-amber-600 dark:text-amber-400">
                      {formatCurrency(item.remainingAmount)}
                    </p>
                  </div>
                </div>

                <div className="mb-2 flex h-1.5 w-full overflow-hidden rounded-full bg-muted/50">
                  <div
                    className="h-full rounded-full bg-violet-500 dark:bg-violet-400"
                    style={{ width: `${Math.max(item.progressPct, 2)}%` }}
                  />
                </div>

                <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <CalendarClock className="h-3 w-3 shrink-0" aria-hidden />
                  Compra del {formatDate(item.purchase.payment_date)} ·{' '}
                  {item.remainingInstallments} cuota
                  {item.remainingInstallments === 1 ? '' : 's'} pendiente
                  {item.remainingInstallments === 1 ? '' : 's'}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>

      <Button
        type="button"
        variant="outline"
        className="h-10 w-full rounded-xl"
        onClick={onRegisterPurchase}
      >
        Registrar compra a meses
      </Button>
    </div>
  );
};
