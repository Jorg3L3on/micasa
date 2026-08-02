'use client';

import { useEffect, useState } from 'react';
import { Banknote, CreditCard, Landmark, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  useOnboarding,
  type WalletDraft,
} from '@/components/onboarding/OnboardingContext';
import { SwipeableOnboardingCard } from '@/components/onboarding/SwipeableOnboardingCard';
import { cn } from '@/lib/utils';
import {
  WALLET_PROVIDER_ICON_OPTIONS,
  getWalletProviderOption,
} from '@/lib/wallet-provider-icons';
import { WalletProviderIcon } from '@/components/wallets/WalletProviderIcon';
import { useIsMobile } from '@/hooks/use-mobile';
import { createClientId } from '@/lib/polyfills';

const WALLET_TYPE_OPTIONS: { value: WalletDraft['type']; label: string }[] = [
  { value: 'CASH', label: 'Efectivo' },
  { value: 'BANK', label: 'Tarjeta de débito' },
  { value: 'CREDIT', label: 'Tarjeta de crédito' },
];

const TYPE_ICONS = {
  CASH: Banknote,
  BANK: Landmark,
  CREDIT: CreditCard,
} as const;

const WALLET_PRESETS: {
  type: WalletDraft['type'];
  label: string;
  ariaLabel: string;
}[] = [
  { type: 'CASH', label: '+ Efectivo', ariaLabel: 'Agregar billetera de efectivo' },
  { type: 'BANK', label: '+ Débito', ariaLabel: 'Agregar tarjeta de débito' },
  { type: 'CREDIT', label: '+ Crédito', ariaLabel: 'Agregar tarjeta de crédito' },
];

/** Delete only when the user has more than the two required billeteras. */
const MIN_WALLETS_WITHOUT_DELETE = 2;

const normalizeProviderForType = (
  type: WalletDraft['type'],
  currentProviderIconKey: string | null,
): string | null => {
  if (type === 'CASH') return 'CASH_GENERIC';
  if (currentProviderIconKey === 'CASH_GENERIC') return null;
  return currentProviderIconKey;
};

const createWallet = (type: WalletDraft['type']): WalletDraft => ({
  id: createClientId(),
  name: '',
  type,
  providerIconKey: type === 'CASH' ? 'CASH_GENERIC' : null,
});

const WALLET_NAME_PLACEHOLDER_BY_TYPE: Record<WalletDraft['type'], string> = {
  CASH: 'Ej. Efectivo',
  BANK: 'Ej. BBVA o cuenta de débito',
  CREDIT: 'Ej. Tarjeta de crédito',
};

type WalletCardBodyProps = {
  wallet: WalletDraft;
  canDelete: boolean;
  onNameChange: (name: string) => void;
  onTypeChange: (type: WalletDraft['type']) => void;
  onProviderChange: (providerIconKey: string | null) => void;
  onDelete: () => void;
};

function WalletCardBody({
  wallet,
  canDelete,
  onNameChange,
  onTypeChange,
  onProviderChange,
  onDelete,
}: WalletCardBodyProps) {
  const namePlaceholder = WALLET_NAME_PLACEHOLDER_BY_TYPE[wallet.type];
  const nameLabel =
    wallet.name.trim() !== ''
      ? `Nombre de billetera: ${wallet.name}`
      : `Nombre de billetera (${namePlaceholder})`;
  const providerOptions =
    wallet.type === 'CASH'
      ? WALLET_PROVIDER_ICON_OPTIONS.filter(
          (option) => option.key === 'CASH_GENERIC',
        )
      : WALLET_PROVIDER_ICON_OPTIONS.filter(
          (option) => option.key !== 'CASH_GENERIC',
        );
  const selectedProvider = getWalletProviderOption(wallet.providerIconKey);

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-lg border border-border/60 bg-card p-4 transition-colors',
        'hover:bg-muted/30',
      )}
    >
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label htmlFor={`wallet-name-${wallet.id}`}>Nombre</Label>
          <Input
            id={`wallet-name-${wallet.id}`}
            type="text"
            value={wallet.name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder={namePlaceholder}
            className="w-full"
            aria-label={nameLabel}
          />
        </div>
        {canDelete ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onDelete}
                aria-label={`Eliminar billetera ${wallet.name || 'sin nombre'}`}
                className="mb-0 hidden size-9 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive md:inline-flex"
              >
                <Trash2 className="size-4" data-icon="inline-start" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={4}>
              Eliminar billetera
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`wallet-type-${wallet.id}`}>Tipo</Label>
          <Select
            value={wallet.type}
            onValueChange={(value) =>
              onTypeChange(value as WalletDraft['type'])
            }
          >
            <SelectTrigger
              id={`wallet-type-${wallet.id}`}
              className="w-full"
              size="default"
              aria-label="Tipo de billetera"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WALLET_TYPE_OPTIONS.map((opt) => {
                const OptionIcon = TYPE_ICONS[opt.value];
                return (
                  <SelectItem key={opt.value} value={opt.value}>
                    <span className="flex items-center gap-2">
                      <OptionIcon
                        className="size-4 shrink-0 text-muted-foreground"
                        strokeWidth={2}
                        aria-hidden
                        data-icon="inline-start"
                      />
                      {opt.label}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`wallet-provider-${wallet.id}`}>
            Empresa o banco
          </Label>
          <Select
            value={wallet.providerIconKey ?? '__none__'}
            onValueChange={(value) =>
              onProviderChange(value === '__none__' ? null : value)
            }
          >
            <SelectTrigger
              id={`wallet-provider-${wallet.id}`}
              className="w-full"
              size="default"
              aria-label="Empresa o banco"
            >
              <SelectValue
                placeholder="Empresa o banco"
                aria-label={
                  selectedProvider?.label
                    ? `Proveedor seleccionado: ${selectedProvider.label}`
                    : 'Seleccionar empresa o banco'
                }
              />
            </SelectTrigger>
            <SelectContent>
              {wallet.type !== 'CASH' ? (
                <SelectItem value="__none__">Sin asignar</SelectItem>
              ) : null}
              {providerOptions.map((provider) => (
                <SelectItem key={provider.key} value={provider.key}>
                  <span className="flex items-center gap-2">
                    <WalletProviderIcon
                      providerIconKey={provider.key}
                      className="h-5 w-5 rounded-md border-0"
                      showTooltipLabel={false}
                      data-icon="inline-start"
                    />
                    {provider.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

export default function StepWallets() {
  const { setCanProceed, wallets, setWallets } = useOnboarding();
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const everyWalletNamed =
    wallets.length > 0 && wallets.every((w) => w.name.trim() !== '');
  const hasCashWallet = wallets.some(
    (wallet) => wallet.type === 'CASH' && wallet.name.trim() !== '',
  );
  const hasBankWallet = wallets.some(
    (wallet) => wallet.type === 'BANK' && wallet.name.trim() !== '',
  );
  const canContinue = everyWalletNamed && hasCashWallet && hasBankWallet;
  const canDelete = wallets.length > MIN_WALLETS_WITHOUT_DELETE;
  const swipeEnabled = canDelete && isMobile;

  useEffect(() => {
    setCanProceed(canContinue);
  }, [canContinue, setCanProceed]);

  useEffect(() => {
    if (!swipeEnabled) setOpenSwipeId(null);
  }, [swipeEnabled]);

  const handleNameChange = (id: string, name: string) => {
    setWallets(
      wallets.map((w) => (w.id === id ? { ...w, name } as WalletDraft : w)),
    );
  };

  const handleTypeChange = (id: string, type: WalletDraft['type']) => {
    setWallets(
      wallets.map((w) =>
        w.id === id
          ? {
              ...w,
              type,
              providerIconKey: normalizeProviderForType(type, w.providerIconKey),
            } as WalletDraft
          : w,
      ),
    );
  };

  const handleProviderChange = (id: string, providerIconKey: string | null) => {
    setWallets(
      wallets.map((w) =>
        w.id === id ? ({ ...w, providerIconKey } as WalletDraft) : w,
      ),
    );
  };

  const handleAddPreset = (type: WalletDraft['type']) => {
    setWallets((prev) => [...prev, createWallet(type)]);
  };

  const handleRemove = (id: string) => {
    setWallets((prev) => {
      if (prev.length <= MIN_WALLETS_WITHOUT_DELETE) return prev;
      return prev.filter((w) => w.id !== id);
    });
    setOpenSwipeId((current) => (current === id ? null : current));
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-foreground text-lg font-semibold">
          ¿Dónde guardas tu dinero?
        </h3>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Agrega tus métodos de pago como plantillas: nombre, tipo y banco o
          empresa. Necesitas al menos una de Efectivo y una de Débito, ambas con
          nombre, para continuar. Puedes corregir detalles después en Billeteras.
        </p>
      </div>

      {wallets.length === 0 ? (
        <div
          className="rounded-lg border border-dashed border-border/60 px-4 py-8 text-center"
          role="status"
        >
          <p className="text-muted-foreground text-sm">
            Aún no hay billeteras. Elige una plantilla para empezar.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3" role="list">
          {wallets.map((wallet) => {
            const card = (
              <WalletCardBody
                wallet={wallet}
                canDelete={canDelete}
                onNameChange={(name) => handleNameChange(wallet.id, name)}
                onTypeChange={(type) => handleTypeChange(wallet.id, type)}
                onProviderChange={(key) =>
                  handleProviderChange(wallet.id, key)
                }
                onDelete={() => handleRemove(wallet.id)}
              />
            );

            return (
              <motion.li
                key={wallet.id}
                role="listitem"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                {canDelete ? (
                  <SwipeableOnboardingCard
                    swipeEnabled={swipeEnabled}
                    isOpen={swipeEnabled && openSwipeId === wallet.id}
                    onOpenChange={(open) =>
                      setOpenSwipeId(open ? wallet.id : null)
                    }
                    onDelete={() => handleRemove(wallet.id)}
                    deleteAriaLabel={`Eliminar billetera ${wallet.name || 'sin nombre'}`}
                  >
                    {card}
                  </SwipeableOnboardingCard>
                ) : (
                  card
                )}
              </motion.li>
            );
          })}
        </ul>
      )}

      <div
        className="flex flex-col gap-2 sm:flex-row sm:flex-wrap"
        role="group"
        aria-label="Agregar plantilla de billetera"
      >
        {WALLET_PRESETS.map((preset) => (
          <Button
            key={preset.type}
            type="button"
            variant="outline"
            onClick={() => handleAddPreset(preset.type)}
            className="w-full sm:w-auto sm:flex-1"
            aria-label={preset.ariaLabel}
          >
            {preset.label}
          </Button>
        ))}
      </div>
      {!canContinue ? (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          Para continuar, agrega al menos una billetera de Efectivo y una de
          Débito, ambas con nombre.
        </p>
      ) : null}
      {canDelete ? (
        <p className="text-muted-foreground text-xs leading-relaxed sm:hidden">
          Desliza una billetera hacia la izquierda para eliminarla.
        </p>
      ) : null}
    </div>
  );
}
