'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, CreditCard, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import type { FinanceContextType } from '@/types/finance-context';
import type { CreditCardInstallmentPlanItem } from '@/types/catalog';
import {
  deleteCreditCardInstallmentPlan,
  listCreditCardInstallmentPlans,
} from '@/lib/api/credit-cards';
import { CreditCardInstallmentPlanDialog } from '@/components/credit-cards/CreditCardInstallmentPlanDialog';
import { cn, formatCurrency } from '@/lib/utils';

type CreditCardInstallmentPlansSectionProps = {
  creditCardId: number;
  context: FinanceContextType;
  defaultDueDay?: number | null;
  onChanged?: () => void | Promise<void>;
  createDialogOpen?: boolean;
  onCreateDialogOpenChange?: (open: boolean) => void;
};

export const CreditCardInstallmentPlansSection = ({
  creditCardId,
  context,
  defaultDueDay,
  onChanged,
  createDialogOpen,
  onCreateDialogOpenChange,
}: CreditCardInstallmentPlansSectionProps) => {
  const [items, setItems] = useState<CreditCardInstallmentPlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [internalDialogOpen, setInternalDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] =
    useState<CreditCardInstallmentPlanItem | null>(null);
  const [deleteTarget, setDeleteTarget] =
    useState<CreditCardInstallmentPlanItem | null>(null);
  const dialogOpen = createDialogOpen ?? internalDialogOpen;
  const setDialogOpen = onCreateDialogOpenChange ?? setInternalDialogOpen;

  const loadItems = useCallback(async () => {
    if (context.id === 0) return;
    try {
      setLoading(true);
      const response = await listCreditCardInstallmentPlans(
        creditCardId,
        context,
      );
      setItems(response.items);
    } catch {
      toast.error('No se pudieron cargar los planes de cuotas');
    } finally {
      setLoading(false);
    }
  }, [context, creditCardId]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const totalExposure = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + item.installmentAmount * item.remainingInstallments,
        0,
      ),
    [items],
  );

  const handleOpenCreate = () => {
    setEditingPlan(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (item: CreditCardInstallmentPlanItem) => {
    setEditingPlan(item);
    setDialogOpen(true);
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (!open) {
      setEditingPlan(null);
    }
    setDialogOpen(open);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await deleteCreditCardInstallmentPlan(
        creditCardId,
        deleteTarget.id,
        context,
      );
      toast.success('Plan eliminado');
      setDeleteTarget(null);
      await loadItems();
      await onChanged?.();
    } catch {
      toast.error('No se pudo eliminar el plan');
    }
  };

  const handleSuccess = async () => {
    setEditingPlan(null);
    await loadItems();
    await onChanged?.();
  };

  return (
    <section
      className="space-y-3"
      role="region"
      aria-label="Planes de compra a meses"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 dark:bg-violet-500/15">
            <CreditCard
              className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400"
              aria-hidden
            />
          </span>
          <div>
            <h3 className="text-sm font-semibold leading-none">
              Planes a meses
            </h3>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Nombre, progreso y cuotas generadas automáticamente
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          className="h-8 shrink-0 rounded-xl"
          onClick={handleOpenCreate}
        >
          <Plus data-icon="inline-start" className="h-3.5 w-3.5" aria-hidden />
          Nuevo plan
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando planes…</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-card/50 px-4 py-6 text-center">
          <p className="text-sm font-medium">Sin planes activos</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Crea un plan con nombre y cuotas ya pagadas para ver el progreso sin
            duplicar la deuda de la tarjeta.
          </p>
          <Button
            type="button"
            size="sm"
            className="mt-4 rounded-xl"
            onClick={handleOpenCreate}
          >
            Crear plan de cuotas
          </Button>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-border/60 border-l-[3px] border-l-violet-500/50 bg-card px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Exposición en planes
            </p>
            <p className="font-mono text-2xl font-bold tabular-nums tracking-tight">
              {formatCurrency(totalExposure)}
            </p>
            <p className="text-xs text-muted-foreground">
              {items.length} plan{items.length === 1 ? '' : 'es'} activo
              {items.length === 1 ? '' : 's'}
            </p>
          </div>

          <ul className="space-y-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="rounded-2xl border border-border/60 border-l-[3px] border-l-violet-500/50 bg-card px-4 py-3"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.currentInstallment} de {item.totalInstallments} ·
                      termina {item.endMonthLabel}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label={`Editar plan ${item.name}`}
                      onClick={() => handleOpenEdit(item)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={cn(
                        'h-8 w-8 text-destructive hover:text-destructive',
                      )}
                      aria-label={`Eliminar plan ${item.name}`}
                      onClick={() => setDeleteTarget(item)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="mb-2 flex items-end justify-between gap-2">
                  <div>
                    <p className="font-mono text-lg font-bold tabular-nums">
                      {formatCurrency(item.installmentAmount)}
                      <span className="text-xs font-normal text-muted-foreground">
                        {' '}
                        / mes
                      </span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground">Restante</p>
                    <p className="font-mono text-sm font-bold tabular-nums text-amber-600 dark:text-amber-400">
                      {formatCurrency(
                        item.installmentAmount * item.remainingInstallments,
                      )}
                    </p>
                  </div>
                </div>

                <div className="mb-2 flex h-1.5 w-full overflow-hidden rounded-full bg-muted/50">
                  <div
                    className="h-full rounded-full bg-violet-500 dark:bg-violet-400"
                    style={{
                      width: `${Math.max(item.progressPct, 2)}%`,
                    }}
                  />
                </div>

                <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <CalendarClock
                    className="h-3 w-3 shrink-0"
                    aria-hidden
                    data-icon="inline-start"
                  />
                  {item.remainingInstallments} cuota
                  {item.remainingInstallments === 1 ? '' : 's'} pendiente
                  {item.remainingInstallments === 1 ? '' : 's'}
                  {item.nextDueDate
                    ? ` · próxima ${item.nextDueDate.slice(8, 10)}/${item.nextDueDate.slice(5, 7)}`
                    : ''}
                  {item.alreadyInCardBalance ? ' · en saldo' : ''}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}

      <CreditCardInstallmentPlanDialog
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        creditCardId={creditCardId}
        context={context}
        defaultDueDay={defaultDueDay}
        plan={editingPlan}
        onSuccess={handleSuccess}
      />

      <ConfirmDeleteDialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="Eliminar plan de cuotas"
        description="Se eliminará el plan y sus cuotas futuras. Las cuotas ya pagadas no se revierten en el saldo de la tarjeta."
        itemName={deleteTarget?.name}
      />
    </section>
  );
};
