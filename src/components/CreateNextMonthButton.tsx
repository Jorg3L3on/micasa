'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CalendarPlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createMonthFortnights } from '@/lib/api';

type CreateNextMonthButtonProps = {
  nextYear: number;
  nextMonth: number;
  nextMonthLabel: string;
  canCreate: boolean;
};

export default function CreateNextMonthButton({
  nextYear,
  nextMonth,
  nextMonthLabel,
  canCreate,
}: CreateNextMonthButtonProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!canCreate || submitting) return;
    try {
      setSubmitting(true);
      const result = await createMonthFortnights(nextYear, nextMonth);
      const totalExp = result.expensesCreated?.total ?? 0;
      const totalInc = result.incomeCreated?.total ?? 0;
      const parts: string[] = [];
      if (totalExp > 0) parts.push(`${totalExp} gasto(s)`);
      if (totalInc > 0) parts.push(`${totalInc} ingreso(s)`);
      if (parts.length > 0) {
        toast.success(`Mes ${nextMonthLabel} creado. ${parts.join(', ')}`);
      } else {
        toast.success(`Mes ${nextMonthLabel} creado`);
      }
      const monthPadded = String(nextMonth).padStart(2, '0');
      router.push(`/monthly/${nextYear}/${monthPadded}`);
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error al crear el mes';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!canCreate) return null;

  return (
    <Button
      type="button"
      variant="default"
      size="sm"
      onClick={handleCreate}
      disabled={submitting}
    >
      {submitting ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          Creando...
        </>
      ) : (
        <>
          <CalendarPlus className="mr-2 h-4 w-4" aria-hidden />
          Crear {nextMonthLabel}
        </>
      )}
    </Button>
  );
}
