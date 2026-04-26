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

  const hasMinimumRows = expenseTemplates.length >= 2;
  const hasValidTemplates = expenseTemplates.every((expense) => {
    const hasName = expense.name.trim() !== '';
    const hasAmount = Number.isFinite(expense.amount) && expense.amount > 0;
    const hasCategory = expense.categoryId.trim() !== '';
    const hasWallet = expense.walletId.trim() !== '';
    const hasValidRecurrence =
      !expense.isRecurring ||
      expense.appliesFirstFortnight ||
      expense.appliesSecondFortnight;
    return hasName && hasAmount && hasCategory && hasWallet && hasValidRecurrence;
  });
  const canContinue = hasMinimumRows && hasValidTemplates;

  useEffect(() => {
    setCanProceed(canContinue);
  }, [canContinue, setCanProceed]);

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
    if (currentName === 'Nuevo gasto') {
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
      <div className="space-y-2">
        <h3 className="text-foreground text-lg font-semibold">
          ¿Qué gastos haces frecuentemente?
        </h3>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Agrega gastos frecuentes con monto, categoria, billetera y recurrencia.
        </p>
      </div>

      <ul className="flex flex-col gap-4" role="list">
        {expenseTemplates.map((expense, index) => {
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
                  Gasto {index + 1}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemove(expense.id)}
                  disabled={!canDelete}
                  aria-label={`Eliminar gasto ${expense.name || `número ${index + 1}`}`}
                  className="text-muted-foreground hover:text-destructive -mt-1 shrink-0"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-1">
                  <Label htmlFor={`expense-name-${expense.id}`}>
                    Nombre del gasto
                  </Label>
                  <p className="text-muted-foreground text-xs leading-snug sm:hidden">
                    Ej. Renta
                  </p>
                  <p className="text-muted-foreground hidden text-xs leading-snug sm:block">
                    Como lo veras en la app (ej. Renta, Internet).
                  </p>
                  <Input
                    id={`expense-name-${expense.id}`}
                    type="text"
                    value={expense.name}
                    onChange={(e) =>
                      handleNameChange(expense.id, e.target.value)
                    }
                    onFocus={() =>
                      handleExpenseNameFocus(expense.id, expense.name)
                    }
                    placeholder="Ej. Renta"
                    className="min-w-0 w-full"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-1">
                  <Label htmlFor={`expense-amount-${expense.id}`}>
                    Monto de referencia
                  </Label>
                  <p className="text-muted-foreground text-xs leading-snug sm:hidden">
                    Monto estimado
                  </p>
                  <p className="text-muted-foreground hidden text-xs leading-snug sm:block">
                    Aproximado por pago; puedes ajustarlo despues.
                  </p>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-muted-foreground w-9 shrink-0 text-xs"
                      aria-hidden
                    >
                      MXN
                    </span>
                    <Input
                      id={`expense-amount-${expense.id}`}
                      type="number"
                      min={0}
                      step={1}
                      value={expense.amount === 0 ? '' : expense.amount}
                      onChange={(e) =>
                        handleAmountChange(expense.id, e.target.value)
                      }
                      placeholder="0"
                      className="min-w-0 flex-1"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 sm:col-span-1">
                  <Label htmlFor={`expense-category-${expense.id}`}>
                    Categoría
                  </Label>
                  <p className="text-muted-foreground text-xs leading-snug sm:hidden">
                    Tipo de gasto
                  </p>
                  <p className="text-muted-foreground hidden text-xs leading-snug sm:block">
                    Agrupa el gasto para ver totales por tipo.
                  </p>
                  <Select
                    value={expense.categoryId || undefined}
                    onValueChange={(value) =>
                      handleCategoryChange(expense.id, value)
                    }
                  >
                    <SelectTrigger
                      id={`expense-category-${expense.id}`}
                      className="w-full"
                      size="default"
                    >
                      <SelectValue placeholder="Elige una categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 sm:col-span-1">
                  <Label htmlFor={`expense-wallet-${expense.id}`}>
                    Billetera de pago
                  </Label>
                  <p className="text-muted-foreground text-xs leading-snug sm:hidden">
                    Desde donde pagas
                  </p>
                  <p className="text-muted-foreground hidden text-xs leading-snug sm:block">
                    Desde donde sueles pagar este gasto.
                  </p>
                  <Select
                    value={expense.walletId || undefined}
                    onValueChange={(value) =>
                      handleWalletChange(expense.id, value)
                    }
                  >
                    <SelectTrigger
                      id={`expense-wallet-${expense.id}`}
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
                  <Label htmlFor={`expense-recurrence-${expense.id}`}>
                    Recurrencia y quincenas
                  </Label>
                  <p className="text-muted-foreground text-xs leading-snug sm:hidden">
                    No recurrente, primera, segunda o ambas
                  </p>
                  <p className="text-muted-foreground hidden text-xs leading-snug sm:block">
                    Si no es un pago fijo, elige No recurrente. Si si, indica en
                    que quincena(s) cae.
                  </p>
                  <Select
                    value={frequency}
                    onValueChange={(value) =>
                      handleRecurringToggle(
                        expense.id,
                        value as 'NONE' | 'FIRST' | 'SECOND' | 'BOTH',
                      )
                    }
                  >
                    <SelectTrigger
                      id={`expense-recurrence-${expense.id}`}
                      className="w-full sm:max-w-md"
                      size="default"
                    >
                      <SelectValue placeholder="Recurrencia" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">No recurrente</SelectItem>
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
        aria-label="Agregar gasto"
      >
        + Agregar gasto
      </Button>
      {!canContinue ? (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          Para continuar, necesitas dos gastos con nombre, monto mayor a 0,
          categoria y billetera.
        </p>
      ) : null}
    </div>
  );
}
