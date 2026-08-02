/** Attention signals: highest credit usage + soonest statement due. */

export type WalletAttentionSource = {
  id: number;
  name: string;
  type: string;
  amount: number;
  credit_limit?: number | null;
  temporary_credit_limit?: number | null;
  provider_icon_key?: string | null;
  active?: boolean;
};

export type DuePaymentAttentionSource = {
  walletId: number;
  walletName: string;
  nextDuePayment: number;
  statementDueDate: string;
};

export type WalletAttentionRole = 'usage' | 'payment';

export type WalletAttentionCard = {
  walletId: number;
  name: string;
  type: string;
  providerIconKey: string | null;
  roles: WalletAttentionRole[];
  /** Present when roles includes usage */
  usagePercent?: number;
  debtAmount?: number;
  creditLimit?: number | null;
  /** Present when roles includes payment */
  nextDuePayment?: number;
  statementDueDate?: string;
};

const CREDIT_TYPES = new Set(['CREDIT_CARD', 'DEPARTMENT_STORE_CARD']);

export const getEffectiveCreditLimit = ({
  credit_limit,
  temporary_credit_limit,
}: {
  credit_limit?: number | null;
  temporary_credit_limit?: number | null;
}): number => {
  if (credit_limit == null && temporary_credit_limit == null) return 0;
  if (credit_limit == null) return temporary_credit_limit ?? 0;
  if (temporary_credit_limit == null) return credit_limit;
  return Math.max(credit_limit, temporary_credit_limit);
};

const usagePercentFor = (wallet: WalletAttentionSource): number | null => {
  const amount = Math.max(0, Number(wallet.amount) || 0);
  const limit = getEffectiveCreditLimit(wallet);
  if (limit <= 0 && amount <= 0) return null;
  if (limit <= 0) return 100;
  return Math.min((amount / limit) * 100, 100);
};

/** Highest % used among credit/store cards; skip slot when every candidate is 0%. */
export const pickHighestUsageWallet = (
  wallets: WalletAttentionSource[],
): WalletAttentionSource | null => {
  const candidates = wallets
    .filter((w) => CREDIT_TYPES.has(w.type) && w.active !== false)
    .map((wallet) => {
      const usagePercent = usagePercentFor(wallet);
      return usagePercent == null ? null : { wallet, usagePercent };
    })
    .filter((row): row is { wallet: WalletAttentionSource; usagePercent: number } =>
      row != null,
    );

  if (candidates.length === 0) return null;
  if (candidates.every((c) => c.usagePercent === 0)) return null;

  candidates.sort((a, b) => {
    const pctDiff = b.usagePercent - a.usagePercent;
    if (pctDiff !== 0) return pctDiff;
    return Number(b.wallet.amount) - Number(a.wallet.amount);
  });

  return candidates[0]?.wallet ?? null;
};

/** Soonest statement due among items with nextDuePayment > 0; amount breaks date ties. */
export const pickNextDuePayment = (
  items: DuePaymentAttentionSource[],
): DuePaymentAttentionSource | null => {
  const due = items.filter((item) => item.nextDuePayment > 0);
  if (due.length === 0) return null;

  due.sort((a, b) => {
    const dateDiff = a.statementDueDate.localeCompare(b.statementDueDate);
    if (dateDiff !== 0) return dateDiff;
    return b.nextDuePayment - a.nextDuePayment;
  });

  return due[0] ?? null;
};

export const buildWalletAttentionCards = ({
  wallets,
  duePayments,
}: {
  wallets: WalletAttentionSource[];
  duePayments: DuePaymentAttentionSource[];
}): WalletAttentionCard[] => {
  const usageWallet = pickHighestUsageWallet(wallets);
  const payment = pickNextDuePayment(duePayments);

  if (!usageWallet && !payment) return [];

  const byId = new Map(wallets.map((w) => [w.id, w]));

  if (
    usageWallet &&
    payment &&
    usageWallet.id === payment.walletId
  ) {
    const limit = getEffectiveCreditLimit(usageWallet);
    const amount = Number(usageWallet.amount) || 0;
    return [
      {
        walletId: usageWallet.id,
        name: usageWallet.name,
        type: usageWallet.type,
        providerIconKey: usageWallet.provider_icon_key ?? null,
        roles: ['usage', 'payment'],
        usagePercent: usagePercentFor(usageWallet) ?? 0,
        debtAmount: amount,
        creditLimit: limit > 0 ? limit : null,
        nextDuePayment: payment.nextDuePayment,
        statementDueDate: payment.statementDueDate,
      },
    ];
  }

  const cards: WalletAttentionCard[] = [];

  if (usageWallet) {
    const limit = getEffectiveCreditLimit(usageWallet);
    const amount = Number(usageWallet.amount) || 0;
    cards.push({
      walletId: usageWallet.id,
      name: usageWallet.name,
      type: usageWallet.type,
      providerIconKey: usageWallet.provider_icon_key ?? null,
      roles: ['usage'],
      usagePercent: usagePercentFor(usageWallet) ?? 0,
      debtAmount: amount,
      creditLimit: limit > 0 ? limit : null,
    });
  }

  if (payment) {
    const wallet = byId.get(payment.walletId);
    cards.push({
      walletId: payment.walletId,
      name: wallet?.name ?? payment.walletName,
      type: wallet?.type ?? 'CREDIT_CARD',
      providerIconKey: wallet?.provider_icon_key ?? null,
      roles: ['payment'],
      nextDuePayment: payment.nextDuePayment,
      statementDueDate: payment.statementDueDate,
      debtAmount: wallet != null ? Number(wallet.amount) || 0 : undefined,
    });
  }

  return cards;
};
