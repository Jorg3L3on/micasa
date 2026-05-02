'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { BadgeCheck, BookmarkIcon, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import {
  type PaymentMethodType,
  PAYMENT_METHOD_LABELS,
} from '@/domain/payment-method';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn, formatCurrency } from '@/lib/utils';
import type { WalletListItem } from '@/types/catalog';
import { WalletIdentity } from '@/components/wallets/WalletIdentity';

const CREDIT_TYPES: PaymentMethodType[] = ['CREDIT_CARD', 'DEPARTMENT_STORE_CARD'];

const isCreditType = (type: string) =>
  CREDIT_TYPES.includes(type as PaymentMethodType);

type WalletListCardProps = {
  wallet: WalletListItem;
  ownerQueryString: string;
  onEdit: (wallet: WalletListItem) => void;
  onDelete: (wallet: WalletListItem) => void;
};

export const WalletListCard = ({
  wallet,
  ownerQueryString,
  onEdit,
  onDelete,
}: WalletListCardProps) => {
  const isCard = isCreditType(wallet.type);
  const isFunding = wallet.type === 'CASH' || wallet.type === 'DEBIT_CARD';
  const subtitle =
    isCard && wallet.cutoff_day != null && wallet.due_day != null
      ? `Corte ${wallet.cutoff_day} / Pago ${wallet.due_day}`
      : null;

  const accentClass = isCard
    ? 'border-l-violet-500/50'
    : 'border-l-emerald-500/50';

  let availableDisplay: ReactNode;
  if (isCard) {
    if (wallet.credit_limit == null) {
      availableDisplay = (
        <span className="text-muted-foreground">Sin línea</span>
      );
    } else {
      const available = wallet.credit_limit - wallet.amount;
      availableDisplay = (
        <span
          className={cn(
            'font-mono tabular-nums text-sm font-bold',
            available < 0
              ? 'text-destructive'
              : 'text-emerald-600 dark:text-emerald-400',
          )}
        >
          {formatCurrency(available)}
        </span>
      );
    }
  } else {
    availableDisplay = (
      <span
        className={cn(
          'font-mono tabular-nums text-sm',
          wallet.amount > 0
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-muted-foreground',
        )}
      >
        {formatCurrency(wallet.amount)}
      </span>
    );
  }

  return (
    <article
      className={cn(
        'flex flex-col rounded-xl border border-border/60 border-l-[3px] bg-card p-4 shadow-sm',
        accentClass,
      )}
      aria-label={wallet.name}
    >
      <div className="flex items-start justify-between gap-2">
        <WalletIdentity
          name={wallet.name}
          providerIconKey={wallet.provider_icon_key}
          subtitle={subtitle}
          nameClassName={cn(!wallet.active && 'text-muted-foreground')}
          className="min-w-0 flex-1"
        />
        <div className="flex shrink-0 items-center gap-1">
          {wallet.active ? (
            <Badge variant="secondary">
              <BadgeCheck data-icon="inline-start" />
              Activo
            </Badge>
          ) : (
            <Badge variant="outline">
              <BookmarkIcon data-icon="inline-end" />
              Inactivo
            </Badge>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                aria-label={`Más opciones para ${wallet.name}`}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {isCard ? (
                <DropdownMenuItem asChild>
                  <Link
                    href={`/credit-cards/${wallet.id}${ownerQueryString}`}
                    className="cursor-pointer"
                  >
                    Ver estado de cuenta
                  </Link>
                </DropdownMenuItem>
              ) : null}
              {isFunding ? (
                <DropdownMenuItem asChild>
                  <Link
                    href={`/wallets/${wallet.id}${ownerQueryString}`}
                    className="cursor-pointer"
                  >
                    Ver movimientos
                  </Link>
                </DropdownMenuItem>
              ) : null}
              {(isCard || isFunding) ? <DropdownMenuSeparator /> : null}
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
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {isCard ? 'Deuda' : 'Saldo'}
          </p>
          <p
            className={cn(
              'font-mono tabular-nums text-sm',
              isCard && wallet.amount > 0 && 'font-bold text-foreground',
            )}
          >
            {formatCurrency(wallet.amount)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Disponible
          </p>
          <div className="mt-0.5">{availableDisplay}</div>
        </div>
      </div>

      <p className="mt-3 text-[10px] text-muted-foreground">
        {PAYMENT_METHOD_LABELS[wallet.type as PaymentMethodType]}
      </p>
    </article>
  );
};
