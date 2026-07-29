'use client';

import { Button } from '@/components/ui/button';
import { BarChart3, EyeOff } from 'lucide-react';

type FortnightViewControlsProps = {
  summaryVisible: boolean;
  onSummaryVisibleChange: (visible: boolean) => void;
};

export const FortnightViewControls = ({
  summaryVisible,
  onSummaryVisibleChange,
}: FortnightViewControlsProps) => {
  const handleToggleSummary = () => {
    onSummaryVisibleChange(!summaryVisible);
  };

  return (
    <div
      className="flex justify-end"
      role="region"
      aria-label="Controles de vista de planificación"
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-9 shrink-0 gap-1.5 self-end rounded-lg px-3 text-xs font-semibold sm:self-center"
        onClick={handleToggleSummary}
        aria-pressed={summaryVisible}
        aria-label={
          summaryVisible
            ? 'Ocultar resumen de la quincena'
            : 'Mostrar resumen de la quincena'
        }
      >
        {summaryVisible ? (
          <>
            <EyeOff className="h-4 w-4 shrink-0" aria-hidden data-icon="inline-start" />
            Ocultar resumen
          </>
        ) : (
          <>
            <BarChart3 className="h-4 w-4 shrink-0" aria-hidden data-icon="inline-start" />
            Mostrar resumen
          </>
        )}
      </Button>
    </div>
  );
};
