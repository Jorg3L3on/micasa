'use client';

import { ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { ResponsiveOverlay } from '@/components/overlay/responsive-overlay';

type QuickCaptureChooserProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChooseExpense: () => void;
  onChooseIncome: () => void;
};

export const QuickCaptureChooser = ({
  open,
  onOpenChange,
  onChooseExpense,
  onChooseIncome,
}: QuickCaptureChooserProps) => {
  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      title="Agregar"
      description="Elige si vas a registrar un gasto o un ingreso."
    >
      {() => (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-3 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            onClick={onChooseExpense}
            aria-label="Agregar gasto"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 ring-1 ring-violet-500/25">
              <ArrowDownCircle
                className="h-4 w-4 text-violet-600 dark:text-violet-400"
                aria-hidden
              />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">Gasto</span>
              <span className="block text-xs text-muted-foreground">
                Planifícalo o márcalo como pagado en una billetera.
              </span>
            </span>
          </button>
          <button
            type="button"
            className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-3 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            onClick={onChooseIncome}
            aria-label="Agregar ingreso"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/15 ring-1 ring-blue-500/25">
              <ArrowUpCircle
                className="h-4 w-4 text-blue-600 dark:text-blue-400"
                aria-hidden
              />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">Ingreso</span>
              <span className="block text-xs text-muted-foreground">
                Solo esta quincena. Eliges la billetera; el saldo no cambia.
              </span>
            </span>
          </button>
        </div>
      )}
    </ResponsiveOverlay>
  );
};
