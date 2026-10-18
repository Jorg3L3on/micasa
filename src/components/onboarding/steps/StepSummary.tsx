'use client';

import { useEffect } from 'react';
import { Banknote, CalendarDays, CreditCard, Landmark, Receipt, TrendingUp } from 'lucide-react';
import { Money } from '@/components/money';
import {
  OVERLAY_GROUPED_CARD_CLASS,
  OverlayHint,
  OverlayListRow,
  OverlaySectionLabel,
} from '@/components/overlay/overlay-form';
import {
  WALLET_TYPE_LABEL,
  useOnboarding,
  type WalletDraft,
} from '@/components/onboarding/OnboardingContext';
import {
  frequencyFromFlags,
  frequencyShortLabel,
} from '@/components/onboarding/fortnight-frequency';
import { WalletProviderIcon } from '@/components/wallets/WalletProviderIcon';
import { formatDisplayDayMonth } from '@/lib/calendar-dates';
import { formatFortnightOrdinalTitle } from '@/lib/fortnight-calendar';
import { generateOnboardingFortnights } from '@/lib/finance/onboarding-fortnights';

const TYPE_ICONS = {
  CASH: Banknote,
  BANK: Landmark,
  CREDIT: CreditCard,
} as const;

const walletIcon = (wallet: WalletDraft) => {
  if (wallet.providerIconKey) {
    return (
      <WalletProviderIcon
        providerIconKey={wallet.providerIconKey}
        className="size-8 border-0"
        showTooltipLabel={false}
      />
    );
  }
  const Icon = TYPE_ICONS[wallet.type];
  return <Icon />;
};

export default function StepSummary() {
  const {
    setCanProceed,
    wallets,
    incomeTemplates,
    expenseTemplates,
    startDate,
  } = useOnboarding();

  useEffect(() => {
    setCanProceed(true);
  }, [setCanProceed]);

  const walletName = (id: string) =>
    wallets.find((wallet) => wallet.id === id)?.name ?? 'Billetera';
  const fortnights = generateOnboardingFortnights(startDate);

  return (
    <div className="flex flex-col gap-3">
      <OverlaySectionLabel>Billeteras</OverlaySectionLabel>
      <div className={OVERLAY_GROUPED_CARD_CLASS}>
        {wallets.map((wallet) => (
          <OverlayListRow
            key={wallet.id}
            icon={walletIcon(wallet)}
            title={wallet.name}
            subtitle={
              wallet.type === 'CREDIT'
                ? `Corte día ${wallet.cutoffDay ?? '–'} · pago día ${wallet.dueDay ?? '–'}`
                : WALLET_TYPE_LABEL[wallet.type]
            }
            trailing={
              <Money
                value={wallet.type === 'CREDIT' ? wallet.creditLimit : wallet.initialBalance}
                tone="neutral"
              />
            }
          />
        ))}
      </div>

      <OverlaySectionLabel>Ingresos</OverlaySectionLabel>
      <div className={OVERLAY_GROUPED_CARD_CLASS}>
        {incomeTemplates.map((income) => (
          <OverlayListRow
            key={income.id}
            icon={<TrendingUp />}
            title={income.name}
            subtitle={`${frequencyShortLabel(frequencyFromFlags(income))} · ${walletName(income.walletId)}`}
            trailing={<Money value={income.amount} tone="positive" />}
          />
        ))}
      </div>

      <OverlaySectionLabel>Gastos fijos</OverlaySectionLabel>
      {expenseTemplates.length > 0 ? (
        <div className={OVERLAY_GROUPED_CARD_CLASS}>
          {expenseTemplates.map((expense) => (
            <OverlayListRow
              key={expense.id}
              icon={<Receipt />}
              title={expense.name}
              subtitle={`${frequencyShortLabel(frequencyFromFlags(expense))} · ${walletName(expense.walletId)}`}
              trailing={<Money value={expense.amount} tone="neutral" />}
            />
          ))}
        </div>
      ) : (
        <OverlayHint>
          Sin gastos por ahora. Los agregas desde tu panel cuando quieras.
        </OverlayHint>
      )}

      <OverlaySectionLabel>Tus primeras quincenas</OverlaySectionLabel>
      <div className={OVERLAY_GROUPED_CARD_CLASS}>
        {fortnights.map((fortnight) => (
          <OverlayListRow
            key={`${fortnight.year}-${fortnight.month}-${fortnight.period}`}
            icon={<CalendarDays />}
            title={formatFortnightOrdinalTitle(
              fortnight.period,
              fortnight.month,
              fortnight.year,
            )}
            subtitle={`${formatDisplayDayMonth(fortnight.startDate)} – ${formatDisplayDayMonth(fortnight.endDate)}`}
          />
        ))}
      </div>
      <OverlayHint>
        La 1ª quincena va del último día del mes anterior al 14, y la 2ª del 15
        al penúltimo día del mes. Así cada quincena empieza el día que cobras.
      </OverlayHint>
    </div>
  );
}
