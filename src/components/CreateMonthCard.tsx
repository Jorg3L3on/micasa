'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { CalendarPlus, ExternalLink, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { createMonthFortnights, getCreatedMonths } from '@/lib/api';
import { formatMonth } from '@/lib/utils';

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

export default function CreateMonthCard() {
  const [createdMonths, setCreatedMonths] = useState<Array<{ year: number; month: number }>>([]);
  const [loadingMonths, setLoadingMonths] = useState(true);
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [lastCreated, setLastCreated] = useState<{ year: number; month: number } | null>(null);

  const availableOptions = useMemo(() => {
    const createdSet = new Set(
      createdMonths.map((m) => `${m.year}-${m.month}`),
    );
    const options: { value: string; label: string; year: number; month: number }[] = [];
    for (let m = currentMonth + 1; m <= 12; m++) {
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
        const list = await getCreatedMonths();
        setCreatedMonths(list);
      } catch {
        setCreatedMonths([]);
      } finally {
        setLoadingMonths(false);
      }
    };
    fetchCreated();
  }, [lastCreated]);

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
      const result = await createMonthFortnights(y, m);
      setLastCreated({ year: y, month: m });
      setCreatedMonths((prev) => [...prev, { year: y, month: m }]);
      setSelectedKey('');

      const totalExp = result.expensesCreated?.total ?? 0;
      const totalInc = result.incomeCreated?.total ?? 0;
      const parts: string[] = [];
      if (totalExp > 0) {
        const first = result.expensesCreated?.firstFortnight.count ?? 0;
        const second = result.expensesCreated?.secondFortnight.count ?? 0;
        parts.push(`${totalExp} gasto(s) desde plantillas (${first}+${second} quincenas)`);
      }
      if (totalInc > 0) {
        parts.push(`${totalInc} ingreso(s) desde catálogo`);
      }
      if (parts.length > 0) {
        toast.success(`Mes creado. ${parts.join(', ')}`);
      } else {
        toast.success('Mes creado: las dos quincenas fueron creadas');
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error al crear las quincenas del mes';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const monthPadded = lastCreated
    ? String(lastCreated.month).padStart(2, '0')
    : '';

  const emptyState =
    !loadingMonths &&
    availableOptions.length === 0 &&
    currentMonth < 12;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <CalendarPlus className="h-5 w-5 text-primary" aria-hidden />
          Crear mes (dos quincenas)
        </CardTitle>
        <CardDescription>
          Crea la primera y segunda quincena para un mes futuro del año {currentYear}. Solo se listan meses posteriores al actual que aún no tienen quincenas.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="create-month-select" className="text-sm font-medium">
              Mes a crear
            </Label>
            <Select
              value={selectedKey}
              onValueChange={setSelectedKey}
              disabled={submitting || loadingMonths}
              required
            >
              <SelectTrigger
                id="create-month-select"
                aria-label="Selecciona mes a crear"
                className="w-full sm:max-w-xs"
              >
                <SelectValue
                  placeholder={
                    loadingMonths
                      ? 'Cargando...'
                      : availableOptions.length === 0
                        ? emptyState
                          ? `No hay más meses futuros en ${currentYear}`
                          : 'Selecciona un mes'
                        : 'Selecciona un mes'
                  }
                />
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
              disabled={submitting || loadingMonths || availableOptions.length === 0 || !selectedKey}
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
                  href={`/monthly/${lastCreated.year}/${monthPadded}`}
                  aria-label={`Ver mes ${formatMonth(lastCreated.month)} ${lastCreated.year}`}
                >
                  <ExternalLink className="mr-2 h-4 w-4" aria-hidden />
                  Ver mes
                </Link>
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
