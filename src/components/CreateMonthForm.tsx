'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useFinanceContext } from '@/context/finance-context';
import { createMonthFortnights, getCreatedMonths } from '@/lib/api';
import { formatMonth } from '@/lib/utils';

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

type CreateMonthFormProps = {
  onSuccess?: () => void;
  idPrefix?: string;
};

export default function CreateMonthForm({
  onSuccess,
  idPrefix = 'create-month',
}: CreateMonthFormProps) {
  const { context } = useFinanceContext();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const [createdMonths, setCreatedMonths] = useState<
    Array<{ year: number; month: number }>
  >([]);
  const [loadingMonths, setLoadingMonths] = useState(true);
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [lastCreated, setLastCreated] = useState<{
    year: number;
    month: number;
  } | null>(null);

  const availableOptions = useMemo(() => {
    const createdSet = new Set(
      createdMonths.map((m) => `${m.year}-${m.month}`),
    );
    const options: {
      value: string;
      label: string;
      year: number;
      month: number;
    }[] = [];
    for (let m = currentMonth; m <= 12; m++) {
      const key = `${currentYear}-${m}`;
      if (!createdSet.has(key)) {
        options.push({
          value: key,
          label: `${formatMonth(m)} ${currentYear}`,
          year: currentYear,
          month: m,
        });
      }
    }
    options.sort((a, b) => a.month - b.month);
    return options;
  }, [createdMonths]);

  useEffect(() => {
    const fetchCreated = async () => {
      try {
        setLoadingMonths(true);
        const list = await getCreatedMonths(context);
        setCreatedMonths(list);
      } catch {
        setCreatedMonths([]);
      } finally {
        setLoadingMonths(false);
      }
    };
    fetchCreated();
  }, [lastCreated, context]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKey) {
      toast.error('Selecciona un mes y año');
      return;
    }
    const [y, m] = selectedKey.split('-').map(Number);
    if (Number.isNaN(y) || Number.isNaN(m) || m < 1 || m > 12) {
      toast.error('Selecciona un mes válido');
      return;
    }
    try {
      setSubmitting(true);
      setLastCreated(null);
      const result = await createMonthFortnights(y, m, context);
      setLastCreated({ year: y, month: m });
      setCreatedMonths((prev) => [...prev, { year: y, month: m }]);
      setSelectedKey('');

      const totalExp = result.expensesCreated?.total ?? 0;
      const totalInc = result.incomeCreated?.total ?? 0;
      const parts: string[] = [];
      if (totalExp > 0) {
        const first = result.expensesCreated?.firstFortnight.count ?? 0;
        const second = result.expensesCreated?.secondFortnight.count ?? 0;
        parts.push(
          `${totalExp} gasto(s) desde plantillas (${first}+${second} quincenas)`,
        );
      }
      if (totalInc > 0) {
        parts.push(`${totalInc} ingreso(s) desde catálogo`);
      }
      if (parts.length > 0) {
        toast.success(`Mes creado. ${parts.join(', ')}`);
      } else {
        toast.success('Mes creado: las dos quincenas fueron creadas');
      }
      onSuccess?.();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Error al crear las quincenas del mes';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const monthPadded = lastCreated
    ? String(lastCreated.month).padStart(2, '0')
    : '';

  const selectId = `${idPrefix}-select`;

  const getSelectPlaceholder = (): string => {
    if (loadingMonths) return 'Cargando...';
    if (availableOptions.length === 0) {
      return `No hay meses por crear en ${currentYear}`;
    }
    return 'Selecciona un mes';
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={selectId} className="text-sm font-medium">
          Mes a crear
        </Label>
        <Select
          value={selectedKey}
          onValueChange={setSelectedKey}
          disabled={submitting || loadingMonths}
          required
        >
          <SelectTrigger
            id={selectId}
            aria-label="Selecciona mes a crear"
            className="w-full sm:max-w-xs"
          >
            <SelectValue placeholder={getSelectPlaceholder()} />
          </SelectTrigger>
          <SelectContent>
            {availableOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="submit"
          disabled={
            submitting ||
            loadingMonths ||
            availableOptions.length === 0 ||
            !selectedKey
          }
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              Creando...
            </>
          ) : (
            'Crear mes (dos quincenas)'
          )}
        </Button>
        {lastCreated && (
          <Button variant="outline" size="sm" asChild>
            <Link
              href={`/monthly/${lastCreated.year}/${monthPadded}${queryString ? `?${queryString}` : ''}`}
              aria-label={`Ver mes ${formatMonth(lastCreated.month)} ${
                lastCreated.year
              }`}
            >
              <ExternalLink className="mr-2 h-4 w-4" aria-hidden />
              Ver mes
            </Link>
          </Button>
        )}
      </div>
    </form>
  );
}
