/**
 * Generic statement import dispatcher.
 * Routes to the correct provider parser, then runs shared import logic.
 * For MERCADO_PAGO, delegates to the existing service unchanged.
 */

import type { Prisma } from '@/generated/prisma/client';
import { PaymentMethodType, StatementImportProvider } from '@/generated/prisma/client';
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
import {
  extractCaDepartamentalStatementText,
  parseCaDepartamentalStatementText,
} from '@/lib/server/credit-card-statement/parse-ca-departamental-statement';
import {
  extractCaEfectivoStatementText,
  parseCaEfectivoStatementText,
} from '@/lib/server/credit-card-statement/parse-ca-efectivo-statement';

const creditCardWalletTypes: PaymentMethodType[] = [
  PaymentMethodType.CREDIT_CARD,
  PaymentMethodType.DEPARTMENT_STORE_CARD,
];

type ParsedMovement = {
  description: string;
  amount: number;
  paymentDate: Date;
  installmentCurrent?: number;
  installmentTotal?: number;
};

type ParsedStatement = {
  accountNumber: string | null;
  statementIssueDate: Date | null;
  paymentDueDate: Date | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  totalDue: number | null;
  minimumPayment: number | null;
  /** When set, the wallet amount is synced to this value after import (C&A Efectivo). */
  currentBalance: number | null;
  movements: ParsedMovement[];
  warnings: string[];
};

export type StatementImportResult = {
  importId: number;
  expensesCreated: number;
  duplicatesSkipped: number;
  linesSkipped: number;
  warnings: string[];
};

type ImportInput = {
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
};

const categoryOwnerWhere = (
  ownerType: 'user' | 'house',
  ownerId: number,
): Prisma.CategoryWhereInput =>
  ownerType === 'user'
    ? { user_id: ownerId, house_id: null }
    : { user_id: null, house_id: ownerId };

const toDateString = (d: Date): string => {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const startEndUtcDay = (d: Date): { start: Date; end: Date } => ({
  start: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0)),
  end: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999)),
});

async function resolveCategory(
  ownerType: 'user' | 'house',
  ownerId: number,
  preferredCategoryId: number | null,
  providerLabel: string,
): Promise<number> {
  if (preferredCategoryId != null) {
    const found = await prisma.category.findFirst({
      where: { id: preferredCategoryId, ...categoryOwnerWhere(ownerType, ownerId) },
    });
    if (found) return found.id;
  }

  const tarjeta = await prisma.category.findFirst({
    where: {
      ...categoryOwnerWhere(ownerType, ownerId),
      name: { equals: 'Tarjeta de crédito', mode: 'insensitive' },
    },
    orderBy: { id: 'asc' },
  });
  if (tarjeta) return tarjeta.id;

  const anyCat = await prisma.category.findFirst({
    where: categoryOwnerWhere(ownerType, ownerId),
    orderBy: { id: 'asc' },
  });
  if (anyCat) return anyCat.id;

  const created = await prisma.category.create({
    data: {
      name: `Importación (${providerLabel})`,
      ...(ownerType === 'user'
        ? { user_id: ownerId, house_id: null }
        : { user_id: null, house_id: ownerId }),
    },
  });
  return created.id;
}

async function runImport(
  parsed: ParsedStatement,
  provider: StatementImportProvider,
  providerLabel: string,
  input: ImportInput,
): Promise<StatementImportResult> {
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

  const warnings = [...parsed.warnings];

  if (parsed.movements.length === 0) {
    const msg = 'No se encontraron compras importables en el PDF.';
    warnings.push(msg);
    const err = new Error(msg) as Error & { code?: string };
    err.code = 'NO_MOVEMENTS';
    throw err;
  }

  const categoryId = await resolveCategory(ownerType, ownerId, preferredCategoryId, providerLabel);

  const wallet = await prisma.wallet.findFirst({
    where: {
      id: creditCardWalletId,
      ...ownerFilter,
      type: { in: creditCardWalletTypes },
    },
    select: { id: true, type: true, amount: true, credit_limit: true, user_id: true, house_id: true },
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
        provider,
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
        payment_due_date: parsed.paymentDueDate,
        total_due: parsed.totalDue,
        minimum_payment: parsed.minimumPayment,
        parse_warnings: [],
      },
    });

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

      const paymentDateStr = toDateString(mov.paymentDate);
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
        select: { type: true, amount: true, credit_limit: true },
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
          payment_date: new Date(`${paymentDateStr}T12:00:00.000Z`),
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

  // Sync wallet balance to the authoritative Saldo Total from the statement (C&A Efectivo).
  if (parsed.currentBalance != null) {
    await prisma.wallet.update({
      where: { id: creditCardWalletId },
      data: { amount: parsed.currentBalance },
    });
  }

  const finalWarnings = [
    ...warnings,
    `Resumen: ${expensesCreated} gasto(s) creado(s), ${duplicatesSkipped} duplicado(s) omitido(s), ${linesSkipped} línea(s) omitida(s).`,
  ];

  await prisma.creditCardStatementImport.update({
    where: { id: importRow.id },
    data: { parse_warnings: finalWarnings },
  });

  return { importId: importRow.id, expensesCreated, duplicatesSkipped, linesSkipped, warnings: finalWarnings };
}

const PROVIDER_LABELS: Record<StatementImportProvider, string> = {
  MERCADO_PAGO: 'Mercado Pago',
  CA_DEPARTAMENTAL: 'C&A Departamental',
  CA_EFECTIVO: 'C&A Efectivo',
};

export async function importStatementPdf(
  provider: StatementImportProvider,
  input: ImportInput,
): Promise<StatementImportResult> {
  let parsed: ParsedStatement;

  switch (provider) {
    case StatementImportProvider.MERCADO_PAGO: {
      const text = await extractMercadoPagoStatementText(input.buffer);
      const r = parseMercadoPagoStatementText(text);
      parsed = {
        accountNumber: r.accountNumber,
        statementIssueDate: r.statementIssueDate,
        paymentDueDate: null,
        periodStart: r.periodStart,
        periodEnd: r.periodEnd,
        totalDue: r.totalDue,
        minimumPayment: null,
        currentBalance: null,
        movements: r.movements.map((m) => ({
          description: m.description,
          amount: m.amount,
          paymentDate: m.paymentDate,
          installmentCurrent: m.installmentCurrent,
          installmentTotal: m.installmentTotal,
        })),
        warnings: r.warnings,
      };
      break;
    }
    case StatementImportProvider.CA_DEPARTAMENTAL: {
      const text = await extractCaDepartamentalStatementText(input.buffer);
      const r = parseCaDepartamentalStatementText(text);
      parsed = {
        accountNumber: r.accountNumber,
        statementIssueDate: r.statementIssueDate,
        paymentDueDate: r.paymentDueDate,
        periodStart: r.periodStart,
        periodEnd: r.periodEnd,
        totalDue: r.totalDue,
        minimumPayment: r.minimumPayment,
        currentBalance: r.currentBalance,
        movements: r.movements.map((m) => ({
          description: m.description,
          amount: m.amount,
          paymentDate: m.paymentDate,
          installmentCurrent: m.installmentCurrent,
          installmentTotal: m.installmentTotal,
        })),
        warnings: r.warnings,
      };
      break;
    }
    case StatementImportProvider.CA_EFECTIVO: {
      const text = await extractCaEfectivoStatementText(input.buffer);
      const r = parseCaEfectivoStatementText(text);
      parsed = {
        accountNumber: r.accountNumber,
        statementIssueDate: r.statementIssueDate,
        paymentDueDate: r.paymentDueDate,
        periodStart: r.periodStart,
        periodEnd: r.periodEnd,
        totalDue: r.totalDue,
        minimumPayment: r.minimumPayment,
        currentBalance: r.currentBalance,
        movements: r.movements.map((m) => ({
          description: m.description,
          amount: m.amount,
          paymentDate: m.paymentDate,
          installmentCurrent: m.installmentCurrent,
          installmentTotal: m.installmentTotal,
        })),
        warnings: r.warnings,
      };
      break;
    }
    default: {
      const err = new Error(`Proveedor no soportado: ${String(provider)}`) as Error & { code?: string };
      err.code = 'UNSUPPORTED_PROVIDER';
      throw err;
    }
  }

  return runImport(parsed, provider, PROVIDER_LABELS[provider], input);
}
