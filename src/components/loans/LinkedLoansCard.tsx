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
import {
  getLoanPaymentSourceLabel,
  getLoanWalletRelationships,
} from '@/lib/finance/loan-wallet-relationships';
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

  const loanHref = (loan: LoanListItem) =>
    `/loans${
      ownerQueryString
        ? `${ownerQueryString}&loanId=${loan.id}`
        : `?loanId=${loan.id}`
    }`;

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
          Préstamos relacionados
        </CardTitle>
        <Badge variant="secondary" className="ml-auto text-[10px] tabular-nums">
          {loans.length}
        </Badge>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-xs text-muted-foreground">
          El origen de pago proyecta salidas; una cuenta relacionada solo sirve
          como referencia y no mueve saldo automáticamente.
        </p>
        <ul className="space-y-2">
          {loans.map((loan) => {
            const relationships = getLoanWalletRelationships(loan, walletId);

            return (
              <li
                key={loan.id}
                className="rounded-lg border border-border/60 px-3 py-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={loanHref(loan)}
                      className="truncate text-sm font-semibold hover:underline"
                    >
                      {loan.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {loan.lender}
                      {loan.nextPayment
                        ? ` · Próximo ${formatDate(loan.nextPayment.dueDate)}`
                        : ''}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge
                        variant="outline"
                        className="h-5 text-[10px] text-muted-foreground"
                      >
                        {getLoanPaymentSourceLabel(loan)}
                      </Badge>
                      {relationships.map((relationship) => (
                        <Badge
                          key={relationship.role}
                          variant={
                            relationship.role === 'payment_source'
                              ? 'default'
                              : 'secondary'
                          }
                          className="h-5 text-[10px]"
                        >
                          {relationship.label}
                        </Badge>
                      ))}
                    </div>
                    {relationships.length > 0 ? (
                      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                        {relationships
                          .map((relationship) => relationship.description)
                          .join(' ')}
                      </p>
                    ) : null}
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
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
