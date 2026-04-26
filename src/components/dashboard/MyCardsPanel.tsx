'use client';

import { useCallback, useEffect, useState } from 'react';
import { CreditCard } from 'lucide-react';
import { useFinanceContext } from '@/context/finance-context';
import { clientFetchFromApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import type { WalletListItem } from '@/types/catalog';
import { WalletProviderIcon } from '@/components/wallets/WalletProviderIcon';

const CARD_TYPES = ['CREDIT_CARD', 'DEPARTMENT_STORE_CARD'];

const CARD_GRADIENTS = [
  'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
  'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
  'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
  'linear-gradient(135deg, #10b981 0%, #0ea5e9 100%)',
];

export default function MyCardsPanel() {
  const { context } = useFinanceContext();
  const [cards, setCards] = useState<WalletListItem[]>([]);
  const [loading, setLoading] = useState(true);

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
      setCards(wallets.filter((w) => CARD_TYPES.includes(w.type) && w.active !== false));
    } catch {
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, [context]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm animate-pulse h-[320px]">
        <div className="h-5 w-24 bg-muted/40 rounded mb-4" />
        <div className="space-y-3">
          <div className="h-28 bg-muted/30 rounded-xl" />
          <div className="h-28 bg-muted/20 rounded-xl" />
        </div>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm flex flex-col items-center justify-center gap-2 h-full min-h-[200px]">
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
      <div className="space-y-3 overflow-y-auto max-h-[480px] scrollbar-hide">
        {cards.map((card, idx) => {
          const gradient = CARD_GRADIENTS[idx % CARD_GRADIENTS.length];
          const limit = card.credit_limit ?? 0;
          const spent = card.spent_amount ?? 0;
          const usagePercent = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;

          return (
            <div
              key={card.id}
              className="rounded-xl p-4 text-white"
              style={{ background: gradient }}
            >
              <div className="mb-6 flex items-start gap-2.5">
                <WalletProviderIcon
                  providerIconKey={card.provider_icon_key}
                  className="h-9 w-9 shrink-0 rounded-lg border border-white/35 bg-white/20 shadow-sm ring-1 ring-white/10"
                  iconClassName="h-5 w-5"
                  showTooltipLabel
                />
                <span className="min-w-0 flex-1 text-sm font-semibold leading-tight opacity-90">
                  {card.name}
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs opacity-75">
                  <span>Saldo actual</span>
                  {limit > 0 && <span>Límite</span>}
                </div>
                <div className="flex justify-between">
                  <span className="text-base font-bold">{formatCurrency(spent)}</span>
                  {limit > 0 && (
                    <span className="text-sm font-medium opacity-90">{formatCurrency(limit)}</span>
                  )}
                </div>
                {limit > 0 && (
                  <div className="mt-1">
                    <div className="h-1.5 w-full rounded-full bg-white/20">
                      <div
                        className="h-1.5 rounded-full bg-white/80 transition-all"
                        style={{ width: `${usagePercent}%` }}
                      />
                    </div>
                    <p className="text-xs opacity-60 mt-1">
                      {usagePercent.toFixed(0)}% utilizado
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
