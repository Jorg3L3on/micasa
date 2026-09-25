import type { PaymentMethodType, Prisma } from '@/generated/prisma/client';
import type { OwnerFilter } from '@/lib/server/get-owner-context';

export type PaymentCategoryKind = 'CREDIT_CARD' | 'DEPARTMENT_STORE_CARD' | 'LOAN';

type PaymentCategorySpec = {
  /** First match wins. Includes renamed household copies of the catalog name. */
  names: readonly string[];
  createName: string;
  icon: string;
  description: string;
};

const PAYMENT_CATEGORY_SPECS: Record<PaymentCategoryKind, PaymentCategorySpec> = {
  CREDIT_CARD: {
    names: ['Tarjetas de crédito', 'Tarjeta de crédito'],
    createName: 'Tarjeta de crédito',
    icon: 'CREDIT_CARD',
    description: 'Pagos de tarjeta de crédito',
  },
  DEPARTMENT_STORE_CARD: {
    names: ['Tarjetas departamentales', 'Tarjeta departamental'],
    createName: 'Tarjeta departamental',
    icon: 'CREDIT_CARD',
    description: 'Pagos de tarjeta departamental',
  },
  LOAN: {
    names: ['Préstamos', 'Pago de préstamos'],
    createName: 'Préstamos',
    icon: 'LANDMARK',
    description: 'Pagos de préstamos',
  },
};

const normalizeCategoryName = (name: string): string =>
  name.trim().toLocaleLowerCase('es-MX');

export const paymentCategoryKindForWallet = (
  type: PaymentMethodType | string,
): PaymentCategoryKind | null => {
  if (type === 'CREDIT_CARD') return 'CREDIT_CARD';
  if (type === 'DEPARTMENT_STORE_CARD') return 'DEPARTMENT_STORE_CARD';
  return null;
};

export const pickPaymentCategoryId = (
  categories: readonly { id: number; name: string }[],
  kind: PaymentCategoryKind,
): number | null => {
  const names = PAYMENT_CATEGORY_SPECS[kind].names;
  for (const name of names) {
    const wanted = normalizeCategoryName(name);
    const match = categories.find(
      (category) => normalizeCategoryName(category.name) === wanted,
    );
    if (match) return match.id;
  }
  return null;
};

export const resolvePaymentCategoryId = async (
  tx: Prisma.TransactionClient,
  ownerFilter: OwnerFilter,
  kind: PaymentCategoryKind,
): Promise<number> => {
  const spec = PAYMENT_CATEGORY_SPECS[kind];
  const rows = await tx.category.findMany({
    where: {
      ...ownerFilter,
      kind: 'EXPENSE',
      OR: spec.names.map((name) => ({
        name: { equals: name, mode: 'insensitive' },
      })),
    },
    select: { id: true, name: true },
  });
  const existingId = pickPaymentCategoryId(rows, kind);
  if (existingId != null) return existingId;

  const created = await tx.category.create({
    data: {
      ...ownerFilter,
      name: spec.createName,
      description: spec.description,
      icon: spec.icon,
      kind: 'EXPENSE',
    },
    select: { id: true },
  });
  return created.id;
};
