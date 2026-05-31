import type {
  CreditCardPaymentListItem,
  CreditCardStatementImportListItem,
  CreditCardStatementPurchaseItem,
} from '@/types/catalog';

export type CycleLedgerEntryKind = 'purchase' | 'payment' | 'import';

export type CycleLedgerEntry =
  | {
      kind: 'purchase';
      id: string;
      sortKey: string;
      dateKey: string;
      purchase: CreditCardStatementPurchaseItem;
    }
  | {
      kind: 'payment';
      id: string;
      sortKey: string;
      dateKey: string;
      payment: CreditCardPaymentListItem;
    }
  | {
      kind: 'import';
      id: string;
      sortKey: string;
      dateKey: string;
      importRecord: CreditCardStatementImportListItem;
    };

export type CycleLedgerFilter = 'all' | 'purchases' | 'payments' | 'msi' | 'imports';

export type BuildCreditCardCycleLedgerInput = {
  cycleStart: string;
  cycleEnd: string;
  statementEnd: string;
  cyclePurchases: CreditCardStatementPurchaseItem[];
  payments: CreditCardPaymentListItem[];
  imports: CreditCardStatementImportListItem[];
};

const isWithinCycle = (dateYmd: string, start: string, end: string) =>
  dateYmd >= start && dateYmd <= end;

const importAlignsWithCycle = (
  imp: CreditCardStatementImportListItem,
  statementEnd: string,
) => {
  if (!imp.period_end) return false;
  const periodEnd = imp.period_end.slice(0, 10);
  return periodEnd === statementEnd;
};

export const buildCreditCardCycleLedger = ({
  cycleStart,
  cycleEnd,
  statementEnd,
  cyclePurchases,
  payments,
  imports,
}: BuildCreditCardCycleLedgerInput): CycleLedgerEntry[] => {
  const entries: CycleLedgerEntry[] = [];

  for (const purchase of cyclePurchases) {
    entries.push({
      kind: 'purchase',
      id: `purchase-${purchase.id}`,
      sortKey: `${purchase.payment_date}T12:00:00.000Z-p${purchase.id}`,
      dateKey: purchase.payment_date,
      purchase,
    });
  }

  for (const payment of payments) {
    const paidAt = payment.paid_at.slice(0, 10);
    if (!isWithinCycle(paidAt, cycleStart, cycleEnd)) continue;
    entries.push({
      kind: 'payment',
      id: `payment-${payment.id}`,
      sortKey: `${paidAt}T12:00:00.000Z-pay${payment.id}`,
      dateKey: paidAt,
      payment,
    });
  }

  for (const importRecord of imports) {
    if (!importAlignsWithCycle(importRecord, statementEnd)) continue;
    const dateKey = importRecord.created_at.slice(0, 10);
    entries.push({
      kind: 'import',
      id: `import-${importRecord.id}`,
      sortKey: `${importRecord.created_at}-i${importRecord.id}`,
      dateKey,
      importRecord,
    });
  }

  return entries.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
};

export const filterCycleLedger = (
  entries: CycleLedgerEntry[],
  filter: CycleLedgerFilter,
): CycleLedgerEntry[] => {
  if (filter === 'all') return entries;
  if (filter === 'purchases') {
    return entries.filter((entry) => entry.kind === 'purchase');
  }
  if (filter === 'payments') {
    return entries.filter((entry) => entry.kind === 'payment');
  }
  if (filter === 'imports') {
    return entries.filter((entry) => entry.kind === 'import');
  }
  return entries.filter(
    (entry) =>
      entry.kind === 'purchase' &&
      entry.purchase.credit_installment_current != null &&
      entry.purchase.credit_installment_total != null,
  );
};

export const searchCycleLedger = (
  entries: CycleLedgerEntry[],
  query: string,
): CycleLedgerEntry[] => {
  const q = query.trim().toLowerCase();
  if (!q) return entries;

  return entries.filter((entry) => {
    if (entry.kind === 'purchase') {
      return (
        entry.purchase.description.toLowerCase().includes(q) ||
        entry.purchase.category.toLowerCase().includes(q)
      );
    }
    if (entry.kind === 'payment') {
      return (
        entry.payment.source_wallet_name.toLowerCase().includes(q) ||
        (entry.payment.note?.toLowerCase().includes(q) ?? false)
      );
    }
    return (
      (entry.importRecord.file_name?.toLowerCase().includes(q) ?? false) ||
      entry.importRecord.provider.toLowerCase().includes(q)
    );
  });
};

export const isInstallmentPurchase = (
  purchase: CreditCardStatementPurchaseItem,
) =>
  purchase.credit_installment_current != null &&
  purchase.credit_installment_total != null;
