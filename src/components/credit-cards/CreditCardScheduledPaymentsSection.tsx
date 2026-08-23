'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { FinanceContextType } from '@/types/finance-context';
import type { CreditCardScheduledPaymentItem } from '@/types/catalog';
import {
  deleteCreditCardScheduledPayment,
  listCreditCardScheduledPayments,
} from '@/lib/api/credit-cards';
import { CreditCardScheduledPaymentDialog } from '@/components/credit-cards/CreditCardScheduledPaymentDialog';
import { cn, formatCurrency, formatDate } from '@/lib/utils';

type CreditCardScheduledPaymentsSectionProps = {
  creditCardId: number;
  context: FinanceContextType;
  onChanged?: () => void | Promise<void>;
};

export const CreditCardScheduledPaymentsSection = ({
  creditCardId,
  context,
  onChanged,
}: CreditCardScheduledPaymentsSectionProps) => {
  const [items, setItems] = useState<CreditCardScheduledPaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CreditCardScheduledPaymentItem | null>(
    null,
  );

  const loadItems = useCallback(async () => {
    if (context.id === 0) return;
    try {
      setLoading(true);
      const response = await listCreditCardScheduledPayments(
        creditCardId,
        context,
      );
      setItems(response.items);
    } catch {
      toast.error('No se pudo cargar el calendario de pagos');
    } finally {
      setLoading(false);
    }
  }, [context, creditCardId]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const scheduledItems = useMemo(
    () => items.filter((item) => item.status === 'SCHEDULED'),
    [items],
  );

  const paidItems = useMemo(
    () => items.filter((item) => item.status === 'PAID'),
    [items],
  );

  const handleOpenCreate = () => {
    setEditingItem(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (item: CreditCardScheduledPaymentItem) => {
    setEditingItem(item);
    setDialogOpen(true);
  };

  const handleDelete = async (item: CreditCardScheduledPaymentItem) => {
    try {
      await deleteCreditCardScheduledPayment(creditCardId, item.id, context);
      toast.success('Cuota eliminada');
      await loadItems();
      await onChanged?.();
    } catch {
      toast.error('No se pudo eliminar la cuota');
    }
  };

  const handleSuccess = async () => {
    await loadItems();
    await onChanged?.();
  };

  return (
    <section
      className="space-y-3"
      role="region"
      aria-label="Calendario de pagos futuros"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 dark:bg-blue-500/15">
            <CalendarClock
              className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400"
              aria-hidden
            />
          </span>
          <div>
            <h3 className="text-sm font-semibold leading-none">
              Calendario de pagos
            </h3>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Cuotas futuras sin registrar compra ni mover deuda
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
          Agregar cuota futura
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando calendario…</p>
      ) : scheduledItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-card/50 px-4 py-6 text-center">
          <p className="text-sm font-medium">Sin pagos programados</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Agrega MSI o mensualidades conocidas para ver el pago próximo y la
            planificación del mes.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4 rounded-xl"
            onClick={handleOpenCreate}
          >
            Agregar cuota futura
          </Button>
        </div>
      ) : (
        <ul className="space-y-2">
          {scheduledItems.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {item.label ?? 'Pago programado'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Vence {formatDate(item.dueDate)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold tabular-nums">
                  {formatCurrency(item.amount)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Editar cuota futura"
                  onClick={() => handleOpenEdit(item)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn('h-8 w-8 text-destructive hover:text-destructive')}
                  aria-label="Eliminar cuota futura"
                  onClick={() => void handleDelete(item)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {paidItems.length > 0 ? (
        <details className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
            {paidItems.length} cuota{paidItems.length === 1 ? '' : 's'} cubierta
            {paidItems.length === 1 ? '' : 's'}
          </summary>
          <ul className="mt-2 space-y-1">
            {paidItems.map((item) => (
              <li
                key={item.id}
                className="flex justify-between text-xs text-muted-foreground"
              >
                <span className="truncate">
                  {item.label ?? 'Pago programado'} · {formatDate(item.dueDate)}
                </span>
                <span className="font-mono tabular-nums">
                  {formatCurrency(item.amount)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <CreditCardScheduledPaymentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        creditCardId={creditCardId}
        context={context}
        editingItem={editingItem}
        onSuccess={handleSuccess}
      />
    </section>
  );
};
