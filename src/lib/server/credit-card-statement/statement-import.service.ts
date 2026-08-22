/**
 * Generic statement import dispatcher.
 * Routes to the correct provider parser, then runs shared import logic.
 * For MERCADO_PAGO, delegates to the existing service unchanged.
 */

import { coerceToCalendarDayStart } from '@/lib/calendar-dates';
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
import {
  extractDidiCardStatementText,
  parseDidiCardStatementText,
} from '@/lib/server/credit-card-statement/parse-didi-card-statement';
import {
  extractLiverpoolStatementText,
  parseLiverpoolStatementText,
} from '@/lib/server/credit-card-statement/parse-liverpool-statement';

const creditCardWalletTypes: PaymentMethodType[] = [
  PaymentMethodType.CREDIT_CARD,
  PaymentMethodType.DEPARTMENT_STORE_CARD,
];

type MovementKind = 'charge' | 'payment' | 'msi_installment';

type ParsedMovement = {
  description: string;
  amount: number;
  paymentDate: Date;
  installmentCurrent?: number;
  installmentTotal?: number;
  kind: MovementKind;
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
  /** DiDi Card: promotional temporary limit from the PDF (MXN). */
  temporaryCreditLimit?: number | null;
  movements: ParsedMovement[];
  warnings: string[];
};

export type StatementImportResult = {
  importId: number;
  expensesCreated: number;
  paymentsCreated: number;
  scheduledCreated: number;
  duplicatesSkipped: number;
  linesSkipped: number;
  warnings: string[];
};

export type StatementImportPreviewMovement = {
  kind: MovementKind;
  description: string;
  amount: number;
  payment_date: string;
  installment_current?: number;
  installment_total?: number;
};

export type StatementImportPreviewResult = {
  provider: StatementImportProvider;
  account_number: string | null;
  payment_due_date: string | null;
  total_due: number | null;
  minimum_payment: number | null;
  movements: StatementImportPreviewMovement[];
  warnings: string[];
};

export type StatementImportCommitOptions = {
  import_charges?: boolean;
  import_payments?: boolean;
  import_msi_schedule?: boolean;
  adjust_wallet_debt?: boolean;
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
  commitOptions?: StatementImportCommitOptions;
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

const PAYMENT_DESCRIPTION_RE =
  /PAGO|ABONO|GRACIAS POR SU PAGO|POR SU PAGO|DEVOLUCI|REEMBOLSO/i;

const inferMovementKind = (movement: {
  description: string;
  amount: number;
  installmentCurrent?: number;
  installmentTotal?: number;
  kind?: MovementKind;
}): MovementKind => {
  if (movement.kind) return movement.kind;
  if (PAYMENT_DESCRIPTION_RE.test(movement.description)) return 'payment';
  if (
    movement.installmentCurrent != null &&
    movement.installmentTotal != null &&
    movement.installmentCurrent < movement.installmentTotal
  ) {
    return 'msi_installment';
  }
  return 'charge';
};

const normalizeParsedMovements = (
  movements: Array<Omit<ParsedMovement, 'kind'> & { kind?: MovementKind }>,
): ParsedMovement[] =>
  movements.map((movement) => ({
    ...movement,
    amount: Math.abs(movement.amount),
    kind: inferMovementKind(movement),
  }));

const hasImportableStatementContent = (parsed: ParsedStatement) =>
  parsed.movements.length > 0 ||
  parsed.totalDue != null ||
  parsed.minimumPayment != null ||
  parsed.paymentDueDate != null;

const assertReadablePdfText = (text: string) => {
  if (text.replace(/\s/g, '').length < 40) {
    const err = new Error(
      'No se pudo leer el PDF (posiblemente es una imagen escaneada). Usa un PDF con texto seleccionable.',
    ) as Error & { code?: string };
    err.code = 'UNREADABLE_PDF';
    throw err;
  }
};

async function syncWalletTemporaryCreditFromDidiStatement(
  walletId: number,
  parsed: ParsedStatement,
  tx: Prisma.TransactionClient,
): Promise<string[]> {
  const messages: string[] = [];
  const temp = parsed.temporaryCreditLimit;
  const asOf = parsed.statementIssueDate;

  const wallet = await tx.wallet.findUnique({
    where: { id: walletId },
    select: { credit_limit: true },
  });
  const base = wallet?.credit_limit == null ? null : Number(wallet.credit_limit);

  const tempOk = temp != null && Number.isFinite(temp) && temp > 0;
  const raisesCeiling = base == null || (tempOk && temp > base);

  if (tempOk && raisesCeiling) {
    await tx.wallet.update({
      where: { id: walletId },
      data: {
        temporary_credit_limit: temp,
        temporary_credit_limit_as_of: asOf,
      },
    });
    messages.push(
      `Límite temporal DiDi (MXN ${temp.toFixed(2)}) guardado. MiCasa usa el mayor entre tu línea de crédito y este valor como tope.`,
    );
    return messages;
  }

  await tx.wallet.update({
    where: { id: walletId },
    data: {
      temporary_credit_limit: null,
      temporary_credit_limit_as_of: null,
    },
  });

  if (tempOk && base != null && temp <= base) {
    messages.push(
      'Este estado de cuenta no muestra límite temporal por encima de tu línea de crédito; se quitó el límite temporal guardado.',
    );
  }

  return messages;
}

async function resolveCategory(
  ownerType: 'user' | 'house',
  ownerId: number,
  preferredCategoryId: number | null,
  providerLabel: string,
): Promise<number> {
  if (preferredCategoryId != null) {
    const found = await prisma.category.findFirst({
      where: {
        id: preferredCategoryId,
        active: true,
        ...categoryOwnerWhere(ownerType, ownerId),
      },
    });
    if (found) return found.id;
  }

  const tarjeta = await prisma.category.findFirst({
    where: {
      ...categoryOwnerWhere(ownerType, ownerId),
      active: true,
      name: { equals: 'Tarjeta de crédito', mode: 'insensitive' },
    },
    orderBy: { id: 'asc' },
  });
  if (tarjeta) return tarjeta.id;

  const anyCat = await prisma.category.findFirst({
    where: { ...categoryOwnerWhere(ownerType, ownerId), active: true },
    orderBy: { id: 'asc' },
  });
  if (anyCat) return anyCat.id;

  const created = await prisma.category.create({
    data: {
      name: `Importación (${providerLabel})`,
      active: true,
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
  const commitOptions: Required<StatementImportCommitOptions> = {
    import_charges: input.commitOptions?.import_charges ?? true,
    import_payments: input.commitOptions?.import_payments ?? true,
    import_msi_schedule: input.commitOptions?.import_msi_schedule ?? true,
    adjust_wallet_debt: input.commitOptions?.adjust_wallet_debt ?? true,
  };

  if (!hasImportableStatementContent(parsed)) {
    const msg =
      'No se pudo leer el PDF (posiblemente es una imagen escaneada) o no contiene datos importables.';
    warnings.push(msg);
    const err = new Error(msg) as Error & {
      code?: string;
      parse_warnings?: string[];
      statement_import_provider?: StatementImportProvider;
    };
    err.code = 'UNREADABLE_PDF';
    err.parse_warnings = warnings;
    err.statement_import_provider = provider;
    throw err;
  }

  const categoryId = await resolveCategory(ownerType, ownerId, preferredCategoryId, providerLabel);

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
  let paymentsCreated = 0;
  let scheduledCreated = 0;
  let duplicatesSkipped = 0;
  const linesSkipped = 0;
  let diDiLimitMessages: string[] = [];
  let overLimitImportWarningAdded = false;

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

    if (provider === StatementImportProvider.DIDI_CARD) {
      diDiLimitMessages = await syncWalletTemporaryCreditFromDidiStatement(
        creditCardWalletId,
        parsed,
        tx,
      );
    }

    const walletSnapshot = provider === StatementImportProvider.DIDI_CARD
      ? await tx.wallet.findUnique({
          where: { id: creditCardWalletId },
          select: {
            type: true,
            amount: true,
            credit_limit: true,
            temporary_credit_limit: true,
          },
        })
      : {
          type: wallet.type,
          amount: wallet.amount,
          credit_limit: wallet.credit_limit,
          temporary_credit_limit: wallet.temporary_credit_limit,
        };

    if (!walletSnapshot || !isCreditWalletType(walletSnapshot.type)) {
      const err = new Error('Tarjeta no válida para importación') as Error & { code?: string };
      err.code = 'CARD_NOT_FOUND';
      throw err;
    }

    let runningWalletAmount = Number(walletSnapshot.amount);
    let walletDeltaAccumulated = 0;
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
      const kind = mov.kind;
      const shouldImport =
        (kind === 'charge' && commitOptions.import_charges) ||
        (kind === 'payment' && commitOptions.import_payments) ||
        (kind === 'msi_installment' && commitOptions.import_msi_schedule);

      if (!shouldImport) {
        continue;
      }

      const paymentDateStr = toDateString(mov.paymentDate);
      const { start, end } = startEndUtcDay(mov.paymentDate);

      if (kind === 'payment') {
        if (skipDuplicates) {
          const dup = await tx.creditCardPayment.findFirst({
            where: {
              credit_card_wallet_id: creditCardWalletId,
              amount: mov.amount,
              paid_at: { gte: start, lte: end },
              note: mov.description,
            },
          });
          if (dup) {
            duplicatesSkipped += 1;
            continue;
          }
        }

        await tx.creditCardPayment.create({
          data: {
            amount: mov.amount,
            paid_at: paymentDayStart(paymentDateStr),
            note: mov.description,
            credit_card_wallet_id: creditCardWalletId,
            source_wallet_id: null,
            adjusts_debt: commitOptions.adjust_wallet_debt,
            user_id: ownerFilter.user_id,
            house_id: ownerFilter.house_id,
          },
        });

        if (commitOptions.adjust_wallet_debt) {
          await applyWalletAmountDelta(tx, creditCardWalletId, -mov.amount);
        }

        paymentsCreated += 1;
        continue;
      }

      if (kind === 'msi_installment') {
        if (skipDuplicates) {
          const dup = await tx.creditCardScheduledPayment.findFirst({
            where: {
              credit_card_wallet_id: creditCardWalletId,
              amount: mov.amount,
              due_date: { gte: start, lte: end },
              label: mov.description,
            },
          });
          if (dup) {
            duplicatesSkipped += 1;
            continue;
          }
        }

        await tx.creditCardScheduledPayment.create({
          data: {
            credit_card_wallet_id: creditCardWalletId,
            due_date: paymentDayStart(paymentDateStr),
            amount: mov.amount,
            label: mov.description,
            user_id: ownerFilter.user_id,
            house_id: ownerFilter.house_id,
          },
        });
        scheduledCreated += 1;
        continue;
      }

      const period = getFortnightPeriodForDay(mov.paymentDate.getUTCDate());
      const fortnight = await resolveOrCreateFortnight({
        ownerType,
        ownerId,
        year: mov.paymentDate.getUTCFullYear(),
        month: mov.paymentDate.getUTCMonth() + 1,
        period,
        tx,
      });

      if (skipDuplicates) {
        const dup = await tx.expense.findFirst({
          where: {
            wallet_id: creditCardWalletId,
            amount: mov.amount,
            description: mov.description,
            payment_date: { gte: start, lte: end },
            /** Evita que dos filas idénticas del mismo PDF se salten entre sí. */
            NOT: { statement_import_id: createdImport.id },
          },
        });
        if (dup) {
          duplicatesSkipped += 1;
          continue;
        }
      }

      try {
        assertPaidChargeAllowedForWallet(
          {
            type: walletSnapshot.type,
            amount: runningWalletAmount,
            credit_limit: walletSnapshot.credit_limit,
            temporary_credit_limit: walletSnapshot.temporary_credit_limit,
          },
          mov.amount,
        );
      } catch (error) {
        if (
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === 'CREDIT_LIMIT_EXCEEDED'
        ) {
          if (!overLimitImportWarningAdded) {
            warnings.push(
              'Se detectaron compras que superan el límite registrado de la tarjeta durante la importación. Se importaron de todos modos porque el estado de cuenta es la fuente de verdad.',
            );
            overLimitImportWarningAdded = true;
          }
        } else {
          throw error;
        }
      }

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

      if (commitOptions.adjust_wallet_debt) {
        const delta = getPaidExpenseWalletDelta(walletSnapshot.type, mov.amount);
        walletDeltaAccumulated += delta;
        runningWalletAmount += delta;
      }

      expensesCreated += 1;
    }

    if (commitOptions.adjust_wallet_debt && walletDeltaAccumulated !== 0) {
      await applyWalletAmountDelta(tx, creditCardWalletId, walletDeltaAccumulated);
    }

    return createdImport;
  }, { timeout: 20_000, maxWait: 10_000 });

  // Sync wallet balance to the authoritative total from the statement (PDF).
  if (commitOptions.adjust_wallet_debt && parsed.currentBalance != null) {
    await prisma.wallet.update({
      where: { id: creditCardWalletId },
      data: { amount: parsed.currentBalance },
    });
    warnings.push(
      `Deuda actual de la tarjeta sincronizada con el total del estado de cuenta (${PROVIDER_LABELS[provider]}): MXN ${parsed.currentBalance.toFixed(2)}.`,
    );
  }

  const finalWarnings = [
    ...warnings,
    ...diDiLimitMessages,
    `Resumen: ${expensesCreated} gasto(s), ${paymentsCreated} pago(s), ${scheduledCreated} cuota(s) programada(s); ${duplicatesSkipped} duplicado(s) omitido(s), ${linesSkipped} línea(s) omitida(s).`,
  ];

  await prisma.creditCardStatementImport.update({
    where: { id: importRow.id },
    data: { parse_warnings: finalWarnings },
  });

  return {
    importId: importRow.id,
    expensesCreated,
    paymentsCreated,
    scheduledCreated,
    duplicatesSkipped,
    linesSkipped,
    warnings: finalWarnings,
  };
}

const PROVIDER_LABELS: Record<StatementImportProvider, string> = {
  MERCADO_PAGO: 'Mercado Pago',
  CA_DEPARTAMENTAL: 'C&A Departamental',
  CA_EFECTIVO: 'C&A Efectivo',
  DIDI_CARD: 'DiDi Card',
  LIVERPOOL: 'Liverpool',
};

export async function importStatementPdf(
  provider: StatementImportProvider,
  input: ImportInput,
): Promise<StatementImportResult> {
  const parsed = await parseStatementFromBuffer(provider, input.buffer);
  return runImport(parsed, provider, PROVIDER_LABELS[provider], input);
}

export async function previewStatementPdf(
  provider: StatementImportProvider,
  buffer: Buffer,
): Promise<StatementImportPreviewResult> {
  const parsed = await parseStatementFromBuffer(provider, buffer);
  return {
    provider,
    account_number: parsed.accountNumber,
    payment_due_date: parsed.paymentDueDate
      ? toDateString(parsed.paymentDueDate)
      : null,
    total_due: parsed.totalDue,
    minimum_payment: parsed.minimumPayment,
    movements: parsed.movements.map((movement) => ({
      kind: movement.kind,
      description: movement.description,
      amount: movement.amount,
      payment_date: toDateString(movement.paymentDate),
      ...(movement.installmentCurrent != null
        ? { installment_current: movement.installmentCurrent }
        : {}),
      ...(movement.installmentTotal != null
        ? { installment_total: movement.installmentTotal }
        : {}),
    })),
    warnings: parsed.warnings,
  };
}

async function parseStatementFromBuffer(
  provider: StatementImportProvider,
  buffer: Buffer,
): Promise<ParsedStatement> {
  const input = { buffer } as Pick<ImportInput, 'buffer'>;
  let parsed: ParsedStatement;

  switch (provider) {
    case StatementImportProvider.MERCADO_PAGO: {
      const text = await extractMercadoPagoStatementText(input.buffer);
      assertReadablePdfText(text);
      const r = parseMercadoPagoStatementText(text);
      parsed = {
        accountNumber: r.accountNumber,
        statementIssueDate: r.statementIssueDate,
        paymentDueDate: null,
        periodStart: r.periodStart,
        periodEnd: r.periodEnd,
        totalDue: r.totalDue,
        minimumPayment: null,
        currentBalance:
          r.totalDue != null && Number.isFinite(r.totalDue) ? r.totalDue : null,
        movements: normalizeParsedMovements(
          r.movements.map((m) => ({
            description: m.description,
            amount: m.amount,
            paymentDate: m.paymentDate,
          })),
        ),
        warnings: r.warnings,
      };
      break;
    }
    case StatementImportProvider.CA_DEPARTAMENTAL: {
      const text = await extractCaDepartamentalStatementText(input.buffer);
      assertReadablePdfText(text);
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
        movements: normalizeParsedMovements(
          r.movements.map((m) => ({
            description: m.description,
            amount: m.amount,
            paymentDate: m.paymentDate,
            installmentCurrent: m.installmentCurrent,
            installmentTotal: m.installmentTotal,
            kind: m.kind,
          })),
        ),
        warnings: r.warnings,
      };
      break;
    }
    case StatementImportProvider.CA_EFECTIVO: {
      const text = await extractCaEfectivoStatementText(input.buffer);
      assertReadablePdfText(text);
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
        movements: normalizeParsedMovements(
          r.movements.map((m) => ({
            description: m.description,
            amount: m.amount,
            paymentDate: m.paymentDate,
            installmentCurrent: m.installmentCurrent,
            installmentTotal: m.installmentTotal,
            kind: m.kind,
          })),
        ),
        warnings: r.warnings,
      };
      break;
    }
    case StatementImportProvider.DIDI_CARD: {
      const text = await extractDidiCardStatementText(input.buffer);
      assertReadablePdfText(text);
      const r = parseDidiCardStatementText(text);
      parsed = {
        accountNumber: r.accountNumber,
        statementIssueDate: r.statementIssueDate,
        paymentDueDate: r.paymentDueDate,
        periodStart: r.periodStart,
        periodEnd: r.periodEnd,
        totalDue: r.totalDue,
        minimumPayment: r.minimumPayment,
        currentBalance: r.totalDue,
        temporaryCreditLimit: r.temporaryCreditLimit,
        movements: normalizeParsedMovements(
          r.movements.map((m) => ({
            description: m.description,
            amount: m.amount,
            paymentDate: m.paymentDate,
          })),
        ),
        warnings: r.warnings,
      };
      break;
    }
    case StatementImportProvider.LIVERPOOL: {
      const text = await extractLiverpoolStatementText(input.buffer);
      assertReadablePdfText(text);
      const r = parseLiverpoolStatementText(text);
      parsed = {
        accountNumber: r.accountNumber,
        statementIssueDate: r.statementIssueDate,
        paymentDueDate: r.paymentDueDate,
        periodStart: r.periodStart,
        periodEnd: r.periodEnd,
        totalDue: r.totalDue,
        minimumPayment: r.minimumPayment,
        currentBalance: r.currentBalance,
        movements: normalizeParsedMovements(
          r.movements.map((m) => ({
            description: m.description,
            amount: m.amount,
            paymentDate: m.paymentDate,
          })),
        ),
        warnings: r.warnings,
      };
      break;
    }
    default: {
      const err = new Error(`Proveedor no soportado: ${String(provider)}`) as Error & {
        code?: string;
      };
      err.code = 'UNSUPPORTED_PROVIDER';
      throw err;
    }
  }

  return parsed;
}
