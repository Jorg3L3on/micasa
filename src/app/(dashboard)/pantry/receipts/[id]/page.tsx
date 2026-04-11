'use client';

import { useParams } from 'next/navigation';
import { PantryLayoutShell } from '@/components/pantry/PantryLayoutShell';
import { PantryReceiptDetailView } from '@/components/pantry/PantryReceiptDetailView';

export default function PantryReceiptDetailPage() {
  const params = useParams();
  const raw = params.id;
  const id = typeof raw === 'string' ? Number.parseInt(raw, 10) : NaN;

  if (!Number.isFinite(id) || id < 1) {
    return (
      <PantryLayoutShell className="flex flex-col gap-5">
        <p className="text-sm text-muted-foreground">
          Identificador de recibo inválido.
        </p>
      </PantryLayoutShell>
    );
  }

  return <PantryReceiptDetailView receiptId={id} />;
}
