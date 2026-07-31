'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTheme } from 'next-themes';
import { CreditCard } from 'lucide-react';
import { useFinanceContext } from '@/context/finance-context';
import { buildOwnerQuery, clientFetchFromApi } from '@/lib/api/client-fetch';
import type { WalletListItem } from '@/types/catalog';
import { WalletBalanceEditDialog } from '@/components/wallets/WalletBalanceEditDialog';
import { WalletProviderIcon } from '@/components/wallets/WalletProviderIcon';

const CARD_TYPES = ['CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'DEPARTMENT_STORE_CARD'];

export default function MyCardsPanel() {
  const { context } = useFinanceContext();
  const { resolvedTheme } = useTheme();
  const scheme: ProviderCardScheme =
    resolvedTheme === 'light' ? 'light' : 'dark';
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
        <p className="text-sm text-muted-foreground">No hay tarjetas registradas</p>
      </div>
    );
  }

  return (
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
              style={cardStyle}
            >
              <div className="mb-3 flex items-start gap-2">
                <WalletProviderIcon
                  providerIconKey={card.provider_icon_key}
                  iconClassName="h-4 w-4"
                  {card.name}
                </span>
              </div>
              <div className="space-y-2">
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
                      {formatCurrency(limit)}
                    </span>
                  )}
                </div>
                {limit > 0 && (
                  <div className="mt-1 space-y-1">
                      <div
                        style={{ width: `${usagePercent}%` }}
                      />
                    </div>
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
