import { documentTitle } from '@/lib/document-title';
import BatchEntryPageContent from '@/components/transactions/BatchEntryPageContent';

export const metadata = documentTitle('Agregar movimientos', {
  description: 'Captura varios gastos e ingresos a la vez.',
});

export default function BatchEntryPage() {
  return <BatchEntryPageContent />;
}
