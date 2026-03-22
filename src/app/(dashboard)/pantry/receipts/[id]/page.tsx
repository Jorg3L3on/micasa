'use client';

import { useParams } from 'next/navigation';
import { PantryReceiptDetailView } from '@/components/pantry/PantryReceiptDetailView';

export default function PantryReceiptDetailPage() {
  const params = useParams();
  const raw = params.id;
  const id = typeof raw === 'string' ? Number.parseInt(raw, 10) : NaN;

  if (!Number.isFinite(id) || id < 1) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <p className="text-sm text-muted-foreground">Identificador de recibo inválido.</p>
      </div>
    );
  }

  return <PantryReceiptDetailView receiptId={id} />;
}
