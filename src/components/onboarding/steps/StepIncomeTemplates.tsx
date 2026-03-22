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
import { Label } from '@/components/ui/label';
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
    const appliesFirstFortnight = frequency === 'FIRST' || frequency === 'BOTH';
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

  const handleIncomeNameFocus = (id: string, currentName: string) => {
    if (
      currentName === 'Nombre del ingreso' ||
      currentName === 'Nuevo ingreso'
    ) {
      handleNameChange(id, '');
    }
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
      <div className="space-y-2">
        <h3 className="text-foreground text-lg font-semibold">
          ¿De dónde viene tu dinero?
        </h3>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Las plantillas son ingresos que recibes con cierta regularidad (sueldo,
          freelance, etc.). Para cada una: cómo se llama, de dónde viene, un
          monto de referencia, en qué billetera cae el dinero y en qué quincena
          lo recibes.
        </p>
      </div>

      <ul className="flex flex-col gap-4" role="list">
        {incomeTemplates.map((income, index) => {
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
                'space-y-4 rounded-lg border p-4 transition-colors',
                'hover:bg-muted/40',
              )}
              role="listitem"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-muted-foreground text-sm font-medium">
                  Ingreso {index + 1}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemove(income.id)}
                  disabled={!canDelete}
                  aria-label={`Eliminar ingreso ${income.name || `número ${index + 1}`}`}
                  className="text-muted-foreground hover:text-destructive -mt-1 shrink-0"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-1">
                  <Label htmlFor={`income-name-${income.id}`}>
                    Nombre del ingreso
                  </Label>
                  <p className="text-muted-foreground text-xs leading-snug">
                    Cómo lo verás en la app (ej. Sueldo, Honorarios).
                  </p>
                  <Input
                    id={`income-name-${income.id}`}
                    type="text"
                    value={income.name}
                    onChange={(e) =>
                      handleNameChange(income.id, e.target.value)
                    }
                    onFocus={() =>
                      handleIncomeNameFocus(income.id, income.name)
                    }
                    placeholder="Ej. Sueldo"
                    className="min-w-0 w-full"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-1">
                  <Label htmlFor={`income-source-${income.id}`}>
                    Origen{' '}
                    <span className="text-muted-foreground font-normal">
                      (opcional)
                    </span>
                  </Label>
                  <p className="text-muted-foreground text-xs leading-snug">
                    Quien paga o de donde sale (empresa, cliente).
                  </p>
                  <Input
                    id={`income-source-${income.id}`}
                    type="text"
                    value={income.source}
                    onChange={(e) =>
                      handleSourceChange(income.id, e.target.value)
                    }
                    placeholder="Ej. Mi empleador"
                    className="min-w-0 w-full"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-1">
                  <Label htmlFor={`income-amount-${income.id}`}>
                    Monto de referencia
                  </Label>
                  <p className="text-muted-foreground text-xs leading-snug">
                    Aproximado por quincena; puedes ajustarlo después.
                  </p>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-muted-foreground w-9 shrink-0 text-xs"
                      aria-hidden
                    >
                      MXN
                    </span>
                    <Input
                      id={`income-amount-${income.id}`}
                      type="number"
                      min={0}
                      step={1}
                      value={income.amount === 0 ? '' : income.amount}
                      onChange={(e) =>
                        handleAmountChange(income.id, e.target.value)
                      }
                      placeholder="0"
                      className="min-w-0 flex-1"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 sm:col-span-1">
                  <Label htmlFor={`income-wallet-${income.id}`}>
                    Billetera de depósito
                  </Label>
                  <p className="text-muted-foreground text-xs leading-snug">
                    Donde entra este dinero al cobrarlo.
                  </p>
                  <Select
                    value={income.walletId || undefined}
                    onValueChange={(value) =>
                      handleWalletChange(income.id, value)
                    }
                  >
                    <SelectTrigger
                      id={`income-wallet-${income.id}`}
                      className="w-full"
                      size="default"
                    >
                      <SelectValue placeholder="Elige una billetera" />
                    </SelectTrigger>
                    <SelectContent>
                      {wallets.map((wallet) => (
                        <SelectItem key={wallet.id} value={wallet.id}>
                          {wallet.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor={`income-frequency-${income.id}`}>
                    Quincenas en que lo recibes
                  </Label>
                  <p className="text-muted-foreground text-xs leading-snug">
                    Si solo cae en una quincena del mes, elige cuál.
                  </p>
                  <Select
                    value={frequency}
                    onValueChange={(value) =>
                      handleFrequencyChange(
                        income.id,
                        value as 'FIRST' | 'SECOND' | 'BOTH',
                      )
                    }
                  >
                    <SelectTrigger
                      id={`income-frequency-${income.id}`}
                      className="w-full sm:max-w-md"
                      size="default"
                    >
                      <SelectValue placeholder="Frecuencia" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BOTH">Ambas quincenas</SelectItem>
                      <SelectItem value="FIRST">Solo primera quincena</SelectItem>
                      <SelectItem value="SECOND">Solo segunda quincena</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
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
