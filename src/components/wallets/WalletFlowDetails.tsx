'use client';

import { motion, useReducedMotion } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowLeftRight,
  CirclePlus,
  MoreHorizontal,
  Pencil,
  SlidersHorizontal,
  Trash2,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type WalletFlowActions = {
  onTransfer: (wallet: WalletListItem) => void;
  onIncome: (wallet: WalletListItem) => void;
  onAdjustBalance: (wallet: WalletListItem) => void;
  onEdit: (wallet: WalletListItem) => void;
  onDelete: (wallet: WalletListItem) => void;
};

type WalletFlowDetailsProps = WalletFlowActions & {
  wallet: WalletListItem;
  detailHref: string;
  isHouseContext?: boolean;
  /** Travel direction of the rail: the caption rises in from that side. */
  direction?: 1 | -1;
};

type MetricValue = { amount: number } | { text: string };

const Metric = ({
  label,
  value,
  direction,
}: {
  label: string;
  value: MetricValue;
  direction: 1 | -1;
}) => (
  <div className="min-w-0">
    <p className="truncate text-caption text-muted-foreground">
      <RollingText text={label} direction={direction} />
    </p>
    <p className="truncate text-lg font-semibold leading-snug text-foreground">
      {'amount' in value ? (
        <RollingNumber text={formatCurrency(value.amount)} />
      ) : (
        <RollingText text={value.text} direction={direction} />
      )}
    </p>
  </div>
);

const ACTION_BUTTON_CLASS =
  'h-11 w-full justify-center gap-2 rounded-full md:w-auto md:min-w-32';

/** Name, metrics and quick actions for the wallet centered in the cover flow. */
export const WalletFlowDetails = ({
  wallet,
  detailHref,
  isHouseContext = false,
  direction = 1,
  onTransfer,
  onIncome,
  onAdjustBalance,
  onEdit,
  onDelete,
}: WalletFlowDetailsProps) => {
  const isCard = isCreditOrStoreCardWalletType(wallet.type);
  const amount = Number(wallet.amount) || 0;
  const limit = isCard ? effectiveCreditLimit(wallet) : null;
  const typeLabel = PAYMENT_METHOD_LABELS[wallet.type as PaymentMethodType];
  const reducedMotion = useReducedMotion() ?? false;

  const metrics = isCard ? (
    <>
      <Metric label="Usado" value={{ amount }} direction={direction} />
      <Metric
        label="Disponible"
        value={
          limit != null && limit > 0
            ? { amount: limit - amount }
            : { text: 'Sin línea' }
        }
        direction={direction}
      />
      <Metric
        label="Próximo pago"
        value={{
          text: wallet.due_day != null ? `Día ${wallet.due_day}` : 'Sin fecha',
        }}
        direction={direction}
      />
    </>
  ) : (
    <>
      <Metric label="Saldo" value={{ amount }} direction={direction} />
      <Metric
        label="Liquidez"
        value={{
          text: wallet.include_in_liquidity ? 'Incluida' : 'Excluida',
        }}
        direction={direction}
      />
      <Metric
        label={isHouseContext ? 'Responsable' : 'Tipo'}
        value={{
          text: isHouseContext
            ? (wallet.assignee?.name ?? 'Compartida')
            : typeLabel,
        }}
        direction={direction}
      />
    </>
  );

  return (
    <div className="mt-4 w-full">
      <div className="flex items-start justify-center gap-1 text-center">
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
            {isCard && wallet.cutoff_day != null && wallet.due_day != null
              ? `${typeLabel} · Corte ${wallet.cutoff_day} · Pago ${wallet.due_day}`
              : typeLabel}
          </p>
        </motion.div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="size-8 shrink-0 rounded-full"
              aria-label={`Más opciones para ${wallet.name}`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem
              onClick={() => onEdit(wallet)}
              className="cursor-pointer"
            >
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(wallet)}
              className="cursor-pointer text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:border-t md:border-border/60 md:pt-4">
        <div className="grid grid-cols-3 gap-4 md:flex md:gap-8">{metrics}</div>
        <div
          className={cn(
            'grid grid-cols-2 gap-2 md:flex md:flex-wrap md:justify-end'
          )}
          role="group"
          aria-label={`Acciones de ${wallet.name}`}
        >
          {!isCard ? (
            <>
              <Button
                type="button"
                variant="outline"
                className={ACTION_BUTTON_CLASS}
                onClick={() => onTransfer(wallet)}
              >
                <ArrowLeftRight className="h-4 w-4" aria-hidden />
                Transferir
              </Button>
              <Button
                type="button"
                variant="outline"
                className={ACTION_BUTTON_CLASS}
                onClick={() => onIncome(wallet)}
              >
                <CirclePlus className="h-4 w-4" aria-hidden />
                Registrar ingreso
              </Button>
            </>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className={ACTION_BUTTON_CLASS}
            onClick={() => onAdjustBalance(wallet)}
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            Ajustar saldo
          </Button>
          <Button
            asChild
            variant="outline"
            className={ACTION_BUTTON_CLASS}
          >
            <Link href={detailHref}>Detalles</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};
