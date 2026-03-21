'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { FinanceContextType } from '@/types/finance-context';
import type { CategoryOption } from '@/types/catalog';
import { clientFetchFromApi, createCreditCardPurchase } from '@/lib/api';

type FortnightCatalogItem = {
  id: number;
  name: string;
  year: number;
  month: number;
  period: 'FIRST' | 'SECOND';
  active: boolean;
};

const getTodayDateString = () => new Date().toISOString().split('T')[0];

const resolveDefaultFortnightId = (
  items: FortnightCatalogItem[],
): string => {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth() + 1;
  const d = today.getDate();
  const period: 'FIRST' | 'SECOND' = d <= 15 ? 'FIRST' : 'SECOND';
  const match = items.find(
    (f) => f.year === y && f.month === m && f.period === period && f.active,
  );
  if (match) return String(match.id);
  const firstOpen = items.find((f) => f.active);
  return firstOpen ? String(firstOpen.id) : '';
};

export type CreditCardQuickPurchaseDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creditCardId: number;
  context: FinanceContextType;
  onSuccess: () => void | Promise<void>;
};

const CreditCardQuickPurchaseDialog = ({
  open,
  onOpenChange,
  creditCardId,
  context,
  onSuccess,
}: CreditCardQuickPurchaseDialogProps) => {
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [fortnights, setFortnights] = useState<FortnightCatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fortnightId, setFortnightId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(getTodayDateString());

  const loadCatalog = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [cats, fts] = await Promise.all([
        clientFetchFromApi<CategoryOption[]>('/api/categories', undefined, context),
        clientFetchFromApi<FortnightCatalogItem[]>(
          '/api/fortnights',
          undefined,
          context,
        ),
      ]);
      setCategories(cats);
      setFortnights(fts);
      const defaultFt = resolveDefaultFortnightId(fts);
      setFortnightId(defaultFt);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error al cargar datos',
      );
    } finally {
      setLoading(false);
    }
  }, [context]);

  useEffect(() => {
    if (open) {
      setDescription('');
      setAmount('');
      setPaymentDate(getTodayDateString());
      setCategoryId('');
      setError(null);
      void loadCatalog();
    }
  }, [open, loadCatalog]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!fortnightId || !categoryId) {
      setError('Selecciona quincena y categoría');
      return;
    }
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      setError('El monto debe ser mayor a 0');
      return;
    }
    if (!description.trim()) {
      setError('La descripción es obligatoria');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await createCreditCardPurchase(
        creditCardId,
        {
          fortnight_id: Number(fortnightId),
          category_id: Number(categoryId),
          description: description.trim(),
          amount: numAmount,
          payment_date: paymentDate,
        },
        context,
      );
      toast.success('Compra registrada');
      onOpenChange(false);
      await onSuccess();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error al registrar la compra',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar compra</DialogTitle>
          <DialogDescription>
            Registra un gasto pagado con esta tarjeta. Se aplicará al saldo de
            la tarjeta y a la quincena elegida.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : (
            <>
              <div className="space-y-2">
                <span className="text-sm font-medium">Quincena</span>
                <Select value={fortnightId || undefined} onValueChange={setFortnightId}>
                  <SelectTrigger
                    className="w-full max-w-none"
                    aria-label="Quincena del gasto"
                  >
                    <SelectValue placeholder="Selecciona quincena" />
                  </SelectTrigger>
                  <SelectContent>
                    {fortnights.map((f) => (
                      <SelectItem key={f.id} value={String(f.id)}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <span className="text-sm font-medium">Categoría</span>
                <Select value={categoryId || undefined} onValueChange={setCategoryId}>
                  <SelectTrigger
                    className="w-full max-w-none"
                    aria-label="Categoría del gasto"
                  >
                    <SelectValue placeholder="Selecciona categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="qp-desc">
                  Descripción
                </label>
                <Input
                  id="qp-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  aria-label="Descripción de la compra"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="qp-amount">
                    Monto
                  </label>
                  <Input
                    id="qp-amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    aria-label="Monto de la compra"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="qp-date">
                    Fecha
                  </label>
                  <Input
                    id="qp-date"
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    aria-label="Fecha de la compra"
                  />
                </div>
              </div>
            </>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting || loading}>
              {submitting ? 'Guardando...' : 'Registrar compra'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreditCardQuickPurchaseDialog;
