'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTheme } from 'next-themes';
import { CreditCard } from 'lucide-react';
import { useFinanceContext } from '@/context/finance-context';
import { buildOwnerQuery, clientFetchFromApi } from '@/lib/api/client-fetch';
import {
  getProviderCardStyle,
  isProviderCardDarkSurface,
  type ProviderCardScheme,
} from '@/lib/provider-card-style';
import { cn, formatCurrency } from '@/lib/utils';
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
      <div className="card-surface animate-pulse p-5">
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
      <div className="card-surface flex h-full min-h-[200px] flex-col items-center justify-center gap-2 p-5">
        <CreditCard className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No hay tarjetas registradas</p>
      </div>
    );
  }

  return (
    <div className="card-surface p-5">
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
          const cardStyle = getProviderCardStyle(
            card.provider_icon_key,
            card.type,
            'calm',
            scheme,
          );
          const onDarkSurface = isProviderCardDarkSurface('calm', scheme);
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
              className={cn(
                'group relative block w-[70vw] max-w-[260px] snap-start shrink-0 overflow-hidden rounded-xl border p-3 text-left transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.01] sm:w-[220px] sm:max-w-none',
                onDarkSurface
                  ? 'text-white ring-1 ring-inset ring-white/10'
                  : 'text-foreground ring-1 ring-inset ring-black/5',
              )}
              style={cardStyle}
            >
              <span
                className={cn(
                  'pointer-events-none absolute -left-10 -top-10 h-24 w-24 rounded-full blur-2xl',
                  onDarkSurface ? 'bg-white/8' : 'bg-white/70',
                )}
              />
              <span
                className={cn(
                  'pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent to-transparent',
                  onDarkSurface ? 'via-white/25' : 'via-black/10',
                )}
              />
              <span
                className={cn(
                  'pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-linear-to-r from-transparent to-transparent opacity-0 transition-all duration-700 ease-out group-hover:left-full group-hover:opacity-100',
                  onDarkSurface ? 'via-white/14' : 'via-black/6',
                )}
              />
              <div className="mb-3 flex items-start gap-2">
                <WalletProviderIcon
                  providerIconKey={card.provider_icon_key}
                  className={cn(
                    'h-7 w-7 shrink-0 rounded-lg border shadow-sm ring-1',
                    onDarkSurface
                      ? 'border-white/25 bg-white/15 ring-white/10'
                      : 'border-border/70 bg-card ring-border/50',
                  )}
                  iconClassName="h-4 w-4"
                  showTooltipLabel
                />
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate pr-1 text-sm font-semibold leading-tight sm:text-xs',
                    onDarkSurface ? 'opacity-90' : 'text-foreground',
                  )}
                >
                  {card.name}
                </span>
              </div>
              <div className="space-y-2">
                <div
                  className={cn(
                    'grid grid-cols-2 gap-2 text-xs sm:text-[11px]',
                    onDarkSurface ? 'opacity-75' : 'text-muted-foreground',
                  )}
                >
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
                    <span
                      className={cn(
                        'min-w-0 truncate text-right text-base font-bold font-mono tabular-nums sm:text-[15px]',
                        onDarkSurface ? 'opacity-90' : 'text-foreground',
                      )}
                    >
                      {formatCurrency(limit)}
                    </span>
                  )}
                </div>
                {limit > 0 && (
                  <div className="mt-1 space-y-1">
                    <div
                      className={cn(
                        'h-1.5 w-full rounded-full',
                        onDarkSurface ? 'bg-white/20' : 'bg-muted/60',
                      )}
                    >
                      <div
                        className={cn(
                          'h-1.5 rounded-full transition-all',
                          onDarkSurface
                            ? 'bg-white/80'
                            : 'bg-linear-to-r from-emerald-500 to-emerald-400',
                        )}
                        style={{ width: `${usagePercent}%` }}
                      />
                    </div>
                    <p
                      className={cn(
                        'text-center text-xs sm:text-[11px]',
                        onDarkSurface ? 'opacity-70' : 'text-muted-foreground',
                      )}
                    >
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
