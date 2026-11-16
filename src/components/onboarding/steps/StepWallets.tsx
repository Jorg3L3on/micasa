'use client';

import { useEffect, useState } from 'react';
import { Banknote, ChevronDown, CreditCard, Landmark, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { OverlayHint } from '@/components/overlay/overlay-form';
import {
  MONTHLY_ICON_PILL_CLASS,
  PANEL_INSET_CLASS,
} from '@/components/monthly/monthly-panel-shell';
import {
  WALLET_TYPE_LABEL,
  createWalletDraft,
  useOnboarding,
  type WalletDraft,
  type WalletDraftType,
} from '@/components/onboarding/OnboardingContext';
import { OnboardingDeletableRow } from '@/components/onboarding/OnboardingDeletableRow';
import { OnboardingChip, OnboardingFieldCaption } from '@/components/onboarding/OnboardingChip';
import { BANK_CHIP_GROUPS, isMoreBankKey } from '@/components/onboarding/steps/onboarding-rows';
import { WalletProviderIcon } from '@/components/wallets/WalletProviderIcon';
import { cn } from '@/lib/utils';

const TYPE_ICONS = {
  CASH: Banknote,
  BANK: Landmark,
  CREDIT: CreditCard,
} as const;

/** "Otra cuenta o efectivo" offers the two funding types. */
const OTHER_ACCOUNT_OPTIONS: WalletDraftType[] = ['BANK', 'CASH'];

const NAME_PLACEHOLDER: Record<WalletDraftType, string> = {
  CASH: 'Ej. Efectivo',
  BANK: 'Ej. Nómina BBVA',
  CREDIT: 'Ej. Tarjeta Oro',
};

/** Inset field inside a wallet row: 44px tall, faint glass. */
const ROW_FIELD_CLASS =
  'h-11 rounded-[10px] border-border/60 bg-white/[0.05] font-semibold tabular-nums dark:border-white/10 dark:bg-white/[0.05]';

/** Dashed secondary action under the rows (canvas `.btn-s`). */
const ADD_BUTTON_CLASS =
  'min-h-11 flex-1 basis-48 rounded-xl border border-dashed border-border/70 bg-white/[0.04] font-medium text-foreground hover:bg-white/[0.08] dark:border-white/20';

/** A wallet type must keep at least one named wallet (CASH and BANK). */
const isRequiredType = (type: WalletDraftType) => type !== 'CREDIT';

const isStatementDay = (day: number | null) =>
  day != null && Number.isInteger(day) && day >= 1 && day <= 31;

/** What a draft still needs before it can be created, or null when complete. */
const walletMissingHint = (wallet: WalletDraft): string | null => {
  const missing: string[] = [];
  if (wallet.name.trim() === '') missing.push('un nombre');
  if (wallet.type === 'CREDIT') {
    if (!(wallet.creditLimit > 0)) missing.push('la línea de crédito');
    if (!isStatementDay(wallet.cutoffDay) || !isStatementDay(wallet.dueDay)) {
      missing.push('los días de corte y de pago');
    }
  }
  if (missing.length === 0) return null;
  const list =
    missing.length === 1
      ? missing[0]
      : `${missing.slice(0, -1).join(', ')} y ${missing[missing.length - 1]}`;
  return `Falta ${list}.`;
};

export const walletsAreValid = (wallets: WalletDraft[]): boolean =>
  wallets.length > 0 &&
  wallets.every((wallet) => walletMissingHint(wallet) === null) &&
  wallets.some((wallet) => wallet.type === 'CASH') &&
  wallets.some((wallet) => wallet.type === 'BANK');

function WalletPill({ wallet }: { wallet: WalletDraft }) {
  if (wallet.type !== 'CASH' && wallet.providerIconKey) {
    return (
      <WalletProviderIcon
        providerIconKey={wallet.providerIconKey}
        className="size-9 rounded-xl"
        showTooltipLabel={false}
      />
    );
  }
  const Icon = TYPE_ICONS[wallet.type];
  return (
    <span className={cn(MONTHLY_ICON_PILL_CLASS, 'size-9')} aria-hidden>
      <Icon className="size-[18px]" />
    </span>
  );
}

function BankChips({
  wallet,
  onPick,
}: {
  wallet: WalletDraft;
  onPick: (providerIconKey: string | null) => void;
}) {
  const [showMore, setShowMore] = useState(() => isMoreBankKey(wallet.providerIconKey));
  const groupId = `wallet-bank-${wallet.id}`;
  const banks = showMore
    ? [...BANK_CHIP_GROUPS.common, ...BANK_CHIP_GROUPS.more]
    : BANK_CHIP_GROUPS.common;
  const isOther =
    wallet.providerIconKey == null || wallet.providerIconKey === 'GENERIC_BANK';

  return (
    <div className="flex flex-col gap-2">
      <OnboardingFieldCaption id={groupId}>Banco</OnboardingFieldCaption>
      <div role="group" aria-labelledby={groupId} className="flex flex-wrap gap-2">
        {banks.map((bank) => (
          <OnboardingChip
            key={bank.key}
            selected={wallet.providerIconKey === bank.key}
            onClick={() => onPick(bank.key)}
          >
            <WalletProviderIcon
              providerIconKey={bank.key}
              className="size-5 border-0"
              showTooltipLabel={false}
            />
            {bank.label}
          </OnboardingChip>
        ))}
        <OnboardingChip selected={isOther} onClick={() => onPick(null)}>
          Otro
        </OnboardingChip>
        {!showMore ? (
          <OnboardingChip
            aria-pressed={undefined}
            aria-expanded={false}
            onClick={() => setShowMore(true)}
            className="text-muted-foreground"
          >
            Más bancos
            <ChevronDown className="size-4" aria-hidden />
          </OnboardingChip>
        ) : null}
      </div>
    </div>
  );
}

function CreditFields({
  wallet,
  onChange,
}: {
  wallet: WalletDraft;
  onChange: (patch: Partial<WalletDraft>) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {(
        [
          ['cutoffDay', 'Día de corte'],
          ['dueDay', 'Día de pago'],
        ] as const
      ).map(([field, label]) => {
        const inputId = `wallet-${field}-${wallet.id}`;
        return (
          <div key={field} className="flex flex-col gap-1.5">
            <OnboardingFieldCaption htmlFor={inputId}>{label}</OnboardingFieldCaption>
            <Input
              id={inputId}
              type="number"
              inputMode="numeric"
              min={1}
              max={31}
              step={1}
              placeholder="1–31"
              value={wallet[field] ?? ''}
              onChange={(event) => {
                const raw = event.target.value;
                const day = raw === '' ? null : Math.trunc(Number(raw));
                onChange({
                  [field]: day != null && day >= 1 && day <= 31 ? day : null,
                });
              }}
              className={ROW_FIELD_CLASS}
            />
          </div>
        );
      })}
    </div>
  );
}

function WalletRow({
  wallet,
  canDelete,
  onChange,
  onDelete,
}: {
  wallet: WalletDraft;
  canDelete: boolean;
  onChange: (patch: Partial<WalletDraft>) => void;
  onDelete: () => void;
}) {
  const nameMissing = wallet.name.trim() === '';
  const missingHint = walletMissingHint(wallet);
  const isCredit = wallet.type === 'CREDIT';
  const amountId = `wallet-${isCredit ? 'limit' : 'balance'}-${wallet.id}`;

  return (
    <li className="flex flex-col gap-1.5">
      <OnboardingDeletableRow
        name={wallet.name}
        canDelete={canDelete}
        itemNoun="billetera"
        onDelete={onDelete}
      >
        {(deleteButton) => (
          <div className={cn(PANEL_INSET_CLASS, 'flex flex-col gap-3 px-3.5 py-2.5')}>
            <div className="flex flex-wrap items-center gap-3">
              <WalletPill wallet={wallet} />
              <div className="min-w-0 flex-1 basis-40">
                <input
                  type="text"
                  value={wallet.name}
                  onChange={(event) => onChange({ name: event.target.value })}
                  placeholder={NAME_PLACEHOLDER[wallet.type]}
                  autoComplete="off"
                  aria-label="Nombre de la billetera"
                  aria-invalid={nameMissing || undefined}
                  className="h-11 w-full min-w-0 border-0 bg-transparent p-0 text-[15px] font-semibold text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground"
                />
                <p className="-mt-1.5 truncate text-xs text-muted-foreground">
                  {WALLET_TYPE_LABEL[wallet.type]}
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                <label htmlFor={amountId} className="text-xs text-muted-foreground">
                  {isCredit ? 'Línea de crédito' : 'Saldo hoy'}
                </label>
                <div className="flex w-[8.5rem]">
                  <CurrencyInput
                    id={amountId}
                    grouped
                    value={(isCredit ? wallet.creditLimit : wallet.initialBalance) || ''}
                    onChange={(value) => {
                      const amount = Number.isFinite(value) && value > 0 ? value : 0;
                      onChange(isCredit ? { creditLimit: amount } : { initialBalance: amount });
                    }}
                    placeholder="0.00"
                    aria-label={isCredit ? 'Línea de crédito' : 'Saldo hoy'}
                    className={cn(ROW_FIELD_CLASS, 'text-right text-[15px]')}
                  />
                </div>
              </div>
              {deleteButton}
            </div>

            {wallet.type !== 'CASH' ? (
              <BankChips
                wallet={wallet}
                onPick={(providerIconKey) => onChange({ providerIconKey })}
              />
            ) : null}

            {isCredit ? <CreditFields wallet={wallet} onChange={onChange} /> : null}
          </div>
        )}
      </OnboardingDeletableRow>
      {missingHint ? <OverlayHint role="status">{missingHint}</OverlayHint> : null}
    </li>
  );
}

export default function StepWallets() {
  const {
    setCanProceed,
    wallets,
    setWallets,
    setIncomeTemplates,
    setExpenseTemplates,
  } = useOnboarding();

  useEffect(() => {
    setCanProceed(walletsAreValid(wallets));
  }, [wallets, setCanProceed]);

  const updateWallet = (id: string, patch: Partial<WalletDraft>) => {
    setWallets((prev) =>
      prev.map((wallet) => (wallet.id === id ? { ...wallet, ...patch } : wallet)),
    );
  };

  const canDelete = (wallet: WalletDraft) =>
    !isRequiredType(wallet.type) ||
    wallets.filter((other) => other.type === wallet.type).length > 1;

  const handleAdd = (type: WalletDraftType) => {
    setWallets((prev) => [...prev, createWalletDraft(type)]);
  };

  const handleRemove = (id: string) => {
    const remaining = wallets.filter((wallet) => wallet.id !== id);
    const fallback =
      remaining.find((wallet) => wallet.type === 'BANK')?.id ?? remaining[0]?.id ?? '';
    setWallets(remaining);
    // Drafts that pointed at the removed wallet move to the default one.
    setIncomeTemplates((prev) =>
      prev.map((income) =>
        income.walletId === id ? { ...income, walletId: fallback } : income,
      ),
    );
    setExpenseTemplates((prev) =>
      prev.map((expense) =>
        expense.walletId === id ? { ...expense, walletId: fallback } : expense,
      ),
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-3" role="list">
        {wallets.map((wallet) => (
          <WalletRow
            key={wallet.id}
            wallet={wallet}
            canDelete={canDelete(wallet)}
            onChange={(patch) => updateWallet(wallet.id, patch)}
            onDelete={() => handleRemove(wallet.id)}
          />
        ))}
      </ul>

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={() => handleAdd('CREDIT')}
          className={ADD_BUTTON_CLASS}
        >
          <Plus className="size-4" aria-hidden />
          Tarjeta de crédito
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" className={ADD_BUTTON_CLASS}>
              <Plus className="size-4" aria-hidden />
              Otra cuenta o efectivo
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-56">
            {OTHER_ACCOUNT_OPTIONS.map((type) => {
              const Icon = TYPE_ICONS[type];
              return (
                <DropdownMenuItem
                  key={type}
                  onSelect={() => handleAdd(type)}
                  className="min-h-11 md:min-h-9"
                >
                  <Icon className="size-4 text-muted-foreground" aria-hidden />
                  {WALLET_TYPE_LABEL[type]}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <OverlayHint>
        Las tarjetas de crédito piden línea, día de corte y día de pago. Si no los
        tienes a la mano, agrégalas después desde Billeteras.
      </OverlayHint>
    </div>
  );
}
