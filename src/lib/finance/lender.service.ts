import prisma from '@/lib/prisma';
import type { Prisma } from '@/generated/prisma/client';
import type { OwnerFilter } from '@/lib/server/get-owner-context';
import { todayCalendarDate } from '@/lib/calendar-dates';
import { isFundingWalletType } from '@/lib/finance/wallet-accounting';
import { createExpenseInTransaction } from '@/lib/finance/expense.service';
import { resolveOrCreateFortnight } from '@/lib/fortnights';
import { getCalendarFortnightRefForYmd } from '@/lib/fortnight-calendar';
import {
  deriveLoanStatusFromPayments,
  formatDateYmd,
  loanDueDateForStorage,
  parseYmdAsUtcDate,
} from '@/lib/finance/loan-schedule';
import { listLoansByOwner } from '@/lib/finance/loan.service';
import { findOrCreateLenderForOwner } from '@/lib/finance/lender-resolve';
import {
  selectLenderPayWindow,
  type LenderWindowPayment,
} from '@/lib/finance/lender-payment-window';
import type {
  CreateLenderInput,
  MergeLenderInput,
  PayLenderInput,
  SplitLenderInput,
} from '@/schemas/lender.schema';
import { isPayrollOnlyLoans } from '@/lib/finance/lender-payroll';
import {
  allocateLenderPayment,
  parseStoredLenderAllocation,
  type LenderPaySlice,
  type StoredLenderPaymentAllocation,
} from '@/lib/finance/lender-pay-allocation';
import type {
  LenderDetail,
  LenderListItem,
  LenderPaymentListItem,
  LenderPayWindowView,
  PayLenderResult,
} from '@/types/lenders';
import type { LoanListItem, LoanPaymentListItem } from '@/types/loans';

function decimalToNumber(value: unknown): number {
  if (
    typeof value === 'object' &&
    value != null &&
    'toNumber' in value &&
    typeof (value as { toNumber: () => number }).toNumber === 'function'
  ) {
    return (value as { toNumber: () => number }).toNumber();
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function ownerData(ownerType: 'user' | 'house', ownerId: number) {
  return ownerType === 'user'
    ? { user_id: ownerId, house_id: null }
    : { user_id: null, house_id: ownerId };
}

function ownerFromFilter(ownerFilter: OwnerFilter): {
  ownerType: 'user' | 'house';
  ownerId: number;
} {
  return ownerFilter.user_id != null
    ? { ownerType: 'user', ownerId: ownerFilter.user_id }
    : { ownerType: 'house', ownerId: ownerFilter.house_id };
}

const roundMoney = (value: number): number => Math.round(value * 100) / 100;

async function ensureLoanPaymentCategory(
  tx: Prisma.TransactionClient,
  ownerFilter: OwnerFilter,
) {
  const existing = await tx.category.findFirst({
    where: { ...ownerFilter, name: 'Pago de préstamos' },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await tx.category.create({
    data: {
      ...ownerFilter,
      name: 'Pago de préstamos',
      description: 'Pagos generados desde préstamos',
      icon: '🏦',
    },
    select: { id: true },
  });
  return created.id;
}

const mapLenderPayment = (row: {
  id: number;
  lender_id: number;
  amount: unknown;
  paid_at: Date;
  mode: string;
  source_wallet_id: number | null;
  source_wallet?: { name: string } | null;
  expense_id: number | null;
  note: string | null;
  loan_payments?: Array<{ id: number }>;
}): LenderPaymentListItem => ({
  id: row.id,
  lenderId: row.lender_id,
  amount: decimalToNumber(row.amount),
  paidAt: formatDateYmd(row.paid_at),
  mode: row.mode as LenderPaymentListItem['mode'],
  sourceWalletId: row.source_wallet_id,
  sourceWalletName: row.source_wallet?.name ?? null,
  expenseId: row.expense_id,
  note: row.note,
  installmentCount: row.loan_payments?.length ?? 0,
});

const toWindowPayments = (loans: LoanListItem[]): LenderWindowPayment[] =>
  loans.flatMap((loan) =>
    (loan.payments ?? []).map((payment) => ({
      id: payment.id,
      loanId: loan.id,
      loanName: loan.name,
      sequence: payment.sequence,
      dueDate: payment.dueDate,
      amount: payment.amount,
      paymentSource: loan.paymentSource,
      loanStatus: loan.status,
      status: payment.status,
    })),
  );

const payWindowView = (
  loans: LoanListItem[],
  todayYmd: string,
): LenderPayWindowView => {
  const window = selectLenderPayWindow(toWindowPayments(loans), todayYmd);
  return {
    amount: window.amount,
    commitmentDate: window.commitmentDate,
    commitmentDateEnd: window.commitmentDateEnd,
    isRange: window.isRange,
    canPay: window.included.length > 0,
    included: window.included.map((row) => ({
      id: row.id,
      loanId: row.loanId,
      loanName: row.loanName,
      sequence: row.sequence,
      dueDate: row.dueDate,
      amount: row.amount,
    })),
  };
};

const buildLenderListItem = (
  lender: {
    id: number;
    name: string;
    provider_icon_key: string | null;
    notes: string | null;
    active: boolean;
  },
  loans: LoanListItem[],
  todayYmd: string,
  recentPayments?: LenderPaymentListItem[],
): LenderListItem => {
  const activeLoans = loans.filter((loan) => loan.status === 'ACTIVE');
  const payrollOnly = isPayrollOnlyLoans(activeLoans);

  return {
    id: lender.id,
    name: lender.name,
    providerIconKey: lender.provider_icon_key,
    notes: lender.notes,
    active: lender.active,
    remainingPrincipal: roundMoney(
      loans.reduce((sum, loan) => sum + loan.remainingAmount, 0),
    ),
    activeContractCount: activeLoans.length,
    payrollOnly,
    payWindow: payWindowView(loans, todayYmd),
    loans,
    recentPayments,
  };
};

export async function createLenderForOwner(
  ownerType: 'user' | 'house',
  ownerId: number,
  ownerFilter: OwnerFilter,
  input: CreateLenderInput,
): Promise<LenderListItem> {
  const lender = await findOrCreateLenderForOwner(
    ownerType,
    ownerId,
    ownerFilter,
    input.name,
  );
  if (input.providerIconKey !== undefined || input.notes !== undefined) {
    await prisma.lender.update({
      where: { id: lender.id },
      data: {
        ...(input.providerIconKey !== undefined
          ? { provider_icon_key: input.providerIconKey }
          : {}),
        ...(input.notes !== undefined
          ? { notes: input.notes?.trim() || null }
          : {}),
      },
    });
  }
  const items = await listLendersByOwner(ownerFilter);
  const created = items.find((item) => item.id === lender.id);
  if (!created) {
    throw new Error('No se pudo crear el prestamista');
  }
  return created;
}

export async function listLendersByOwner(
  ownerFilter: OwnerFilter,
): Promise<LenderListItem[]> {
  const todayYmd = todayCalendarDate();
  const [lenders, loans, payments] = await Promise.all([
    prisma.lender.findMany({
      where: ownerFilter,
      orderBy: { name: 'asc' },
    }),
    listLoansByOwner(ownerFilter),
    prisma.lenderPayment.findMany({
      where: ownerFilter,
      include: {
        source_wallet: { select: { name: true } },
        loan_payments: { select: { id: true } },
      },
      orderBy: [{ paid_at: 'desc' }, { id: 'desc' }],
    }),
  ]);

  const loansByLender = new Map<number, LoanListItem[]>();
  for (const loan of loans) {
    if (loan.lenderId == null) continue;
    const rows = loansByLender.get(loan.lenderId) ?? [];
    rows.push(loan);
    loansByLender.set(loan.lenderId, rows);
  }

  const paymentsByLender = new Map<number, LenderPaymentListItem[]>();
  for (const payment of payments) {
    const rows = paymentsByLender.get(payment.lender_id) ?? [];
    if (rows.length >= 1) continue;
    rows.push(mapLenderPayment(payment));
    paymentsByLender.set(payment.lender_id, rows);
  }

  return lenders.map((lender) =>
    buildLenderListItem(
      lender,
      loansByLender.get(lender.id) ?? [],
      todayYmd,
      paymentsByLender.get(lender.id),
    ),
  );
}

async function loadLenderDetail(
  lenderId: number,
  ownerFilter: OwnerFilter,
): Promise<LenderDetail> {
  const todayYmd = todayCalendarDate();
  const lender = await prisma.lender.findFirst({
    where: { id: lenderId, ...ownerFilter },
  });
  if (!lender) {
    throw new Error('Prestamista no encontrado');
  }

  const [loans, payments] = await Promise.all([
    listLoansByOwner(ownerFilter),
    prisma.lenderPayment.findMany({
      where: { lender_id: lenderId, ...ownerFilter },
      include: {
        source_wallet: { select: { name: true } },
        loan_payments: { select: { id: true } },
      },
      orderBy: [{ paid_at: 'desc' }, { id: 'desc' }],
    }),
  ]);

  const mappedPayments = payments.map(mapLenderPayment);
  return {
    ...buildLenderListItem(
      lender,
      loans.filter((loan) => loan.lenderId === lenderId),
      todayYmd,
      mappedPayments.slice(0, 5),
    ),
    payments: mappedPayments,
  };
}

export async function getLenderByIdForOwner(
  lenderId: number,
  ownerFilter: OwnerFilter,
): Promise<LenderDetail> {
  return loadLenderDetail(lenderId, ownerFilter);
}

async function assertOwnedFundingWallet(
  walletId: number | null | undefined,
  ownerFilter: OwnerFilter,
) {
  if (!walletId) return;
  const wallet = await prisma.wallet.findFirst({
    where: { id: walletId, ...ownerFilter },
    select: { id: true, type: true, amount: true },
  });
  if (!wallet) {
    throw new Error('La billetera de pago no pertenece a este contexto');
  }
  if (!isFundingWalletType(wallet.type)) {
    throw new Error('El prestamista debe pagarse desde efectivo o débito');
  }
  return wallet;
}

const toPaySlice = (row: {
  id: number;
  loanId: number;
  dueDate: string;
  sequence: number;
  amount: number;
}): LenderPaySlice => ({
  id: row.id,
  loanId: row.loanId,
  dueDate: row.dueDate,
  sequence: row.sequence,
  amount: row.amount,
});

async function refreshLoanStatuses(
  tx: Prisma.TransactionClient,
  loanIds: Iterable<number>,
) {
  for (const loanId of loanIds) {
    const paymentStatuses = await tx.loanPayment.findMany({
      where: { loan_id: loanId },
      select: { status: true },
    });
    await tx.loan.update({
      where: { id: loanId },
      data: {
        status: deriveLoanStatusFromPayments(
          paymentStatuses.map((row) => ({
            status: row.status as LoanPaymentListItem['status'],
          })),
        ),
      },
    });
  }
}

export async function payLenderForOwner(
  lenderId: number,
  ownerFilter: OwnerFilter,
  input: PayLenderInput,
): Promise<PayLenderResult> {
  const { ownerType, ownerId } = ownerFromFilter(ownerFilter);
  const detail = await loadLenderDetail(lenderId, ownerFilter);
  const window = selectLenderPayWindow(
    toWindowPayments(detail.loans),
    todayCalendarDate(),
  );
  if (window.included.length === 0) {
    throw new Error('No hay cuotas de billetera para pagar en este periodo');
  }

  const excluded = new Set(input.excludePaymentIds ?? []);
  const unknownExcluded = [...excluded].filter(
    (id) => !window.included.some((row) => row.id === id),
  );
  if (unknownExcluded.length > 0) {
    throw new Error('Hay cuotas que no están en el pago de este periodo');
  }
  const included = window.included.filter((row) => !excluded.has(row.id));
  if (included.length === 0) {
    throw new Error('Deja al menos un contrato en el pago');
  }

  const includedIds = new Set(included.map((row) => row.id));
  const includedLoanIds = new Set(included.map((row) => row.loanId));
  const future = detail.loans.flatMap((loan) => {
    if (loan.paymentSource !== 'WALLET' || loan.status !== 'ACTIVE') return [];
    if (!includedLoanIds.has(loan.id)) return [];
    return (loan.payments ?? [])
      .filter(
        (payment) =>
          payment.status === 'SCHEDULED' && !includedIds.has(payment.id),
      )
      .map((payment) =>
        toPaySlice({
          id: payment.id,
          loanId: loan.id,
          dueDate: payment.dueDate,
          sequence: payment.sequence,
          amount: payment.amount,
        }),
      );
  });

  const plan = allocateLenderPayment(
    included.map(toPaySlice),
    future,
    input.amount ?? null,
  );

  const mode = input.mode ?? 'WALLET';
  const paidAt = parseYmdAsUtcDate(input.paidAt ?? todayCalendarDate());
  const sourceWalletId = mode === 'WALLET' ? input.sourceWalletId ?? null : null;

  if (mode === 'WALLET') {
    const wallet = await assertOwnedFundingWallet(sourceWalletId, ownerFilter);
    if (!wallet) {
      throw new Error('Selecciona la billetera que paga al prestamista');
    }
    if (decimalToNumber(wallet.amount) < plan.amount) {
      throw new Error('Saldo insuficiente en la billetera de origen');
    }
  }

  const includedById = new Map(included.map((row) => [row.id, row]));

  const createdPaymentId = await prisma.$transaction(async (tx) => {
    const lenderPayment = await tx.lenderPayment.create({
      data: {
        lender_id: lenderId,
        amount: plan.amount.toString(),
        paid_at: paidAt,
        mode,
        source_wallet_id: sourceWalletId,
        note: input.note?.trim() || null,
        ...ownerData(ownerType, ownerId),
      },
    });

    if (mode === 'WALLET' && sourceWalletId) {
      const paidYmd = formatDateYmd(paidAt);
      const { year, month, period } = getCalendarFortnightRefForYmd(paidYmd);
      const fortnight = await resolveOrCreateFortnight({
        ownerType,
        ownerId,
        year,
        month,
        period,
        tx,
      });
      const categoryId = await ensureLoanPaymentCategory(tx, ownerFilter);
      const expense = await createExpenseInTransaction(tx, {
        fortnightId: fortnight.id,
        categoryId,
        description: `Pago a ${detail.name}`,
        amount: plan.amount,
        isPaid: true,
        paymentDate: paidYmd,
        walletId: sourceWalletId,
      });
      await tx.lenderPayment.update({
        where: { id: lenderPayment.id },
        data: { expense_id: expense.id },
      });
    }

    if (plan.fullPaymentIds.length > 0) {
      await tx.loanPayment.updateMany({
        where: { id: { in: plan.fullPaymentIds }, loan: ownerFilter },
        data: {
          status: 'PAID',
          paid_at: paidAt,
          source_wallet_id: sourceWalletId,
          lender_payment_id: lenderPayment.id,
          note: input.note?.trim() || undefined,
        },
      });
    }

    const storedSplits: StoredLenderPaymentAllocation['splits'] = [];
    for (const split of plan.splits) {
      const source = includedById.get(split.paymentId);
      await tx.loanPayment.update({
        where: { id: split.paymentId },
        data: { amount: split.remainderAmount.toString() },
      });
      const maxSequence = await tx.loanPayment.aggregate({
        where: { loan_id: split.loanId },
        _max: { sequence: true },
      });
      const created = await tx.loanPayment.create({
        data: {
          loan_id: split.loanId,
          sequence: (maxSequence._max.sequence ?? 0) + 1,
          due_date: loanDueDateForStorage(source?.dueDate ?? todayCalendarDate()),
          amount: split.paidAmount.toString(),
          status: 'PAID',
          paid_at: paidAt,
          source_wallet_id: sourceWalletId,
          lender_payment_id: lenderPayment.id,
          note: input.note?.trim() || null,
        },
      });
      await tx.loan.update({
        where: { id: split.loanId },
        data: { payment_count: { increment: 1 } },
      });
      storedSplits.push({
        sourcePaymentId: split.paymentId,
        paidPaymentId: created.id,
        loanId: split.loanId,
        previousAmount: split.previousAmount,
      });
    }

    for (const reduction of plan.reductions) {
      await tx.loanPayment.update({
        where: { id: reduction.paymentId },
        data:
          reduction.nextAmount === 0
            ? { status: 'CANCELLED' }
            : { amount: reduction.nextAmount.toString() },
      });
    }

    const allocation: StoredLenderPaymentAllocation = {
      fullPaymentIds: plan.fullPaymentIds,
      splits: storedSplits,
      reductions: plan.reductions.map((reduction) => ({
        paymentId: reduction.paymentId,
        loanId: reduction.loanId,
        previousAmount: reduction.previousAmount,
        cancelled: reduction.nextAmount === 0,
      })),
    };
    await tx.lenderPayment.update({
      where: { id: lenderPayment.id },
      data: { allocation },
    });

    const loanIds = new Set<number>([
      ...included.map((row) => row.loanId),
      ...plan.splits.map((split) => split.loanId),
      ...plan.reductions.map((reduction) => reduction.loanId),
    ]);
    await refreshLoanStatuses(tx, loanIds);

    return lenderPayment.id;
  });

  const updated = await loadLenderDetail(lenderId, ownerFilter);
  const payment = updated.payments.find((row) => row.id === createdPaymentId);
  if (!payment) {
    throw new Error('No se pudo registrar el pago del prestamista');
  }

  const markedIds = new Set(plan.fullPaymentIds);
  const loanPayments = updated.loans.flatMap((loan) =>
    (loan.payments ?? []).filter(
      (row) => markedIds.has(row.id) || row.lenderPaymentId === createdPaymentId,
    ),
  );

  return { lender: updated, payment, loanPayments };
}

export async function undoLenderPaymentForOwner(
  lenderId: number,
  paymentId: number,
  ownerFilter: OwnerFilter,
): Promise<LenderDetail> {
  const existing = await prisma.lenderPayment.findFirst({
    where: { id: paymentId, lender_id: lenderId, ...ownerFilter },
    include: {
      expense: {
        select: {
          id: true,
          wallet_id: true,
          amount: true,
          is_paid: true,
          wallet: { select: { type: true } },
        },
      },
      loan_payments: {
        select: { id: true, loan_id: true },
      },
    },
  });
  if (!existing) {
    throw new Error('Pago del prestamista no encontrado');
  }

  await prisma.$transaction(async (tx) => {
    if (existing.expense) {
      const { applyWalletAmountDelta, getPaidExpenseWalletDelta } = await import(
        '@/lib/finance/wallet-accounting'
      );
      if (
        existing.expense.is_paid &&
        existing.expense.wallet_id != null &&
        existing.expense.wallet != null
      ) {
        await applyWalletAmountDelta(
          tx,
          existing.expense.wallet_id,
          -getPaidExpenseWalletDelta(
            existing.expense.wallet.type,
            Number(existing.expense.amount),
          ),
        );
      }
      await tx.expense.delete({ where: { id: existing.expense.id } });
    }

    const allocation = parseStoredLenderAllocation(existing.allocation);
    const loanIds = new Set(existing.loan_payments.map((row) => row.loan_id));

    if (allocation) {
      for (const split of allocation.splits) {
        await tx.loanPayment.delete({ where: { id: split.paidPaymentId } });
        await tx.loanPayment.update({
          where: { id: split.sourcePaymentId },
          data: {
            amount: split.previousAmount.toString(),
            status: 'SCHEDULED',
            paid_at: null,
            lender_payment_id: null,
            note: null,
          },
        });
        await tx.loan.update({
          where: { id: split.loanId },
          data: { payment_count: { decrement: 1 } },
        });
        loanIds.add(split.loanId);
      }
      for (const reduction of allocation.reductions) {
        await tx.loanPayment.update({
          where: { id: reduction.paymentId },
          data: {
            amount: reduction.previousAmount.toString(),
            status: 'SCHEDULED',
          },
        });
        loanIds.add(reduction.loanId);
      }
      const splitPaidIds = allocation.splits.map((split) => split.paidPaymentId);
      await tx.loanPayment.updateMany({
        where: {
          lender_payment_id: existing.id,
          ...(splitPaidIds.length > 0 ? { id: { notIn: splitPaidIds } } : {}),
        },
        data: {
          status: 'SCHEDULED',
          paid_at: null,
          lender_payment_id: null,
          note: null,
        },
      });
    } else {
      await tx.loanPayment.updateMany({
        where: { lender_payment_id: existing.id },
        data: {
          status: 'SCHEDULED',
          paid_at: null,
          lender_payment_id: null,
          note: null,
        },
      });
    }

    await refreshLoanStatuses(tx, loanIds);

    await tx.lenderPayment.delete({ where: { id: existing.id } });
  });

  return loadLenderDetail(lenderId, ownerFilter);
}

export async function mergeLendersForOwner(
  sourceLenderId: number,
  ownerFilter: OwnerFilter,
  input: MergeLenderInput,
): Promise<LenderDetail> {
  if (sourceLenderId === input.targetLenderId) {
    throw new Error('Elige otro prestamista para fusionar');
  }

  const [source, target] = await Promise.all([
    prisma.lender.findFirst({
      where: { id: sourceLenderId, ...ownerFilter },
      select: { id: true, name: true },
    }),
    prisma.lender.findFirst({
      where: { id: input.targetLenderId, ...ownerFilter },
      select: { id: true, name: true },
    }),
  ]);
  if (!source || !target) {
    throw new Error('Prestamista no encontrado');
  }

  await prisma.$transaction(async (tx) => {
    await tx.loan.updateMany({
      where: { lender_id: source.id, ...ownerFilter },
      data: { lender_id: target.id, lender: target.name },
    });
    await tx.lenderPayment.updateMany({
      where: { lender_id: source.id, ...ownerFilter },
      data: { lender_id: target.id },
    });
    await tx.lender.delete({ where: { id: source.id } });
  });

  return loadLenderDetail(target.id, ownerFilter);
}

export async function splitLenderForOwner(
  sourceLenderId: number,
  ownerType: 'user' | 'house',
  ownerId: number,
  ownerFilter: OwnerFilter,
  input: SplitLenderInput,
): Promise<LenderDetail> {
  const source = await prisma.lender.findFirst({
    where: { id: sourceLenderId, ...ownerFilter },
    select: { id: true, name: true },
  });
  if (!source) {
    throw new Error('Prestamista no encontrado');
  }

  const moving = await prisma.loan.findMany({
    where: {
      id: { in: input.loanIds },
      lender_id: source.id,
      ...ownerFilter,
    },
    select: { id: true },
  });
  if (moving.length !== new Set(input.loanIds).size) {
    throw new Error('Hay contratos que no pertenecen a este prestamista');
  }

  const staying = await prisma.loan.count({
    where: {
      lender_id: source.id,
      id: { notIn: input.loanIds },
      ...ownerFilter,
    },
  });
  if (staying === 0) {
    throw new Error('Deja al menos un contrato en el prestamista original');
  }

  let target: { id: number; name: string };
  if (input.targetLenderId) {
    if (input.targetLenderId === source.id) {
      throw new Error('Elige otro prestamista para separar');
    }
    const existing = await prisma.lender.findFirst({
      where: { id: input.targetLenderId, ...ownerFilter },
      select: { id: true, name: true },
    });
    if (!existing) {
      throw new Error('Prestamista no encontrado');
    }
    target = existing;
  } else {
    target = await findOrCreateLenderForOwner(
      ownerType,
      ownerId,
      ownerFilter,
      input.name ?? '',
    );
    if (target.id === source.id) {
      throw new Error('Ese nombre ya es este prestamista');
    }
  }

  await prisma.loan.updateMany({
    where: {
      id: { in: input.loanIds },
      lender_id: source.id,
      ...ownerFilter,
    },
    data: { lender_id: target.id, lender: target.name },
  });

  return loadLenderDetail(target.id, ownerFilter);
}
