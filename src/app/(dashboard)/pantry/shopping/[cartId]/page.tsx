import { notFound } from 'next/navigation';
import PantryShoppingCartDetailView from '@/components/pantry/PantryShoppingCartDetailView';

type PageProps = { params: Promise<{ cartId: string }> };

export default async function PantryShoppingCartDetailPage({
  params,
}: PageProps) {
  const { cartId: raw } = await params;
  const cartId = Number.parseInt(raw, 10);
  if (!Number.isFinite(cartId) || cartId <= 0) {
    notFound();
  }
  return <PantryShoppingCartDetailView cartId={cartId} />;
}
