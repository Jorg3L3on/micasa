'use client';

import { useCallback, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeftRight, Banknote, Diff, ExternalLink, ShoppingCart, SlidersHorizontal } from 'lucide-react';
import {
  isCreditOrStoreCardWalletType,
  PAYMENT_METHOD_LABELS,
  type PaymentMethodType,
} from '@/domain/payment-method';
import { Button } from '@/components/ui/button';
import { WalletFlowFace } from '@/components/wallets/WalletFlowFace';
import { WalletMovementsTable } from '@/components/wallets/WalletMovementsTable';
import { walletDetailHref, walletMovementsHref } from '@/components/wallets/WalletFlowSection';
import type { WalletFlowActions } from '@/components/wallets/WalletFlowDetails';
import type { WalletAttentionItem } from '@/lib/ui/wallet-cover-flow';
import {
  parseWalletSelection,
  resolveSelectedWalletId,
  WALLET_SELECTION_PARAM,
  walletsForTab,
} from '@/lib/ui/wallet-master-detail';
import { cn } from '@/lib/utils';
import type { WalletListItem } from '@/types/catalog';

type WalletsGalleryProps = WalletFlowActions & {
  funding: WalletListItem[];
  credit: WalletListItem[];
  attention: WalletAttentionItem[];
  ownerQueryString: string;
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

/**
 * Web (`md`+) Billeteras: a tabbed grid of wallet cards, then the history
 * table and quick actions of the selected card.
 */
export const WalletsGallery = ({
  funding,
  credit,
  attention,
  ownerQueryString,
  onCreate,
  onMovement,
  onTransfer,
  onPurchase,
  onPay,
  payPendingId,
  onAdjustBalance,
}: WalletsGalleryProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const visible = useMemo(() => walletsForTab('all', { funding, credit }), [funding, credit]);
  const requested = parseWalletSelection(searchParams.get(WALLET_SELECTION_PARAM));
  const selectedId = resolveSelectedWalletId(visible, requested);
  const selected = visible.find((w) => w.id === selectedId) ?? null;
  const attentionById = useMemo(
    () => new Map(attention.map((item) => [item.wallet.id, item])),
    [attention],
  );

  const select = useCallback(
    (id: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(WALLET_SELECTION_PARAM, String(id));
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const isCard = selected ? isCreditOrStoreCardWalletType(selected.type) : false;
  const actions = selected
    ? isCard
      ? [
          { key: 'pay', label: 'Pagar', icon: Banknote, primary: true, busy: payPendingId === selected.id, run: () => onPay(selected) },
          { key: 'purchase', label: 'Compra', icon: ShoppingCart, primary: false, busy: false, run: () => onPurchase(selected) },
          { key: 'adjust', label: 'Ajustar saldo', icon: SlidersHorizontal, primary: false, busy: false, run: () => onAdjustBalance(selected) },
        ]
      : [
          { key: 'movement', label: 'Movimiento', icon: Diff, primary: true, busy: false, run: () => onMovement(selected) },
          { key: 'transfer', label: 'Transferir', icon: ArrowLeftRight, primary: false, busy: false, run: () => onTransfer(selected) },
          { key: 'adjust', label: 'Ajustar saldo', icon: SlidersHorizontal, primary: false, busy: false, run: () => onAdjustBalance(selected) },
        ]
    : [];

  return (
    <div className="min-w-0 space-y-8">
      <section aria-label="Billeteras" className="space-y-5">
        <ul className="grid grid-cols-2 gap-5 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((wallet) => {
            const isSelected = wallet.id === selectedId;
            const item = attentionById.get(wallet.id);
            return (
              <li key={wallet.id} className="min-w-0">
                <button
                  type="button"
                  aria-pressed={isSelected}
                  aria-label={`Seleccionar ${wallet.name}`}
                  onClick={() => select(wallet.id)}
                  className={cn(
                    'block w-full rounded-3xl p-1 text-left transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                    isSelected ? 'ring-2 ring-primary' : 'ring-0',
                  )}
                >
                  <WalletFlowFace wallet={wallet} />
                </button>
                <div className="px-2 pt-2">
                  <p className="truncate text-sm font-medium text-foreground">{wallet.name}</p>
                  <p
                    className={cn(
                      'truncate text-caption',
                      item ? 'text-status-pending' : 'text-muted-foreground',
                    )}
                  >
                    {item
                      ? attentionCaption(item)
                      : (PAYMENT_METHOD_LABELS[wallet.type as PaymentMethodType] ?? wallet.type)}
                  </p>
                </div>
              </li>
            );
          })}
          <li className="min-w-0">
            <button
              type="button"
              onClick={onCreate}
              className="flex aspect-[1.586] w-full flex-col items-center justify-center gap-1 rounded-face border border-dashed border-border text-sm text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <span className="text-2xl leading-none" aria-hidden>
                +
              </span>
              Agregar billetera
            </button>
          </li>
        </ul>
      </section>

      {selected ? (
        <section
          aria-label={`Movimientos de ${selected.name}`}
          className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-panel"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-section text-foreground">Movimientos · {selected.name}</h2>
              <Link
                href={walletDetailHref(selected, ownerQueryString)}
                className="inline-flex items-center gap-1 text-caption text-muted-foreground transition-colors hover:text-foreground"
              >
                Abrir página completa
                <ExternalLink className="h-3 w-3" aria-hidden />
              </Link>
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label={`Acciones de ${selected.name}`}>
              {actions.map(({ key, label, icon: Icon, primary, busy, run }) => (
                <Button
                  key={key}
                  type="button"
                  variant={primary ? 'default' : 'outline'}
                  className="rounded-xl px-4"
                  disabled={busy}
                  aria-busy={busy || undefined}
                  onClick={run}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {label}
                </Button>
              ))}
            </div>
          </div>
          <WalletMovementsTable
            key={selected.id}
            wallet={selected}
            moreHref={walletMovementsHref(selected, ownerQueryString)}
          />
        </section>
      ) : null}
    </div>
  );
};
