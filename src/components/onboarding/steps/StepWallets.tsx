'use client';

import { useEffect } from 'react';
import { Banknote, CreditCard, Landmark, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AmountRow,
  GroupedRow,
  OVERLAY_ROW_INPUT_CLASS,
  OVERLAY_ROW_NUMBER_INPUT_CLASS,
  OVERLAY_ROW_TRIGGER_CLASS,
  OVERLAY_SECONDARY_BUTTON_CLASS,
  OverlayHint,
} from '@/components/overlay/overlay-form';
import {
  WALLET_TYPE_LABEL,
  createWalletDraft,
  useOnboarding,
  type WalletDraft,
  type WalletDraftType,
} from '@/components/onboarding/OnboardingContext';
import { OnboardingItemCard } from '@/components/onboarding/OnboardingItemCard';
import { WalletProviderIcon } from '@/components/wallets/WalletProviderIcon';
import { WALLET_PROVIDER_ICON_OPTIONS } from '@/lib/wallet-provider-icons';

const TYPE_ICONS = {
  CASH: Banknote,
  BANK: Landmark,
  CREDIT: CreditCard,
} as const;

const ADD_OPTIONS: WalletDraftType[] = ['CASH', 'BANK', 'CREDIT'];

const NAME_PLACEHOLDER: Record<WalletDraftType, string> = {
  CASH: 'Ej. Efectivo',
  BANK: 'Ej. Nómina BBVA',
  CREDIT: 'Ej. Tarjeta Oro',
};

const BANK_OPTIONS = WALLET_PROVIDER_ICON_OPTIONS.filter(
  (option) => option.key !== 'CASH_GENERIC',
);

const NO_BANK = '__none__';

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

function WalletLeading({ wallet }: { wallet: WalletDraft }) {
  if (wallet.providerIconKey) {
    return (
      <WalletProviderIcon
        providerIconKey={wallet.providerIconKey}
        className="size-8"
        showTooltipLabel={false}
      />
    );
  }
  const Icon = TYPE_ICONS[wallet.type];
  return (
    <span
      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
      aria-hidden
    >
      <Icon className="size-4" />
    </span>
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
        {wallets.map((wallet) => {
          const nameId = `wallet-name-${wallet.id}`;
          const bankId = `wallet-bank-${wallet.id}`;
          const nameMissing = wallet.name.trim() === '';
          const missingHint = walletMissingHint(wallet);

          return (
            <li key={wallet.id} className="flex flex-col gap-1.5">
              <OnboardingItemCard
                leading={<WalletLeading wallet={wallet} />}
                title={wallet.name}
                subtitle={WALLET_TYPE_LABEL[wallet.type]}
                canDelete={canDelete(wallet)}
                itemNoun="billetera"
                onDelete={() => handleRemove(wallet.id)}
              >
                <GroupedRow label="Nombre" htmlFor={nameId}>
                  <Input
                    id={nameId}
                    value={wallet.name}
                    onChange={(event) =>
                      updateWallet(wallet.id, { name: event.target.value })
                    }
                    placeholder={NAME_PLACEHOLDER[wallet.type]}
                    autoComplete="off"
                    aria-invalid={nameMissing || undefined}
                    className={OVERLAY_ROW_INPUT_CLASS}
                  />
                </GroupedRow>

                {wallet.type !== 'CASH' ? (
                  <GroupedRow label="Banco" htmlFor={bankId}>
                    <Select
                      value={wallet.providerIconKey ?? ''}
                      onValueChange={(value) =>
                        updateWallet(wallet.id, {
                          providerIconKey: value === NO_BANK ? null : value,
                        })
                      }
                    >
                      <SelectTrigger id={bankId} className={OVERLAY_ROW_TRIGGER_CLASS}>
                        <SelectValue placeholder="Elige tu banco (opcional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_BANK}>Otro o no aparece</SelectItem>
                        {BANK_OPTIONS.map((provider) => (
                          <SelectItem key={provider.key} value={provider.key}>
                            <span className="flex items-center gap-2">
                              <WalletProviderIcon
                                providerIconKey={provider.key}
                                className="size-5 rounded-md border-0"
                                showTooltipLabel={false}
                              />
                              {provider.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </GroupedRow>
                ) : null}

                {wallet.type === 'CREDIT' ? (
                  <>
                    <AmountRow
                      id={`wallet-limit-${wallet.id}`}
                      label="Línea de crédito"
                      value={wallet.creditLimit || ''}
                      onChange={(value) =>
                        updateWallet(wallet.id, {
                          creditLimit: Number.isFinite(value) && value > 0 ? value : 0,
                        })
                      }
                    />
                    {(
                      [
                        ['cutoffDay', 'Día corte', 'Día de corte'],
                        ['dueDay', 'Día pago', 'Día de pago'],
                      ] as const
                    ).map(([field, label, ariaLabel]) => {
                      const inputId = `wallet-${field}-${wallet.id}`;
                      return (
                        <GroupedRow key={field} label={label} htmlFor={inputId}>
                          <Input
                            id={inputId}
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={31}
                            step={1}
                            placeholder="1–31"
                            aria-label={ariaLabel}
                            value={wallet[field] ?? ''}
                            onChange={(event) => {
                              const raw = event.target.value;
                              const day = raw === '' ? null : Math.trunc(Number(raw));
                              updateWallet(wallet.id, {
                                [field]:
                                  day != null && day >= 1 && day <= 31 ? day : null,
                              });
                            }}
                            className={OVERLAY_ROW_NUMBER_INPUT_CLASS}
                          />
                        </GroupedRow>
                      );
                    })}
                  </>
                ) : (
                  <AmountRow
                    id={`wallet-balance-${wallet.id}`}
                    label="Saldo hoy (opcional)"
                    value={wallet.initialBalance || ''}
                    onChange={(value) =>
                      updateWallet(wallet.id, {
                        initialBalance: Number.isFinite(value) && value > 0 ? value : 0,
                      })
                    }
                  />
                )}
              </OnboardingItemCard>
              {missingHint ? (
                <OverlayHint role="status">{missingHint}</OverlayHint>
              ) : null}
            </li>
          );
        })}
      </ul>

      <OverlayHint>
        El saldo es opcional. Con él tu panel muestra tu liquidez real desde el
        primer día.
      </OverlayHint>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className={`${OVERLAY_SECONDARY_BUTTON_CLASS} text-primary-text`}
          >
            <Plus className="size-4" aria-hidden />
            Agregar billetera
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-56">
          {ADD_OPTIONS.map((type) => {
            const Icon = TYPE_ICONS[type];
            return (
              <DropdownMenuItem key={type} onSelect={() => handleAdd(type)}>
                <Icon className="size-4 text-muted-foreground" aria-hidden />
                {WALLET_TYPE_LABEL[type]}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
