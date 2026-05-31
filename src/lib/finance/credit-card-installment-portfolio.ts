import type { CreditCardStatementPurchaseItem } from '@/types/catalog';

export type InstallmentPortfolioItem = {
  purchase: CreditCardStatementPurchaseItem;
  currentInstallment: number;
  totalInstallments: number;
  remainingInstallments: number;
  progressPct: number;
  remainingAmount: number;
  originalAmountEstimate: number;
};

export const buildInstallmentPortfolio = (
  purchases: CreditCardStatementPurchaseItem[],
): InstallmentPortfolioItem[] =>
  purchases
    .filter(
      (purchase) =>
        purchase.credit_installment_current != null &&
        purchase.credit_installment_total != null &&
        purchase.credit_installment_current < purchase.credit_installment_total,
    )
    .map((purchase) => {
      const current = purchase.credit_installment_current!;
      const total = purchase.credit_installment_total!;
      const remainingInstallments = total - current;
      const progressPct = Math.round((current / total) * 100);
      const originalAmountEstimate = purchase.amount * total;
      const remainingAmount = purchase.amount * remainingInstallments;

      return {
        purchase,
        currentInstallment: current,
        totalInstallments: total,
        remainingInstallments,
        progressPct,
        remainingAmount,
        originalAmountEstimate,
      };
    })
    .sort((a, b) =>
      b.purchase.payment_date.localeCompare(a.purchase.payment_date),
    );

export const sumInstallmentExposure = (items: InstallmentPortfolioItem[]) =>
  items.reduce((sum, item) => sum + item.remainingAmount, 0);
