'use client';

import { useEffect, useState } from 'react';
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  useOnboarding,
  type ExpenseTemplateDraft,
} from '@/components/onboarding/OnboardingContext';
import { SwipeableOnboardingCard } from '@/components/onboarding/SwipeableOnboardingCard';
import { createClientId } from '@/lib/polyfills';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

/** Delete only when more templates exist than the continue minimum (2). */
const MIN_WITHOUT_DELETE = 2;

type ExpensePreset = {
  name: string;
  label: string;
  ariaLabel: string;
  isRecurring: boolean;
  appliesFirstFortnight: boolean;
  appliesSecondFortnight: boolean;
};

const EXPENSE_PRESETS: ExpensePreset[] = [
  {
    name: 'Renta',
    label: '+ Renta',
    ariaLabel: 'Agregar plantilla de renta',
    isRecurring: true,
    appliesFirstFortnight: true,
    appliesSecondFortnight: true,
  },
  {
    name: 'Internet',
    label: '+ Internet',
    ariaLabel: 'Agregar plantilla de internet',
    isRecurring: true,
    appliesFirstFortnight: true,
    appliesSecondFortnight: true,
  },
  {
    name: '',
    label: '+ Otro',
    ariaLabel: 'Agregar otra plantilla de gasto',
    isRecurring: false,
    appliesFirstFortnight: false,
    appliesSecondFortnight: false,
  },
];

const createExpense = (preset: ExpensePreset): ExpenseTemplateDraft => ({
  id: createClientId(),
  name: preset.name,
  amount: 0,
  categoryId: '',
  walletId: '',
  isRecurring: preset.isRecurring,
  appliesFirstFortnight: preset.appliesFirstFortnight,
  appliesSecondFortnight: preset.appliesSecondFortnight,
});

function frequencyFromExpense(
  expense: ExpenseTemplateDraft,
): 'NONE' | 'FIRST' | 'SECOND' | 'BOTH' {
  if (expense.appliesFirstFortnight && expense.appliesSecondFortnight) {
    return 'BOTH';
  }
  if (expense.appliesFirstFortnight) return 'FIRST';
  if (expense.appliesSecondFortnight) return 'SECOND';
  return 'NONE';
}

type ExpenseCardBodyProps = {
  expense: ExpenseTemplateDraft;
  canDelete: boolean;
  categories: { id: string; name: string }[];
  wallets: { id: string; name: string }[];
  onNameChange: (name: string) => void;
  onAmountChange: (value: string) => void;
  onCategoryChange: (categoryId: string) => void;
  onWalletChange: (walletId: string) => void;
  onRecurrenceChange: (frequency: 'NONE' | 'FIRST' | 'SECOND' | 'BOTH') => void;
  onDelete: () => void;
};

function ExpenseCardBody({
  expense,
  canDelete,
  categories,
  wallets,
  onNameChange,
  onAmountChange,
  onCategoryChange,
  onWalletChange,
  onRecurrenceChange,
  onDelete,
}: ExpenseCardBodyProps) {
  const frequency = frequencyFromExpense(expense);

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-lg border border-border/60 bg-card p-4 transition-colors',
        'hover:bg-muted/30',
      )}
    >
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label htmlFor={`expense-name-${expense.id}`}>Nombre</Label>
          <Input
            id={`expense-name-${expense.id}`}
            type="text"
            value={expense.name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Ej. Renta"
            className="w-full"
            aria-label={
              expense.name.trim()
                ? `Nombre del gasto: ${expense.name}`
                : 'Nombre del gasto'
            }
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
                aria-label={`Eliminar gasto ${expense.name || 'sin nombre'}`}
                className="mb-0 hidden size-9 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive md:inline-flex"
              >
                <Trash2 className="size-4" data-icon="inline-start" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={4}>
              Eliminar gasto
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`expense-amount-${expense.id}`}>Monto</Label>
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
              onChange={(e) => onAmountChange(e.target.value)}
              placeholder="0"
              className="min-w-0 flex-1"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`expense-category-${expense.id}`}>Categoría</Label>
          <Select
            value={expense.categoryId || undefined}
            onValueChange={onCategoryChange}
          >
            <SelectTrigger
              id={`expense-category-${expense.id}`}
              className="w-full"
              size="default"
              aria-label="Categoría del gasto"
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

        <div className="space-y-1.5">
          <Label htmlFor={`expense-wallet-${expense.id}`}>Billetera</Label>
          <Select
            value={expense.walletId || undefined}
            onValueChange={onWalletChange}
          >
            <SelectTrigger
              id={`expense-wallet-${expense.id}`}
              className="w-full"
              size="default"
              aria-label="Billetera de pago"
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

        <div className="space-y-1.5">
          <Label htmlFor={`expense-recurrence-${expense.id}`}>
            Recurrencia
          </Label>
          <Select
            value={frequency}
            onValueChange={(value) =>
              onRecurrenceChange(value as 'NONE' | 'FIRST' | 'SECOND' | 'BOTH')
            }
          >
            <SelectTrigger
              id={`expense-recurrence-${expense.id}`}
              className="w-full"
              size="default"
              aria-label="Recurrencia y quincenas"
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
    </div>
  );
}

export default function StepExpenseTemplates() {
  const {
    setCanProceed,
    expenseTemplates,
    setExpenseTemplates,
    categories,
    wallets,
  } = useOnboarding();
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const hasMinimumRows = expenseTemplates.length >= 2;
  const hasValidTemplates =
    expenseTemplates.length > 0 &&
    expenseTemplates.every((expense) => {
      const hasName = expense.name.trim() !== '';
      const hasAmount = Number.isFinite(expense.amount) && expense.amount > 0;
      const hasCategory = expense.categoryId.trim() !== '';
      const hasWallet = expense.walletId.trim() !== '';
      const hasValidRecurrence =
        !expense.isRecurring ||
        expense.appliesFirstFortnight ||
        expense.appliesSecondFortnight;
      return (
        hasName && hasAmount && hasCategory && hasWallet && hasValidRecurrence
      );
    });
  const canContinue = hasMinimumRows && hasValidTemplates;
  const canDelete = expenseTemplates.length > MIN_WITHOUT_DELETE;
  const swipeEnabled = canDelete && isMobile;

  useEffect(() => {
    setCanProceed(canContinue);
  }, [canContinue, setCanProceed]);

  useEffect(() => {
    if (!swipeEnabled) setOpenSwipeId(null);
  }, [swipeEnabled]);

  const handleNameChange = (id: string, name: string) => {
    setExpenseTemplates((prev) =>
      prev.map((e) => (e.id === id ? { ...e, name } : e)),
    );
  };

  const handleAmountChange = (id: string, value: string) => {
    const parsed = value === '' ? 0 : Number.parseFloat(value) || 0;
    setExpenseTemplates((prev) =>
      prev.map((e) => (e.id === id ? { ...e, amount: parsed } : e)),
    );
  };

  const handleCategoryChange = (id: string, categoryId: string) => {
    setExpenseTemplates((prev) =>
      prev.map((e) => (e.id === id ? { ...e, categoryId } : e)),
    );
  };

  const handleWalletChange = (id: string, walletId: string) => {
    setExpenseTemplates((prev) =>
      prev.map((e) => (e.id === id ? { ...e, walletId } : e)),
    );
  };

  const handleRecurrenceChange = (
    id: string,
    frequency: 'NONE' | 'FIRST' | 'SECOND' | 'BOTH',
  ) => {
    const isRecurring = frequency !== 'NONE';
    setExpenseTemplates((prev) =>
      prev.map((e) =>
        e.id === id
          ? {
              ...e,
              isRecurring,
              appliesFirstFortnight:
                frequency === 'FIRST' || frequency === 'BOTH',
              appliesSecondFortnight:
                frequency === 'SECOND' || frequency === 'BOTH',
            }
          : e,
      ),
    );
  };

  const handleAddPreset = (preset: ExpensePreset) => {
    setExpenseTemplates((prev) => [...prev, createExpense(preset)]);
  };

  const handleRemove = (id: string) => {
    setExpenseTemplates((prev) => {
      if (prev.length <= MIN_WITHOUT_DELETE) return prev;
      return prev.filter((e) => e.id !== id);
    });
    setOpenSwipeId((current) => (current === id ? null : current));
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-foreground text-lg font-semibold">
          ¿Qué gastos haces frecuentemente?
        </h3>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Agrega plantillas de gasto: nombre, monto, categoría, billetera y
          recurrencia. Necesitas al menos dos completas para continuar. Puedes
          ajustarlas después en Gastos.
        </p>
      </div>

      {expenseTemplates.length === 0 ? (
        <div
          className="rounded-lg border border-dashed border-border/60 px-4 py-8 text-center"
          role="status"
        >
          <p className="text-muted-foreground text-sm">
            Aún no hay gastos. Elige una plantilla para empezar.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3" role="list">
          {expenseTemplates.map((expense) => {
            const card = (
              <ExpenseCardBody
                expense={expense}
                canDelete={canDelete}
                categories={categories}
                wallets={wallets}
                onNameChange={(name) => handleNameChange(expense.id, name)}
                onAmountChange={(value) =>
                  handleAmountChange(expense.id, value)
                }
                onCategoryChange={(categoryId) =>
                  handleCategoryChange(expense.id, categoryId)
                }
                onWalletChange={(walletId) =>
                  handleWalletChange(expense.id, walletId)
                }
                onRecurrenceChange={(frequency) =>
                  handleRecurrenceChange(expense.id, frequency)
                }
                onDelete={() => handleRemove(expense.id)}
              />
            );

            return (
              <motion.li
                key={expense.id}
                role="listitem"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                {canDelete ? (
                  <SwipeableOnboardingCard
                    swipeEnabled={swipeEnabled}
                    isOpen={swipeEnabled && openSwipeId === expense.id}
                    onOpenChange={(open) =>
                      setOpenSwipeId(open ? expense.id : null)
                    }
                    onDelete={() => handleRemove(expense.id)}
                    deleteAriaLabel={`Eliminar gasto ${expense.name || 'sin nombre'}`}
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
        aria-label="Agregar plantilla de gasto"
      >
        {EXPENSE_PRESETS.map((preset) => (
          <Button
            key={preset.label}
            type="button"
            variant="outline"
            onClick={() => handleAddPreset(preset)}
            className="w-full sm:w-auto sm:flex-1"
            aria-label={preset.ariaLabel}
          >
            {preset.label}
          </Button>
        ))}
      </div>
      {!canContinue ? (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          Para continuar, agrega al menos dos gastos con nombre, monto mayor a
          0, categoría y billetera.
        </p>
      ) : null}
      {canDelete ? (
        <p className="text-muted-foreground text-xs leading-relaxed sm:hidden">
          Desliza un gasto hacia la izquierda para eliminarlo.
        </p>
      ) : null}
    </div>
  );
}
