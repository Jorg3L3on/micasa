'use client';

import { useRef, type KeyboardEvent } from 'react';
import { Plus } from 'lucide-react';
import { PAYMENT_METHOD_LABELS, type PaymentMethodType } from '@/domain/payment-method';
import { WalletProviderIcon } from '@/components/wallets/WalletProviderIcon';
import { Money } from '@/components/money';
import type { WalletListItem } from '@/types/catalog';
import type { WalletAttentionItem, WalletTotals } from '@/lib/ui/wallet-cover-flow';
import { stepWalletSelection } from '@/lib/ui/wallet-master-detail';
import { cn, formatCurrency } from '@/lib/utils';

type WalletsMasterListProps = {
  funding: WalletListItem[];
  credit: WalletListItem[];
  totals: WalletTotals;
  attention: WalletAttentionItem[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onCreate: () => void;
};

const attentionCaption = (item: WalletAttentionItem): string => {
  switch (item.reason) {
    case 'due-soon':
      return item.daysUntilDue === 0
        ? 'Vence hoy'
        : `Vence en ${item.daysUntilDue} ${item.daysUntilDue === 1 ? 'día' : 'días'}`;
    case 'missing-due-day':
      return 'Falta fecha de pago';
    case 'over-limit':
      return 'Sobre el límite';
    default:
      return 'Saldo negativo';
  }
};

const subtitle = (wallet: WalletListItem): string => {
  const label = PAYMENT_METHOD_LABELS[wallet.type as PaymentMethodType] ?? wallet.type;
  return wallet.active ? label : `${label} · Inactiva`;
};

type RowProps = {
  wallet: WalletListItem;
  selected: boolean;
  caption: string | null;
  onSelect: (id: number) => void;
};

const WalletRow = ({ wallet, selected, caption, onSelect }: RowProps) => (
  <li>
    <button
      type="button"
      data-wallet-row={wallet.id}
      aria-current={selected ? 'true' : undefined}
      onClick={() => onSelect(wallet.id)}
      className={cn(
        'relative flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        selected ? 'bg-accent' : 'hover:bg-muted/40',
        !wallet.active && 'opacity-60',
      )}
    >
      {selected ? (
        <span aria-hidden className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary" />
      ) : null}
      <WalletProviderIcon
        providerIconKey={wallet.provider_icon_key}
        className="h-10 w-10 shrink-0 rounded-xl border border-border bg-secondary"
        iconClassName="h-5 w-5"
        showTooltipLabel={false}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{wallet.name}</span>
        <span
          className={cn(
            'block truncate text-caption',
            caption ? 'text-status-pending' : 'text-muted-foreground',
          )}
        >
          {caption ?? subtitle(wallet)}
        </span>
      </span>
      <Money value={Number(wallet.amount) || 0} tone="neutral" />
    </button>
  </li>
);

/** Left rail of the web Billeteras page: totals, grouped wallets, create row. */
export const WalletsMasterList = ({
  funding,
  credit,
  totals,
  attention,
  selectedId,
  onSelect,
  onCreate,
}: WalletsMasterListProps) => {
  const listRef = useRef<HTMLDivElement>(null);
  const ordered = [...funding, ...credit];
  const attentionById = new Map(attention.map((item) => [item.wallet.id, item]));

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const next = stepWalletSelection(ordered, selectedId, event.key === 'ArrowDown' ? 1 : -1);
    if (next == null) return;
    onSelect(next);
    listRef.current
      ?.querySelector<HTMLButtonElement>(`[data-wallet-row="${next}"]`)
      ?.focus();
  };

  const section = (title: string, wallets: WalletListItem[]) =>
    wallets.length === 0 ? null : (
      <section aria-label={title} className="space-y-1">
        <div className="flex items-baseline justify-between px-3 pt-3">
          <h2 className="eyebrow text-muted-foreground">{title}</h2>
          <span className="text-caption text-muted-foreground">{wallets.length}</span>
        </div>
        <ul className="space-y-0.5">
          {wallets.map((wallet) => {
            const item = attentionById.get(wallet.id);
            return (
              <WalletRow
                key={wallet.id}
                wallet={wallet}
                selected={wallet.id === selectedId}
                caption={item ? attentionCaption(item) : null}
                onSelect={onSelect}
              />
            );
          })}
        </ul>
      </section>
    );

  return (
    <aside
      aria-label="Lista de billeteras"
      className="flex max-h-[calc(100dvh-9rem)] min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-panel"
    >
      <dl className="grid grid-cols-2 gap-3 border-b border-border p-4">
        <div className="min-w-0">
          <dt className="text-caption text-muted-foreground">Liquidez total</dt>
          <dd className="truncate text-lg font-semibold tabular-nums text-foreground">
            {formatCurrency(totals.liquidity)}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-caption text-muted-foreground">Deuda en tarjetas</dt>
          <dd className="truncate text-lg font-semibold tabular-nums text-foreground">
            {formatCurrency(totals.cardDebt)}
          </dd>
        </div>
      </dl>
      <div
        ref={listRef}
        onKeyDown={onKeyDown}
        className="min-h-0 flex-1 overflow-y-auto p-2"
      >
        {section('Efectivo y débito', funding)}
        {section('Tarjetas de crédito', credit)}
        <button
          type="button"
          onClick={onCreate}
          className="mt-3 flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-dashed border-border">
            <Plus className="h-4 w-4" aria-hidden />
          </span>
          Agregar billetera
        </button>
      </div>
    </aside>
  );
};
