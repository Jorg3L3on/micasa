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
  type ExpenseTemplateDraft,
} from '@/components/onboarding/OnboardingContext';
import { cn } from '@/lib/utils';

export default function StepExpenseTemplates() {
  const {
    setCanProceed,
    expenseTemplates,
    setExpenseTemplates,
    categories,
    wallets,
  } = useOnboarding();

  useEffect(() => {
    setCanProceed(expenseTemplates.length >= 2);
  }, [expenseTemplates.length, setCanProceed]);

  const handleNameChange = (id: string, name: string) => {
    setExpenseTemplates((prev: ExpenseTemplateDraft[]) =>
      prev.map((e) => (e.id === id ? { ...e, name } : e)),
    );
  };

  const handleAmountChange = (id: string, value: string) => {
    const parsed = value === '' ? 0 : Number.parseFloat(value) || 0;
    setExpenseTemplates((prev: ExpenseTemplateDraft[]) =>
      prev.map((e) => (e.id === id ? { ...e, amount: parsed } : e)),
    );
  };

  const handleCategoryChange = (id: string, categoryId: string) => {
    setExpenseTemplates((prev: ExpenseTemplateDraft[]) =>
      prev.map((e) => (e.id === id ? { ...e, categoryId } : e)),
    );
  };

  const handleWalletChange = (id: string, walletId: string) => {
    setExpenseTemplates((prev: ExpenseTemplateDraft[]) =>
      prev.map((e) => (e.id === id ? { ...e, walletId } : e)),
    );
  };

  const handleRecurringToggle = (
    id: string,
    frequency: 'NONE' | 'FIRST' | 'SECOND' | 'BOTH',
  ) => {
    const isRecurring = frequency !== 'NONE';
    const appliesFirstFortnight = frequency === 'FIRST' || frequency === 'BOTH';
    const appliesSecondFortnight =
      frequency === 'SECOND' || frequency === 'BOTH';

    setExpenseTemplates((prev: ExpenseTemplateDraft[]) =>
      prev.map((e) =>
        e.id === id
          ? {
              ...e,
              isRecurring,
              appliesFirstFortnight,
              appliesSecondFortnight,
            }
          : e,
      ),
    );
  };

  const handleExpenseNameFocus = (id: string, currentName: string) => {
    if (
      currentName === 'Nombre del gasto' ||
      currentName === 'Nuevo gasto'
    ) {
      handleNameChange(id, '');
    }
  };

  const handleAdd = () => {
    setExpenseTemplates((prev: ExpenseTemplateDraft[]) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: 'Nuevo gasto',
        amount: 0,
        categoryId: '',
        walletId: '',
        isRecurring: false,
        appliesFirstFortnight: false,
        appliesSecondFortnight: false,
      },
    ]);
  };

  const handleRemove = (id: string) => {
    if (expenseTemplates.length <= 1) return;
    setExpenseTemplates((prev: ExpenseTemplateDraft[]) =>
      prev.filter((e) => e.id !== id),
    );
  };

  const canDelete = expenseTemplates.length > 1;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-foreground text-lg font-semibold">
          ¿Qué gastos haces frecuentemente?
        </h3>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Las plantillas de gasto representan pagos que realizas con frecuencia.
          Ejemplos: renta, internet, suscripciones, servicios.
        </p>
      </div>

      <ul className="flex flex-col gap-3" role="list">
        {expenseTemplates.map((expense) => {
          let frequency: 'NONE' | 'FIRST' | 'SECOND' | 'BOTH' = 'NONE';
          if (expense.appliesFirstFortnight && expense.appliesSecondFortnight) {
            frequency = 'BOTH';
          } else if (expense.appliesFirstFortnight) {
            frequency = 'FIRST';
          } else if (expense.appliesSecondFortnight) {
            frequency = 'SECOND';
          }

          return (
          <motion.li
            key={expense.id}
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
              value={expense.name}
              onChange={(e) => handleNameChange(expense.id, e.target.value)}
              onFocus={() =>
                handleExpenseNameFocus(expense.id, expense.name)
              }
              placeholder="Nombre del gasto"
              className="min-w-0 flex-1 basis-28"
              aria-label={`Nombre del gasto: ${expense.name}`}
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
                value={expense.amount === 0 ? '' : expense.amount}
                onChange={(e) => handleAmountChange(expense.id, e.target.value)}
                placeholder="0"
                className="w-24"
                aria-label="Monto del gasto en pesos"
              />
            </div>
            <Select
              value={expense.categoryId || undefined}
              onValueChange={(value) => handleCategoryChange(expense.id, value)}
            >
              <SelectTrigger className="w-36" size="default">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={expense.walletId || undefined}
              onValueChange={(value) => handleWalletChange(expense.id, value)}
            >
              <SelectTrigger className="w-36" size="default">
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
                handleRecurringToggle(
                  expense.id,
                  value as 'NONE' | 'FIRST' | 'SECOND' | 'BOTH',
                )
              }
            >
              <SelectTrigger className="w-44" size="default">
                <SelectValue placeholder="Frecuencia" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">No recurrente</SelectItem>
                <SelectItem value="BOTH">Ambas quincenas</SelectItem>
                <SelectItem value="FIRST">Solo primera quincena</SelectItem>
                <SelectItem value="SECOND">Solo segunda quincena</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => handleRemove(expense.id)}
              disabled={!canDelete}
              aria-label={`Eliminar gasto ${expense.name}`}
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
        aria-label="Agregar gasto"
      >
        + Agregar gasto
      </Button>
    </div>
  );
}
