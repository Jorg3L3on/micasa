'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { HandCoins } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useFinanceContext } from '@/context/finance-context';
import { buildOwnerQuery } from '@/lib/api/client-fetch';
import { listLoans } from '@/lib/api/loans';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { LoanListItem } from '@/types/loans';

type LinkedLoansCardProps = {
  walletId: number;
};

export default function LinkedLoansCard({ walletId }: LinkedLoansCardProps) {
  const { context } = useFinanceContext();
  const [loans, setLoans] = useState<LoanListItem[]>([]);

  const ownerQueryString = useMemo(() => {
    const q = buildOwnerQuery(context);
    const s = q.toString();
    return s ? `?${s}` : '';
  }, [context]);

  useEffect(() => {
    if (context.id === 0) return;
    let cancelled = false;
    listLoans(context)
      .then((items) => {
        if (cancelled) return;
        setLoans(
          items.filter(
            (loan) =>
              loan.linkedWalletId === walletId ||
              loan.sourceWalletId === walletId,
          ),
        );
      })
      .catch(() => {
        if (!cancelled) setLoans([]);
      });
    return () => {
      cancelled = true;
    };
  }, [context, walletId]);

  if (loans.length === 0) return null;

  return (
    <Card className="overflow-hidden border-border/60 border-l-[3px] border-l-sky-500/50">
      <CardHeader className="flex flex-row items-center gap-3 space-y-0">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-sky-500/10 dark:bg-sky-500/15">
          <HandCoins className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
        </span>
        <CardTitle className="text-sm font-semibold">
          Prestamos relacionados
        </CardTitle>
        <Badge variant="secondary" className="ml-auto text-[10px] tabular-nums">
          {loans.length}
        </Badge>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {loans.map((loan) => (
            <li
              key={loan.id}
              className="rounded-lg border border-border/60 px-3 py-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/loans${ownerQueryString}`}
                    className="truncate text-sm font-semibold hover:underline"
                  >
                    {loan.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {loan.lender}
                    {loan.nextPayment
                      ? ` · Proximo ${formatDate(loan.nextPayment.dueDate)}`
                      : ''}
                    {loan.sourceWalletId === walletId
                      ? ' · Se paga desde esta billetera'
                      : loan.linkedWalletId === walletId
                        ? ' · Cuenta vinculada'
                        : ''}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-sm font-bold tabular-nums">
                    {formatCurrency(loan.remainingAmount)}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    pendiente
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
