'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CreditCard } from 'lucide-react';
import { useFinanceContext } from '@/context/finance-context';
import { buildOwnerQuery, clientFetchFromApi } from '@/lib/api/client-fetch';
import { getProviderCardStyle } from '@/lib/provider-card-style';
import { formatCurrency } from '@/lib/utils';
import type { WalletListItem } from '@/types/catalog';
import { WalletBalanceEditDialog } from '@/components/wallets/WalletBalanceEditDialog';
import { WalletProviderIcon } from '@/components/wallets/WalletProviderIcon';

const CARD_TYPES = ['CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'DEPARTMENT_STORE_CARD'];

export default function MyCardsPanel() {
  const { context } = useFinanceContext();
  const [cards, setCards] = useState<WalletListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState<WalletListItem | null>(null);

  const ownerQueryString = useMemo(() => {
    const q = buildOwnerQuery(context);
    const s = q.toString();
    return s ? `?${s}` : '';
  }, [context]);

  const load = useCallback(async () => {
    if (!context || (context.type === 'user' && context.id === 0)) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const wallets = await clientFetchFromApi<WalletListItem[]>(
        '/api/wallets',
        undefined,
        context,
      );
      const sortedCards = wallets
        .filter((wallet) => CARD_TYPES.includes(wallet.type) && wallet.active)
        .sort((a, b) => {
          const getTypeRank = (type: string) => {
            if (type === 'CASH') return 0;
            if (type === 'DEBIT_CARD') return 1;
            if (type === 'CREDIT_CARD' || type === 'DEPARTMENT_STORE_CARD') return 2;
            return 3;
          };

          const rankDiff = getTypeRank(a.type) - getTypeRank(b.type);
          if (rankDiff !== 0) return rankDiff;

          const bothCreditTypes =
            (a.type === 'CREDIT_CARD' || a.type === 'DEPARTMENT_STORE_CARD') &&
            (b.type === 'CREDIT_CARD' || b.type === 'DEPARTMENT_STORE_CARD');

          if (bothCreditTypes) {
            const getUsedPct = (wallet: WalletListItem) => {
              const limit = Number(wallet.credit_limit ?? 0);
              if (limit <= 0) return Number.POSITIVE_INFINITY;
              return Math.max(0, Number(wallet.amount)) / limit;
            };

            const usedPctDiff = getUsedPct(a) - getUsedPct(b);
            if (usedPctDiff !== 0) return usedPctDiff;
          }

          return a.name.localeCompare(b.name);
        });

      setCards(sortedCards);
    } catch {
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, [context]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleOpenCardModal = useCallback((card: WalletListItem) => {
    setSelectedCard(card);
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm animate-pulse">
        <div className="mb-4 h-5 w-24 rounded bg-muted/40" />
        <div className="flex gap-3">
          <div className="h-32 min-w-[70vw] shrink-0 rounded-xl bg-muted/30 sm:min-w-[220px]" />
          <div className="h-32 min-w-[70vw] shrink-0 rounded-xl bg-muted/20 sm:min-w-[220px]" />
        </div>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 rounded-xl border border-border/60 bg-card p-5 shadow-sm">
        <CreditCard className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No hay tarjetas registradas</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-foreground">Mis tarjetas</h3>
        <span className="text-xs text-muted-foreground">{cards.length} tarjeta{cards.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="relative">
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-4 bg-linear-to-r from-card to-transparent sm:w-8"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-4 bg-linear-to-l from-card to-transparent sm:w-8"
          aria-hidden
        />
        <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1 scrollbar-hide [-webkit-overflow-scrolling:touch]">
        {cards.map((card) => {
          const cardStyle = getProviderCardStyle(card.provider_icon_key, card.type, 'wow');
          const limit = card.credit_limit ?? 0;
          const usagePercent =
            limit > 0
              ? Math.min((Math.max(0, Number(card.amount)) / limit) * 100, 100)
              : 0;

          return (
            <button
              key={card.id}
              type="button"
              onClick={() => handleOpenCardModal(card)}
              aria-label={`Abrir detalles de ${card.name}`}
              className="group relative block w-[70vw] max-w-[260px] snap-start shrink-0 overflow-hidden rounded-xl border p-3 text-left text-white ring-1 ring-inset ring-white/5 transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.01] sm:w-[220px] sm:max-w-none"
              style={cardStyle}
            >
              <span className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/18 blur-2xl" />
              <span className="pointer-events-none absolute -left-10 -bottom-12 h-28 w-28 rounded-full bg-black/30 blur-2xl" />
              <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,transparent_25%,rgba(255,255,255,0.14)_48%,transparent_72%)] opacity-45 transition-opacity duration-300 group-hover:opacity-70" />
              <div className="mb-3 flex items-start gap-2">
                <WalletProviderIcon
                  providerIconKey={card.provider_icon_key}
                  className="h-7 w-7 shrink-0 rounded-lg border border-white/35 bg-white/20 shadow-sm ring-1 ring-white/10"
                  iconClassName="h-4 w-4"
                  showTooltipLabel
                />
                <span className="min-w-0 flex-1 truncate pr-1 text-sm font-semibold leading-tight opacity-90 sm:text-xs">
                  {card.name}
                </span>
              </div>
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs opacity-75 sm:text-[11px]">
                  <span className="truncate">Saldo actual</span>
                  {limit > 0 ? (
                    <span className="truncate text-right">Límite</span>
                  ) : (
                    <span />
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <span className="min-w-0 truncate text-base font-bold font-mono tabular-nums sm:text-[15px]">
                    {formatCurrency(card.amount)}
                  </span>
                  {limit > 0 && (
                    <span className="min-w-0 truncate text-right text-base font-bold font-mono tabular-nums opacity-90 sm:text-[15px]">
                      {formatCurrency(limit)}
                    </span>
                  )}
                </div>
                {limit > 0 && (
                  <div className="mt-1 space-y-1">
                    <div className="h-1.5 w-full rounded-full bg-white/20">
                      <div
                        className="h-1.5 rounded-full bg-white/80 transition-all"
                        style={{ width: `${usagePercent}%` }}
                      />
                    </div>
                    <p className="text-center text-xs opacity-70 sm:text-[11px]">
                      {usagePercent.toFixed(0)}% utilizado
                    </p>
                  </div>
                )}
              </div>
            </button>
          );
        })}
        </div>
      </div>

      <WalletBalanceEditDialog
        wallet={selectedCard}
        ownerQueryString={ownerQueryString}
        onOpenChange={(open) => {
          if (!open) setSelectedCard(null);
        }}
        onSaved={(walletId, newAmount) => {
          setSelectedCard((prev) =>
            prev && prev.id === walletId ? { ...prev, amount: newAmount } : prev,
          );
          void load();
        }}
      />
    </div>
  );
}
