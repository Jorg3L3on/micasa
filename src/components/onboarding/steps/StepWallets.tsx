'use client';

import { useEffect } from 'react';
import { Banknote, CreditCard, Landmark, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
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
  useOnboarding,
  type WalletDraft,
} from '@/components/onboarding/OnboardingContext';
import { cn } from '@/lib/utils';

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

const createWallet = (
  name: string,
  type: WalletDraft['type'],
): WalletDraft => ({
  id: crypto.randomUUID(),
  name,
  type,
});

const WALLET_NAME_PLACEHOLDER_BY_TYPE: Record<WalletDraft['type'], string> = {
  CASH: 'Ej. Efectivo',
  BANK: 'Ej. BBVA o cuenta de débito',
  CREDIT: 'Ej. Tarjeta de crédito',
};

export default function StepWallets() {
  const { setCanProceed, wallets, setWallets } = useOnboarding();

  useEffect(() => {
    const everyWalletNamed = wallets.every((w) => w.name.trim() !== '');
    setCanProceed(wallets.length >= 2 && everyWalletNamed);
  }, [wallets, setCanProceed]);

  const handleNameChange = (id: string, name: string) => {
    setWallets(
      wallets.map((w) => (w.id === id ? { ...w, name } as WalletDraft : w)),
    );
  };

  const handleTypeChange = (id: string, type: WalletDraft['type']) => {
    setWallets(
      wallets.map((w) => (w.id === id ? { ...w, type } as WalletDraft : w)),
    );
  };

  const handleAdd = () => {
    setWallets([...wallets, createWallet('', 'BANK')]);
  };

  const handleRemove = (id: string) => {
    if (wallets.length <= 1) return;
    setWallets(wallets.filter((w) => w.id !== id));
  };

  const canDelete = wallets.length > 1;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-foreground text-lg font-semibold">
          ¿Dónde guardas tu dinero?
        </h3>
        <p className="text-muted-foreground text-sm leading-relaxed">
          En este paso necesitas al menos dos billeteras con un nombre que te
          sirva para reconocerlas: una de tipo Efectivo y otra de tipo Tarjeta
          de débito (tu cuenta o tarjeta de débito). Por ejemplo «Efectivo» y
          «BBVA», o los nombres que prefieras.
        </p>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Puedes añadir más billeteras después (otras cuentas, tarjetas de
          crédito) con el botón de abajo.
        </p>
      </div>

      <ul className="flex flex-col gap-3" role="list">
        {wallets.map((wallet) => {
          const Icon = TYPE_ICONS[wallet.type];
          const namePlaceholder = WALLET_NAME_PLACEHOLDER_BY_TYPE[wallet.type];
          const nameLabel =
            wallet.name.trim() !== ''
              ? `Nombre de billetera: ${wallet.name}`
              : `Nombre de billetera (${namePlaceholder})`;
          return (
            <motion.li
              key={wallet.id}
              className={cn(
                'flex flex-wrap items-center gap-3 rounded-lg border p-4 transition-colors',
                'hover:bg-muted/40',
              )}
              role="listitem"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <span
                className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg"
                aria-hidden
              >
                <Icon className="size-4" strokeWidth={2} />
              </span>
              <Input
                type="text"
                value={wallet.name}
                onChange={(e) => handleNameChange(wallet.id, e.target.value)}
                placeholder={namePlaceholder}
                className="min-w-0 flex-1"
                aria-label={nameLabel}
              />
              <Select
                value={wallet.type}
                onValueChange={(value) =>
                  handleTypeChange(wallet.id, value as WalletDraft['type'])
                }
              >
                <SelectTrigger className="w-[180px]" size="default">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WALLET_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleRemove(wallet.id)}
                disabled={!canDelete}
                aria-label={`Eliminar billetera ${wallet.name}`}
                className="shrink-0 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </Button>
            </motion.li>
          );
        })}
      </ul>

      <Button
        type="button"
        variant="outline"
        onClick={handleAdd}
        className="w-full"
        aria-label="Agregar billetera"
      >
        + Agregar billetera
      </Button>
    </div>
  );
}
