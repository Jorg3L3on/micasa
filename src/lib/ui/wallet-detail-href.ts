import { isCreditOrStoreCardWalletType } from '@/domain/payment-method';

/** Credit and store cards have their own detail page. */
export const walletDetailHref = (
  wallet: { id: number; type: string },
  ownerQueryString: string,
): string =>
  isCreditOrStoreCardWalletType(wallet.type)
    ? `/credit-cards/${wallet.id}${ownerQueryString}`
    : `/wallets/${wallet.id}${ownerQueryString}`;
