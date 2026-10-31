'use client';

import { BatchEntryEditor } from '@/components/transactions/BatchEntryEditor';
import { ResponsiveOverlay } from '@/components/overlay/responsive-overlay';

type BatchEntrySheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: string;
  /** Called after rows are saved so the caller can refresh its data. */
  onSaved?: (created: number) => void;
};

/** Quick multi-row capture for phones: compact cards, wallet and date carried to the next row. */
export default function BatchEntrySheet({
  open,
  onOpenChange,
  defaultDate,
  onSaved,
}: BatchEntrySheetProps) {
  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      title="Agregar movimientos"
      description="Captura varios gastos e ingresos. Se guardan los válidos y los demás quedan para corregir."
    >
      <BatchEntryEditor
        layout="sheet"
        defaultDate={defaultDate}
        onSaved={onSaved}
        onAllSaved={() => onOpenChange(false)}
      />
    </ResponsiveOverlay>
  );
}
