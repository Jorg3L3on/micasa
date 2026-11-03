'use client';

import Link from 'next/link';
import {
  ArrowLeftRight,
  Banknote,
  Diff,
  ExternalLink,
  ShoppingCart,
  SlidersHorizontal,
} from 'lucide-react';
import {
  isCreditOrStoreCardWalletType,
  PAYMENT_METHOD_LABELS,
  type PaymentMethodType,
} from '@/domain/payment-method';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { WalletRecentMovements } from '@/components/wallets/WalletRecentMovements';
import type { WalletFlowActions } from '@/components/wallets/WalletFlowDetails';
import { effectiveCreditLimit } from '@/lib/ui/wallet-cover-flow';
import { splitMoneyCents } from '@/lib/ui/wallet-master-detail';
import { cn, formatCurrency } from '@/lib/utils';
import type { WalletListItem } from '@/types/catalog';

type WalletDetailPaneProps = WalletFlowActions & {
  wallet: WalletListItem;
  /** Full detail page (`/wallets/[id]` or `/credit-cards/[id]`). */
  fullPageHref: string;
  /** Same page with the movements tab preselected. */
  movementsHref: string;
};

const Metric = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0">
    <dt className="text-caption text-muted-foreground">{label}</dt>
    <dd className="truncate text-sm font-semibold tabular-nums text-foreground">{value}</dd>
  </div>
);

/** Right pane of the web Billeteras page: hero balance, actions, summary, movements. */
export const WalletDetailPane = ({
  wallet,
  fullPageHref,
  movementsHref,
  onMovement,
  onTransfer,
  onPurchase,
  onPay,
  payPendingId,
  onAdjustBalance,
}: WalletDetailPaneProps) => {
  const isCard = isCreditOrStoreCardWalletType(wallet.type);
  const amount = Number(wallet.amount) || 0;
  const { whole, cents } = splitMoneyCents(amount);
  const limit = isCard ? effectiveCreditLimit(wallet) : null;
  const available =
    limit != null && limit > 0
      ? limit - amount - (Number(wallet.loan_outstanding) || 0)
      : null;
  const typeLabel = PAYMENT_METHOD_LABELS[wallet.type as PaymentMethodType] ?? wallet.type;

  const metrics: { label: string; value: string }[] = isCard
    ? [
        ...(limit != null && limit > 0
          ? [{ label: 'Límite', value: formatCurrency(limit) }]
          : []),
        ...(available != null ? [{ label: 'Disponible', value: formatCurrency(available) }] : []),
        ...(wallet.cutoff_day != null ? [{ label: 'Corte', value: `Día ${wallet.cutoff_day}` }] : []),
        ...(wallet.due_day != null ? [{ label: 'Pago', value: `Día ${wallet.due_day}` }] : []),
        ...(wallet.minimum_payment != null
          ? [{ label: 'Pago mínimo', value: formatCurrency(wallet.minimum_payment) }]
          : []),
      ]
    : [
        {
          label: 'En liquidez',
          value: wallet.include_in_liquidity ? 'Incluida' : 'Excluida',
        },
      ];

  const primary = isCard
    ? { label: 'Pagar', icon: Banknote, onClick: () => onPay(wallet), busy: payPendingId === wallet.id }
    : { label: 'Movimiento', icon: Diff, onClick: () => onMovement(wallet), busy: false };
  const secondary = isCard
    ? [{ label: 'Compra', icon: ShoppingCart, onClick: () => onPurchase(wallet) }]
    : [{ label: 'Transferir', icon: ArrowLeftRight, onClick: () => onTransfer(wallet) }];

  return (
    <section
      aria-label={`Detalle de ${wallet.name}`}
      className="min-w-0 space-y-6 rounded-2xl border border-border bg-card p-6 shadow-panel"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
          <span className="truncate">{wallet.name}</span>
          <Badge variant="secondary">{typeLabel}</Badge>
          {!wallet.active ? <Badge variant="outline">Inactiva</Badge> : null}
        </div>
        <Button asChild variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
          <Link href={fullPageHref}>
            Abrir página completa
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </Button>
      </div>

      <div>
        <p className="text-caption text-muted-foreground">{isCard ? 'Usado' : 'Saldo'}</p>
        <p
          className={cn(
            'text-5xl font-semibold tabular-nums tracking-tight',
            amount < 0 ? 'text-status-overdue' : 'text-foreground',
          )}
          aria-label={formatCurrency(amount)}
        >
          {whole}
          <span className="text-muted-foreground">{cents}</span>
        </p>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label={`Acciones de ${wallet.name}`}>
        <Button
          type="button"
          className="rounded-xl px-5"
          disabled={primary.busy}
          aria-busy={primary.busy || undefined}
          onClick={primary.onClick}
        >
          <primary.icon className="h-4 w-4" aria-hidden />
          {primary.label}
        </Button>
        {secondary.map(({ label, icon: Icon, onClick }) => (
          <Button key={label} type="button" variant="outline" className="rounded-xl px-5" onClick={onClick}>
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </Button>
        ))}
        <Button
          type="button"
          variant="outline"
          className="rounded-xl px-5"
          onClick={() => onAdjustBalance(wallet)}
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          Ajustar saldo
        </Button>
      </div>

      <dl className="grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-4">
        {metrics.map((metric) => (
          <Metric key={metric.label} {...metric} />
        ))}
      </dl>

      <WalletRecentMovements wallet={wallet} detailHref={movementsHref} />
    </section>
  );
};
