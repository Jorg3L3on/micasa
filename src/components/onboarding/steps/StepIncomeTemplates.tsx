'use client';

import { useEffect } from 'react';
import { Trash2 } from 'lucide-react';
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
  type IncomeTemplateDraft,
} from '@/components/onboarding/OnboardingContext';
import { cn } from '@/lib/utils';

export default function StepIncomeTemplates() {
  const { setCanProceed, incomeTemplates, setIncomeTemplates, wallets } =
    useOnboarding();

  useEffect(() => {
    setCanProceed(incomeTemplates.length >= 1);
  }, [incomeTemplates.length, setCanProceed]);

  const handleNameChange = (id: string, name: string) => {
    setIncomeTemplates((prev: IncomeTemplateDraft[]) =>
      prev.map((i) => (i.id === id ? { ...i, name } : i)),
    );
  };

  const handleAmountChange = (id: string, value: string) => {
    const parsed = value === '' ? 0 : Number.parseFloat(value) || 0;
    setIncomeTemplates((prev: IncomeTemplateDraft[]) =>
      prev.map((i) => (i.id === id ? { ...i, amount: parsed } : i)),
    );
  };

  const handleWalletChange = (id: string, walletId: string) => {
    setIncomeTemplates((prev: IncomeTemplateDraft[]) =>
      prev.map((i) => (i.id === id ? { ...i, walletId } : i)),
    );
  };

  const handleSourceChange = (id: string, source: string) => {
    setIncomeTemplates((prev: IncomeTemplateDraft[]) =>
      prev.map((i) => (i.id === id ? { ...i, source } : i)),
    );
  };

  const handleFrequencyChange = (
    id: string,
    frequency: 'FIRST' | 'SECOND' | 'BOTH',
  ) => {
    const appliesFirstFortnight =
      frequency === 'FIRST' || frequency === 'BOTH';
    const appliesSecondFortnight =
      frequency === 'SECOND' || frequency === 'BOTH';

    setIncomeTemplates((prev: IncomeTemplateDraft[]) =>
      prev.map((i) =>
        i.id === id
          ? {
              ...i,
              appliesFirstFortnight,
              appliesSecondFortnight,
            }
          : i,
      ),
    );
  };

  const handleAdd = () => {
    setIncomeTemplates((prev: IncomeTemplateDraft[]) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: 'Nuevo ingreso',
        amount: 0,
        walletId: '',
        source: '',
        appliesFirstFortnight: true,
        appliesSecondFortnight: true,
      },
    ]);
  };

  const handleRemove = (id: string) => {
    if (incomeTemplates.length <= 1) return;
    setIncomeTemplates((prev: IncomeTemplateDraft[]) =>
      prev.filter((i) => i.id !== id),
    );
  };

  const canDelete = incomeTemplates.length > 1;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-foreground text-lg font-semibold">
          ¿De dónde viene tu dinero?
        </h3>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Las plantillas de ingreso representan dinero que recibes
          regularmente. Ejemplos: sueldo, trabajos freelance, ventas.
        </p>
      </div>

      <ul className="flex flex-col gap-3" role="list">
        {incomeTemplates.map((income) => {
          let frequency: 'FIRST' | 'SECOND' | 'BOTH' = 'BOTH';
          if (income.appliesFirstFortnight && income.appliesSecondFortnight) {
            frequency = 'BOTH';
          } else if (income.appliesFirstFortnight) {
            frequency = 'FIRST';
          } else if (income.appliesSecondFortnight) {
            frequency = 'SECOND';
          }

          return (
            <motion.li
              key={income.id}
              className={cn(
                'flex flex-wrap items-center gap-3 rounded-lg border p-4 transition-colors',
                'hover:bg-muted/40',
              )}
              role="listitem"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Input
                type="text"
                value={income.name}
                onChange={(e) => handleNameChange(income.id, e.target.value)}
                placeholder="Nombre del ingreso"
                className="min-w-0 flex-1 basis-32"
                aria-label={`Nombre del ingreso: ${income.name}`}
              />
              <Input
                type="text"
                value={income.source}
                onChange={(e) => handleSourceChange(income.id, e.target.value)}
                placeholder="Origen (empresa, cliente...)"
                className="min-w-[8rem] max-w-[12rem] text-sm"
                aria-label={`Origen del ingreso: ${income.source || income.name}`}
              />
              <div className="flex items-center gap-2">
                <span
                  className="text-muted-foreground shrink-0 text-xs"
                  aria-hidden
                >
                  MXN
                </span>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={income.amount === 0 ? '' : income.amount}
                  onChange={(e) =>
                    handleAmountChange(income.id, e.target.value)
                  }
                  placeholder="0"
                  className="w-24"
                  aria-label="Monto del ingreso en pesos"
                />
              </div>
              <Select
                value={income.walletId || undefined}
                onValueChange={(value) => handleWalletChange(income.id, value)}
              >
                <SelectTrigger className="w-40" size="default">
                  <SelectValue placeholder="Billetera" />
                </SelectTrigger>
                <SelectContent>
                  {wallets.map((wallet) => (
                    <SelectItem key={wallet.id} value={wallet.id}>
                      {wallet.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={frequency}
                onValueChange={(value) =>
                  handleFrequencyChange(
                    income.id,
                    value as 'FIRST' | 'SECOND' | 'BOTH',
                  )
                }
              >
                <SelectTrigger className="w-44" size="default">
                  <SelectValue placeholder="Frecuencia" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BOTH">Ambas quincenas</SelectItem>
                  <SelectItem value="FIRST">Solo primera quincena</SelectItem>
                  <SelectItem value="SECOND">Solo segunda quincena</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleRemove(income.id)}
                disabled={!canDelete}
                aria-label={`Eliminar ingreso ${income.name}`}
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
        aria-label="Agregar ingreso"
      >
        + Agregar ingreso
      </Button>
    </div>
  );
}
