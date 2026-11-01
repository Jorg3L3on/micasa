'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { isCreditOrStoreCardWalletType } from '@/domain/payment-method';
import { deleteCreditCard } from '@/lib/api/credit-cards';
import type { ClientApiError } from '@/lib/api/client-fetch';
import { deleteWallet } from '@/lib/api/wallets';
import WalletDeleteDialog from '@/components/wallets/WalletDeleteDialog';
import type { FinanceContextType } from '@/types/finance-context';

type DeletableWallet = { id: number; name: string; type: string };

const IN_USE_MESSAGE =
  'Está en uso y no puede eliminarse. Desactívala desde Editar si ya no la usas.';

const isInUseError = (err: unknown): boolean => {
  const message = err instanceof Error ? err.message : '';
  return (
    (err as ClientApiError).status === 409 ||
    ['409', 'in use', 'Conflict', 'related', 'asociadas'].some((needle) =>
      message.includes(needle),
    )
  );
};

/**
 * Delete flow for a wallet or card detail page: `requestDelete` opens the
 * confirm dialog, `dialog` is rendered once by the page, and a successful
 * delete returns to the Billeteras list.
 */
export const useWalletDelete = (
  wallet: DeletableWallet | null,
  context: FinanceContextType,
): { requestDelete: () => void; dialog: ReactNode } => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestDelete = useCallback(() => {
    setError(null);
    setOpen(true);
  }, []);

  const handleConfirm = async () => {
    if (!wallet) return;
    const isCard = isCreditOrStoreCardWalletType(wallet.type);
    try {
      setError(null);
      if (isCard) await deleteCreditCard(wallet.id, context);
      else await deleteWallet(wallet.id, context);
      toast.success('Eliminada');
      setOpen(false);
      router.push('/wallets');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al eliminar';
      setError(
        isInUseError(err)
          ? message.includes('Desactívala')
            ? message
            : IN_USE_MESSAGE
          : message,
      );
    }
  };

  const isCard = wallet ? isCreditOrStoreCardWalletType(wallet.type) : false;
  const dialog = wallet ? (
    <WalletDeleteDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
      onConfirm={handleConfirm}
      title={isCard ? 'Eliminar tarjeta' : 'Eliminar billetera'}
      description={
        isCard
          ? '¿Estás seguro de querer eliminar esta tarjeta? Esta acción no puede deshacerse.'
          : '¿Estás seguro de querer eliminar esta billetera? Esta acción no puede deshacerse.'
      }
      itemName={wallet.name}
      error={error}
    />
  ) : null;

  return { requestDelete, dialog };
};
