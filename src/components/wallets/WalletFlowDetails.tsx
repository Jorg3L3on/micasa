'use client';

import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowLeftRight,
  Banknote,
  Diff,
  ShoppingCart,
  SlidersHorizontal,
} from 'lucide-react';
import {
  type PaymentMethodType,
  PAYMENT_METHOD_LABELS,
  isCreditOrStoreCardWalletType,
} from '@/domain/payment-method';
import { RollingNumber, RollingText } from '@/components/ui/rolling-number';
import { effectiveCreditLimit } from '@/lib/ui/wallet-cover-flow';
import { cn, formatCurrency } from '@/lib/utils';
import type { WalletListItem } from '@/types/catalog';
import { Button } from '@/components/ui/button';

export type WalletFlowActions = {
  /** Cash and debit: Agregar movimiento (gasto or ingreso). */
  onMovement: (wallet: WalletListItem) => void;
  onTransfer: (wallet: WalletListItem) => void;
  /** Credit and store cards. */
  onPurchase: (wallet: WalletListItem) => void;
  onPay: (wallet: WalletListItem) => void;
  /** Wallet id whose Pagar is waiting on the statement. */
  payPendingId: number | null;
  onAdjustBalance: (wallet: WalletListItem) => void;
};

type WalletFlowDetailsProps = WalletFlowActions & {
  wallet: WalletListItem;
  isHouseContext?: boolean;
  /** Travel direction of the rail: the caption rises in from that side. */
  direction?: 1 | -1;
};

type MetricValue =
  | { amount: number }
  | { rolling: string }
  | { text: string };

const Metric = ({
  label,
  value,
  direction,
  className,
}: {
  label: string;
  value: MetricValue;
  direction: 1 | -1;
  className?: string;
}) => (
  <div className={cn('min-w-0 text-center', className)}>
    <p className="truncate text-caption text-muted-foreground">
      <RollingText text={label} direction={direction} />
    </p>
    <p className="truncate text-lg font-semibold leading-snug text-foreground">
      {'amount' in value ? (
        <RollingNumber text={formatCurrency(value.amount)} />
      ) : 'rolling' in value ? (
        <RollingNumber text={value.rolling} />
      ) : (
        <RollingText text={value.text} direction={direction} />
      )}
    </p>
  </div>
);

const ACTION_BUTTON_CLASS =
  'h-auto min-w-0 flex-col gap-1 rounded-2xl px-1 py-2.5 text-xs leading-tight';

/** Name, metrics and quick actions for the wallet centered in the cover flow. */
export const WalletFlowDetails = ({
  wallet,
  isHouseContext = false,
  direction = 1,
  onMovement,
  onTransfer,
  onPurchase,
  onPay,
  payPendingId,
  onAdjustBalance,
}: WalletFlowDetailsProps) => {
  const isCard = isCreditOrStoreCardWalletType(wallet.type);
  const amount = Number(wallet.amount) || 0;
  const limit = isCard ? effectiveCreditLimit(wallet) : null;
  const typeLabel = PAYMENT_METHOD_LABELS[wallet.type as PaymentMethodType];
  const reducedMotion = useReducedMotion() ?? false;

  const metrics: { label: string; value: MetricValue }[] = isCard
    ? [
        {
          label: 'Disponible',
          value:
            limit != null && limit > 0
              ? { amount: limit - amount - (wallet.loan_outstanding ?? 0) }
              : { text: 'Sin línea' },
        },
        {
          label: 'Límite',
          value:
            limit != null && limit > 0
              ? { amount: limit }
              : { text: 'Sin línea' },
        },
        {
          label: 'Próximo pago',
          value:
            wallet.due_day != null
              ? { rolling: `Día ${wallet.due_day}` }
              : { text: 'Sin fecha' },
        },
      ]
    : [
        { label: 'Saldo', value: { amount } },
        ...(wallet.include_in_liquidity
          ? []
          : [{ label: 'Liquidez', value: { text: 'Excluida' } }]),
        ...(isHouseContext
          ? [
              {
                label: 'Responsable',
                value: { text: wallet.assignee?.name ?? 'Compartida' },
              },
            ]
          : []),
      ];

  const actions = isCard
    ? [
        { key: 'purchase', label: 'Compra', icon: ShoppingCart, onClick: () => onPurchase(wallet), busy: false },
        { key: 'pay', label: 'Pagar', icon: Banknote, onClick: () => onPay(wallet), busy: payPendingId === wallet.id },
        { key: 'adjust', label: 'Ajustar saldo', icon: SlidersHorizontal, onClick: () => onAdjustBalance(wallet), busy: false },
      ]
    : [
        { key: 'movement', label: 'Movimiento', icon: Diff, onClick: () => onMovement(wallet), busy: false },
        { key: 'transfer', label: 'Transferir', icon: ArrowLeftRight, onClick: () => onTransfer(wallet), busy: false },
        { key: 'adjust', label: 'Ajustar saldo', icon: SlidersHorizontal, onClick: () => onAdjustBalance(wallet), busy: false },
      ];

  return (
    <div className="mt-4 w-full">
      <div className="text-center">
        <motion.div
          key={wallet.id}
          className="min-w-0"
          initial={{ opacity: 0, x: reducedMotion ? 0 : direction * 14 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: reducedMotion ? 0.12 : 0.28, ease: [0.16, 1, 0.3, 1] }}
        >
          <h3 className="truncate text-lg font-semibold text-foreground">
            {wallet.name}
          </h3>
          <p className="truncate text-body text-muted-foreground">
            {isCard && wallet.cutoff_day != null
              ? `${typeLabel} · Corte ${wallet.cutoff_day}`
              : typeLabel}
          </p>
        </motion.div>
      </div>

      <div className="mt-5 flex flex-col items-center gap-4 md:border-t md:border-border/60 md:pt-4">
        <div
          className={cn(
            'flex w-full gap-x-6 gap-y-3 px-2',
            // Three or more columns spread edge to edge; one or two stay centered.
            metrics.length > 2 ? 'justify-between' : 'justify-center gap-x-10',
          )}
        >
          {metrics.map((metric) => (
            <Metric
              key={metric.label}
              label={metric.label}
              value={metric.value}
              direction={direction}
            />
          ))}
        </div>
        <div
          className="grid w-full max-w-md grid-cols-3 gap-2"
          role="group"
          aria-label={`Acciones de ${wallet.name}`}
        >
          {actions.map(({ key, label, icon: Icon, onClick, busy }) => (
            <Button
              key={key}
              type="button"
              variant="outline"
              className={ACTION_BUTTON_CLASS}
              disabled={busy}
              aria-busy={busy || undefined}
              onClick={onClick}
            >
              <Icon className="h-5 w-5" aria-hidden />
              {label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};
