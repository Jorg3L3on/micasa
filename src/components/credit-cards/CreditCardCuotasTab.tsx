'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, CreditCard, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CreditCardInstallmentPlansSection } from '@/components/credit-cards/CreditCardInstallmentPlansSection';
import { CreditCardPaymentsChart } from '@/components/credit-cards/CreditCardPaymentsChart';
import { CreditCardScheduledPaymentDialog } from '@/components/credit-cards/CreditCardScheduledPaymentDialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  deleteCreditCardScheduledPayment,
  listCreditCardInstallmentPlans,
  listCreditCardScheduledPayments,
} from '@/lib/api/credit-cards';
import {
  buildInstallmentPortfolio,
  sumInstallmentExposure,
} from '@/lib/finance/credit-card-installment-portfolio';
import type { FinanceContextType } from '@/types/finance-context';
import type {
  CreditCardInstallmentPlanItem,
  CreditCardPaymentListItem,
  CreditCardScheduledPaymentItem,
  CreditCardStatementPurchaseItem,
} from '@/types/catalog';
import { formatCurrency } from '@/lib/utils';

type CreditCardCuotasTabProps = {
  creditCardId: number;
  context: FinanceContextType;
  defaultDueDay?: number | null;
  purchases: CreditCardStatementPurchaseItem[];
  paymentHistory: CreditCardPaymentListItem[];
  statementEnd: string;
  ownerQueryString: string;
  onChanged?: () => void | Promise<void>;
  createPlanDialogOpen?: boolean;
  onCreatePlanDialogOpenChange?: (open: boolean) => void;
  cycleLoading?: boolean;
};

export const CreditCardCuotasTab = ({
  creditCardId,
  context,
  defaultDueDay,
  purchases,
  paymentHistory,
  statementEnd,
  ownerQueryString,
  onChanged,
  createPlanDialogOpen,
  onCreatePlanDialogOpenChange,
  cycleLoading = false,
}: CreditCardCuotasTabProps) => {
  const [plans, setPlans] = useState<CreditCardInstallmentPlanItem[]>([]);
  const [scheduledPayments, setScheduledPayments] = useState<
    CreditCardScheduledPaymentItem[]
  >([]);
  const [commitmentsReady, setCommitmentsReady] = useState(false);
  const [scheduledDialogOpen, setScheduledDialogOpen] = useState(false);
  const [editingScheduled, setEditingScheduled] =
    useState<CreditCardScheduledPaymentItem | null>(null);

  const msiExposure = useMemo(() => {
    const portfolio = buildInstallmentPortfolio(purchases);
    return sumInstallmentExposure(portfolio);
  }, [purchases]);

  const plansExposure = useMemo(
    () =>
      plans.reduce(
        (sum, item) =>
          sum + item.installmentAmount * item.remainingInstallments,
        0,
      ),
    [plans],
  );
  const planCount = plans.length;

  const loadPlansSummary = useCallback(async () => {
    if (context.id === 0) {
      setCommitmentsReady(true);
      return;
    }
    try {
      const [plansResponse, scheduledResponse] = await Promise.all([
        listCreditCardInstallmentPlans(creditCardId, context),
        listCreditCardScheduledPayments(creditCardId, context),
      ]);
      setPlans(plansResponse.items);
      setScheduledPayments(scheduledResponse.items);
    } catch {
      setPlans([]);
      setScheduledPayments([]);
    } finally {
      setCommitmentsReady(true);
    }
  }, [context, creditCardId]);

  useEffect(() => {
    void loadPlansSummary();
  }, [loadPlansSummary]);

  const handleChanged = async () => {
    await loadPlansSummary();
    await onChanged?.();
  };

  const handleOpenCreateScheduled = () => {
    setEditingScheduled(null);
    setScheduledDialogOpen(true);
  };

  const handleEditScheduled = (item: CreditCardScheduledPaymentItem) => {
    setEditingScheduled(item);
    setScheduledDialogOpen(true);
  };

  const handleDeleteScheduled = async (item: CreditCardScheduledPaymentItem) => {
    try {
      await deleteCreditCardScheduledPayment(creditCardId, item.id, context);
      toast.success('Cuota eliminada');
      await handleChanged();
    } catch {
      toast.error('No se pudo eliminar la cuota');
    }
  };

  const handleScheduledDialogOpenChange = (open: boolean) => {
    if (!open) setEditingScheduled(null);
    setScheduledDialogOpen(open);
  };

  const showSummary = msiExposure > 0 || plansExposure > 0;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 dark:bg-violet-500/15">
            <CreditCard
              className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400"
              aria-hidden
            />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold leading-none">
              Cuotas y pagos futuros
            </h3>
            <p className="mt-1 text-[10px] text-muted-foreground">
              MSI en tarjeta, planes manuales y calendario
            </p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="sm"
              className="h-8 shrink-0 rounded-xl"
              aria-label="Agregar cuota o plan"
            >
              <Plus data-icon="inline-start" className="h-3.5 w-3.5" aria-hidden />
              Agregar
              <ChevronDown className="ml-0.5 h-3.5 w-3.5 opacity-70" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem
              onClick={() => onCreatePlanDialogOpenChange?.(true)}
            >
              Nuevo plan a meses
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleOpenCreateScheduled}>
              Cuota futura programada
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {cycleLoading || !commitmentsReady ? (
        <Skeleton
          className="h-56 w-full rounded-2xl"
          aria-label="Cargando pagos y cuotas futuras"
        />
      ) : (
        <CreditCardPaymentsChart
          paymentHistory={paymentHistory}
          installmentActivePurchases={purchases}
          statementEnd={statementEnd}
          scheduledPayments={scheduledPayments}
          installmentPlans={plans}
          ownerQueryString={ownerQueryString}
          onEditScheduled={handleEditScheduled}
          onDeleteScheduled={handleDeleteScheduled}
        />
      )}

      {showSummary ? (
        <div
          className="grid grid-cols-2 gap-2 rounded-2xl border border-border/60 bg-card px-3 py-2.5 sm:gap-3 sm:px-4"
          role="group"
          aria-label="Exposición en cuotas"
        >
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              MSI en tarjeta
            </p>
            <p className="font-mono text-base font-bold tabular-nums sm:text-lg">
              {formatCurrency(msiExposure)}
            </p>
          </div>
          <div className="min-w-0 border-l border-border/50 pl-2 sm:pl-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              En planes
            </p>
            <p className="font-mono text-base font-bold tabular-nums sm:text-lg">
              {formatCurrency(plansExposure)}
            </p>
            {planCount > 0 ? (
              <p className="text-[10px] text-muted-foreground">
                {planCount} plan{planCount === 1 ? '' : 'es'}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <CreditCardInstallmentPlansSection
        creditCardId={creditCardId}
        context={context}
        defaultDueDay={defaultDueDay}
        onChanged={handleChanged}
        createDialogOpen={createPlanDialogOpen}
        onCreateDialogOpenChange={onCreatePlanDialogOpenChange}
        embedded
        hideWhenEmpty
      />

      <CreditCardScheduledPaymentDialog
        open={scheduledDialogOpen}
        onOpenChange={handleScheduledDialogOpenChange}
        creditCardId={creditCardId}
        context={context}
        editingItem={editingScheduled}
        onSuccess={handleChanged}
      />
    </div>
  );
};
