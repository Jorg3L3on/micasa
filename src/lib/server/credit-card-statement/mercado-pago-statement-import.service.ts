import { coerceToCalendarDayStart } from '@/lib/calendar-dates';
import type { Prisma } from '@/generated/prisma/client';
import { PaymentMethodType } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import {
  applyWalletAmountDelta,
  assertPaidChargeAllowedForWallet,
  getPaidExpenseWalletDelta,
  isCreditWalletType,
} from '@/lib/finance/wallet-accounting';
import { getFortnightPeriodForDay } from '@/lib/fortnight-calendar';
import { resolveOrCreateFortnight } from '@/lib/fortnights';
import type { OwnerFilter } from '@/lib/server/get-owner-context';
import {
  extractMercadoPagoStatementText,
  parseMercadoPagoStatementText,
} from '@/lib/server/credit-card-statement/parse-mercado-pago-statement';

const creditCardWalletTypes: PaymentMethodType[] = [
  PaymentMethodType.CREDIT_CARD,
  PaymentMethodType.DEPARTMENT_STORE_CARD,
];

const categoryOwnerWhere = (
  ownerType: 'user' | 'house',
  ownerId: number,
): Prisma.CategoryWhereInput =>
  ownerType === 'user'
    ? { user_id: ownerId, house_id: null }
    : { user_id: null, house_id: ownerId };

const toPaymentDateString = (d: Date): string => {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const startEndUtcDay = (d: Date): { start: Date; end: Date } => {
  const start = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0),
  );
  const end = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999),
  );
  return { start, end };
};

export async function resolveStatementImportCategoryId(
  ownerType: 'user' | 'house',
  ownerId: number,
  preferredCategoryId: number | null,
): Promise<number> {
  if (preferredCategoryId != null) {
    const found = await prisma.category.findFirst({
      where: {
        id: preferredCategoryId,
        ...categoryOwnerWhere(ownerType, ownerId),
      },
    });
    if (found) {
      return found.id;
    }
  }

  const tarjeta = await prisma.category.findFirst({
    where: {
      ...categoryOwnerWhere(ownerType, ownerId),
      name: { equals: 'Tarjeta de crédito', mode: 'insensitive' },
    },
    orderBy: { id: 'asc' },
  });
  if (tarjeta) {
    return tarjeta.id;
  }

  const anyCat = await prisma.category.findFirst({
    where: categoryOwnerWhere(ownerType, ownerId),
    orderBy: { id: 'asc' },
  });
  if (anyCat) {
    return anyCat.id;
  }

  const created = await prisma.category.create({
    data: {
      name: 'Importación (Mercado Pago)',
      ...(ownerType === 'user'
        ? { user_id: ownerId, house_id: null }
        : { user_id: null, house_id: ownerId }),
    },
  });
  return created.id;
}

export type MercadoPagoImportResult = {
  importId: number;
  expensesCreated: number;
  duplicatesSkipped: number;
  linesSkipped: number;
  warnings: string[];
};

export async function importMercadoPagoStatementPdf(input: {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  storeFile: boolean;
  creditCardWalletId: number;
  ownerType: 'user' | 'house';
  ownerId: number;
  ownerFilter: OwnerFilter;
  categoryId: number | null;
  skipDuplicates: boolean;
  createdByUserId: number;
}): Promise<MercadoPagoImportResult> {
  const {
    buffer,
    fileName,
    mimeType,
    storeFile,
    creditCardWalletId,
    ownerType,
    ownerId,
    ownerFilter,
    categoryId: preferredCategoryId,
    skipDuplicates,
    createdByUserId,
  } = input;

  const text = await extractMercadoPagoStatementText(buffer);
  const parsed = parseMercadoPagoStatementText(text);
  const warnings = [...parsed.warnings];

  if (parsed.movements.length === 0) {
    const msg = 'No se encontraron compras importables en el PDF.';
    warnings.push(msg);
    const err = new Error(msg) as Error & { code?: string };
    err.code = 'NO_MOVEMENTS';
    throw err;
  }

  const categoryId = await resolveStatementImportCategoryId(
    ownerType,
    ownerId,
    preferredCategoryId,
  );

  const wallet = await prisma.wallet.findFirst({
    where: {
      id: creditCardWalletId,
      ...ownerFilter,
      type: { in: creditCardWalletTypes },
    },
    select: {
      id: true,
      type: true,
      amount: true,
      credit_limit: true,
      temporary_credit_limit: true,
      user_id: true,
      house_id: true,
    },
  });

  if (!wallet) {
    const err = new Error('Tarjeta no encontrada') as Error & { code?: string };
    err.code = 'CARD_NOT_FOUND';
    throw err;
  }

  let expensesCreated = 0;
  let duplicatesSkipped = 0;
  let linesSkipped = 0;

  const importRow = await prisma.$transaction(async (tx) => {
    const createdImport = await tx.creditCardStatementImport.create({
      data: {
        provider: 'MERCADO_PAGO',
        wallet_id: creditCardWalletId,
        user_id: ownerFilter.user_id,
        house_id: ownerFilter.house_id,
        created_by_user_id: createdByUserId,
        file_name: storeFile ? fileName : null,
        file_mime: storeFile ? mimeType || null : null,
        file_data: storeFile ? new Uint8Array(buffer) : null,
        period_start: parsed.periodStart,
        period_end: parsed.periodEnd,
        account_number: parsed.accountNumber,
        statement_issue_date: parsed.statementIssueDate,
        total_due: parsed.totalDue,
        parse_warnings: [],
      },
    });

    const paymentDayStartByYmd = new Map<string, Date>();
    const paymentDayStart = (ymd: string) => {
      let cached = paymentDayStartByYmd.get(ymd);
      if (!cached) {
        cached = coerceToCalendarDayStart(ymd);
        paymentDayStartByYmd.set(ymd, cached);
      }
      return cached;
    };

    for (const mov of parsed.movements) {
      const period = getFortnightPeriodForDay(mov.paymentDate.getUTCDate());
      const fortnight = await resolveOrCreateFortnight({
        ownerType,
        ownerId,
        year: mov.paymentDate.getUTCFullYear(),
        month: mov.paymentDate.getUTCMonth() + 1,
        period,
        tx,
      });

      const paymentDateStr = toPaymentDateString(mov.paymentDate);
      const { start, end } = startEndUtcDay(mov.paymentDate);

      if (skipDuplicates) {
        const dup = await tx.expense.findFirst({
          where: {
            wallet_id: creditCardWalletId,
            amount: mov.amount,
            description: mov.description,
            payment_date: { gte: start, lte: end },
          },
        });
        if (dup) {
          duplicatesSkipped += 1;
          continue;
        }
      }

      const walletRow = await tx.wallet.findUnique({
        where: { id: creditCardWalletId },
        select: {
          type: true,
          amount: true,
          credit_limit: true,
          temporary_credit_limit: true,
        },
      });
      if (!walletRow || !isCreditWalletType(walletRow.type)) {
        linesSkipped += 1;
        continue;
      }

      assertPaidChargeAllowedForWallet(walletRow, mov.amount);

      await tx.expense.create({
        data: {
          fortnight_id: fortnight.id,
          wallet_id: creditCardWalletId,
          category_id: categoryId,
          description: mov.description,
          amount: mov.amount,
          is_paid: true,
          payment_date: paymentDayStart(paymentDateStr),
          statement_import_id: createdImport.id,
          credit_installment_current: mov.installmentCurrent ?? null,
          credit_installment_total: mov.installmentTotal ?? null,
          user_id: fortnight.user_id,
          house_id: fortnight.house_id,
        },
      });

      await applyWalletAmountDelta(
        tx,
        creditCardWalletId,
        getPaidExpenseWalletDelta(walletRow.type, mov.amount),
      );

      expensesCreated += 1;
    }

    return createdImport;
  });

  const finalWarnings = [
    ...warnings,
    `Resumen: ${expensesCreated} gasto(s) creado(s), ${duplicatesSkipped} duplicado(s) omitido(s), ${linesSkipped} línea(s) omitida(s).`,
  ];

  await prisma.creditCardStatementImport.update({
    where: { id: importRow.id },
    data: { parse_warnings: finalWarnings },
  });

  return {
    importId: importRow.id,
    expensesCreated,
    duplicatesSkipped,
    linesSkipped,
    warnings: finalWarnings,
  };
}
