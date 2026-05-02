'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarPlus, Plus, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import CreateMonthForm from '@/components/CreateMonthForm';
import { cn } from '@/lib/utils';
import { useFinanceContext } from '@/context/finance-context';
import { clientFetchFromApi } from '@/lib/api/client-fetch';
import { createExpenseTransaction } from '@/lib/api/transactions';
import type { DashboardData } from '@/types/dashboard';
import type { AddExpenseFormValues } from '@/schemas/transaction.schema';
import { DASHBOARD_CARD_CLASS } from './constants';
import DashboardQuickIncomeDialog from './DashboardQuickIncomeDialog';
import DashboardQuickExpenseDialog from './DashboardQuickExpenseDialog';

type QuickActionsCardProps = {
  compact?: boolean;
  period: DashboardData['period'];
};

type FortnightMeta = {
  id: number;
  label: string;
  year: number;
  month: number;
  period: 'FIRST' | 'SECOND';
};

const CREATE_MONTH_DIALOG = {
  title: 'Crear mes (dos quincenas)',
  description: 'Elige un mes para crear la primera y segunda quincena.',
  idPrefixCompact: 'quick-actions-create-month',
  idPrefixFull: 'quick-actions-create-month-full',
} as const;

export default function QuickActionsCard({
  compact = false,
  period,
}: QuickActionsCardProps) {
  const router = useRouter();
  const { context } = useFinanceContext();
  const [createMonthOpen, setCreateMonthOpen] = useState(false);
  const [fortnight, setFortnight] = useState<FortnightMeta | null>(null);
  const [fortnightError, setFortnightError] = useState<string | null>(null);
  const [isResolvingFortnight, setIsResolvingFortnight] = useState(false);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [incomeDialogOpen, setIncomeDialogOpen] = useState(false);

  const handleCreateMonthSuccess = () => setCreateMonthOpen(false);

  const buttonCompact = 'h-auto flex-col gap-1 py-2 text-xs';
  const buttonFull = 'h-auto flex-col gap-1 py-3';
  const iconSizeCompact = 'size-3.5';
  const iconSizeFull = 'h-4 w-4';

  const resolveCurrentFortnight = useCallback(async () => {
    if (fortnight || isResolvingFortnight) {
      return fortnight;
    }

    setIsResolvingFortnight(true);
    setFortnightError(null);

    try {
      const paddedMonth = String(period.month).padStart(2, '0');
      const result = await clientFetchFromApi<FortnightMeta | null>(
        `/api/fortnights?year=${period.year}&month=${paddedMonth}&period=${period.period}`,
        undefined,
        context,
      );

      if (!result) {
        setFortnightError(
          'Primero crea el mes y las quincenas para poder registrar gastos e ingresos desde el panel.',
        );
        return null;
      }

      setFortnight(result);
      return result;
    } catch (error) {
      console.error('Error al obtener la quincena actual desde el panel:', error);
      setFortnightError(
        'No se pudo obtener la quincena actual. Intenta de nuevo o usa la vista de planificación.',
      );
      return null;
    } finally {
      setIsResolvingFortnight(false);
    }
  }, [context, fortnight, isResolvingFortnight, period]);

  const handleOpenExpenseDialog = useCallback(async () => {
    const currentFortnight = await resolveCurrentFortnight();
    if (!currentFortnight) {
      return;
    }
    setExpenseDialogOpen(true);
  }, [resolveCurrentFortnight]);

  const handleOpenIncomeDialog = useCallback(async () => {
    const currentFortnight = await resolveCurrentFortnight();
    if (!currentFortnight) {
      return;
    }
    setIncomeDialogOpen(true);
  }, [resolveCurrentFortnight]);

  const handleQuickExpenseSubmit = useCallback(
    async (values: AddExpenseFormValues) => {
      if (!fortnight) {
        throw new Error('No hay una quincena activa para este periodo.');
      }

      await createExpenseTransaction(
        {
          fortnight_id: fortnight.id,
          category_id: values.categoryId,
          description: values.name,
          amount: values.amount,
          payment_method_id: values.paymentMethodId,
          is_paid: values.isPaid,
          payment_date: values.date
            ? `${values.date}T00:00:00.000Z`
            : null,
        },
        context,
      );

      router.refresh();
    },
    [context, fortnight, router],
  );

  const handleQuickIncomeCreated = useCallback(() => {
    router.refresh();
  }, [router]);

  return (
    <Card className={DASHBOARD_CARD_CLASS} role="region" aria-label="Acciones rápidas">
      <CardHeader className={compact ? 'pb-3' : undefined}>
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 dark:bg-violet-500/15">
            <Plus className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" aria-hidden />
          </span>
          <CardTitle className="text-sm font-semibold leading-none">
            Acciones rápidas
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent
        className={
          compact
            ? 'grid grid-cols-3 gap-2 pt-1'
            : 'grid grid-cols-2 gap-2 pt-1'
        }
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            compact ? buttonCompact : buttonFull,
            'border-border/70 bg-muted/30 hover:bg-muted/50 hover:border-border',
          )}
          aria-label="Agregar gasto"
          onClick={handleOpenExpenseDialog}
          disabled={isResolvingFortnight}
        >
          <Plus
            className={compact ? iconSizeCompact : iconSizeFull}
            aria-hidden
          />
          <span>{compact ? 'Gasto' : 'Agregar gasto'}</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            compact ? buttonCompact : buttonFull,
            'border-border/70 bg-muted/30 hover:bg-muted/50 hover:border-border',
          )}
          aria-label="Agregar ingreso"
          onClick={handleOpenIncomeDialog}
          disabled={isResolvingFortnight}
        >
          <TrendingUp
            className={compact ? iconSizeCompact : iconSizeFull}
            aria-hidden
          />
          <span>{compact ? 'Ingreso' : 'Agregar ingreso'}</span>
        </Button>
        <Dialog open={createMonthOpen} onOpenChange={setCreateMonthOpen}>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                compact ? buttonCompact : buttonFull,
                'border-border/70 bg-muted/30 hover:bg-muted/50 hover:border-border',
                compact ? '' : 'col-span-2',
              )}
              aria-label={CREATE_MONTH_DIALOG.title}
            >
              <CalendarPlus
                className={compact ? iconSizeCompact : iconSizeFull}
                aria-hidden
              />
              <span>{compact ? 'Crear mes' : CREATE_MONTH_DIALOG.title}</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{CREATE_MONTH_DIALOG.title}</DialogTitle>
              <DialogDescription>
                {CREATE_MONTH_DIALOG.description}
              </DialogDescription>
            </DialogHeader>
            <CreateMonthForm
              idPrefix={
                compact
                  ? CREATE_MONTH_DIALOG.idPrefixCompact
                  : CREATE_MONTH_DIALOG.idPrefixFull
              }
              onSuccess={handleCreateMonthSuccess}
            />
          </DialogContent>
        </Dialog>
        {fortnightError && (
          <p className="col-span-2 text-xs text-destructive">
            {fortnightError}
          </p>
        )}
        {fortnight && (
          <>
            <DashboardQuickExpenseDialog
              open={expenseDialogOpen}
              onOpenChange={setExpenseDialogOpen}
              onSubmit={handleQuickExpenseSubmit}
              fortnight={fortnight}
            />
            <DashboardQuickIncomeDialog
              open={incomeDialogOpen}
              onOpenChange={setIncomeDialogOpen}
              fortnight={fortnight}
              onCreated={handleQuickIncomeCreated}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
