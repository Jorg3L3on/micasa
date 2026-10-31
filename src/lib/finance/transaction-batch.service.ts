import prisma from '@/lib/prisma';
import { getCalendarFortnightRefForYmd } from '@/lib/fortnight-calendar';
import { resolveOrCreateFortnight } from '@/lib/fortnights';
import { DomainError } from '@/lib/finance/domain-error';
import { createExpenseInTransaction } from '@/lib/finance/expense.service';
import { createExpenseTemplateForOwner } from '@/lib/finance/expense-template.service';
import { createExpenseTemplateSchema } from '@/schemas/expense-template.schema';
import { createWalletIncomeRecord } from '@/lib/finance/income.service';
import { isSpendableCashWalletType } from '@/lib/finance/wallet-accounting';
import type { OwnerFilter } from '@/lib/server/get-owner-context';
import {
  batchItemSchema,
  type BatchExpenseItem,
  type BatchIncomeItem,
} from '@/schemas/transaction-batch.schema';
import type {
  BatchItemError,
  BatchItemResult,
  BatchResponse,
} from '@/types/transaction-batch';

type BatchOwner = {
  ownerType: 'user' | 'house';
  ownerId: number;
  ownerFilter: OwnerFilter;
};

type CategoryRow = { id: number; kind: string; active: boolean };
type WalletRow = { id: number; type: Parameters<typeof isSpendableCashWalletType>[0] };

type FortnightRef = { year: number; month: number; period: 'FIRST' | 'SECOND' };

class BatchItemFailure extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly field?: string,
  ) {
    super(message);
  }
}

const rawClientId = (raw: unknown, index: number): string => {
  if (raw && typeof raw === 'object' && 'clientId' in raw) {
    const id = (raw as { clientId: unknown }).clientId;
    if (typeof id === 'string' && id.length > 0) return id;
  }
  return `row-${index}`;
};

const toItemError = (err: unknown): BatchItemError => {
  if (err instanceof BatchItemFailure) {
    return { code: err.code, message: err.message, field: err.field };
  }
  if (err instanceof DomainError) {
    const field =
      err.code === 'EXPENSE_WALLET_REQUIRED' ||
      err.code === 'WALLET_NOT_FOUND' ||
      err.code === 'INSUFFICIENT_WALLET_BALANCE' ||
      err.code === 'CREDIT_LIMIT_EXCEEDED'
        ? 'walletId'
        : err.code === 'CATEGORY_NOT_FOUND'
          ? 'categoryId'
          : err.code === 'INVALID_AMOUNT'
            ? 'amount'
            : undefined;
    return { code: err.code, message: err.message, field };
  }
  if (
    err &&
    typeof err === 'object' &&
    'code' in err &&
    typeof (err as { code: unknown }).code === 'string' &&
    err instanceof Error
  ) {
    return { code: (err as { code: string }).code, message: err.message };
  }
  console.error('Unexpected error in transaction batch item:', err);
  return { code: 'INTERNAL', message: 'No se pudo guardar este movimiento' };
};

const dayOf = (ymd: string): number => Number(ymd.slice(8, 10));

const fortnightStartYmd = (ref: FortnightRef): string =>
  `${ref.year}-${String(ref.month).padStart(2, '0')}-${ref.period === 'FIRST' ? '01' : '16'}`;

/**
 * Saves a mixed batch of gastos and ingresos. Rows run one after another in
 * their own transaction, so wallet balances and credit limits are checked
 * against the rows already saved, and a failing row never rolls back the
 * others. Categories, wallets and fortnights are loaded once for the batch.
 */
export async function processTransactionBatch(
  owner: BatchOwner,
  rawItems: unknown[],
): Promise<BatchResponse> {
  const { ownerType, ownerId, ownerFilter } = owner;
  const results: BatchItemResult[] = new Array(rawItems.length);
  const valid: { index: number; item: ReturnType<typeof batchItemSchema.parse> }[] = [];

  rawItems.forEach((raw, index) => {
    const parsed = batchItemSchema.safeParse(raw);
    if (parsed.success) {
      valid.push({ index, item: parsed.data });
      return;
    }
    const issue = parsed.error.issues[0];
    results[index] = {
      clientId: rawClientId(raw, index),
      status: 'failed',
      error: {
        code: 'VALIDATION',
        message: issue?.message ?? 'Movimiento inválido',
        field: issue?.path?.[0] != null ? String(issue.path[0]) : undefined,
      },
    };
  });

  if (valid.length > 0) {
    const categoryIds = [...new Set(valid.map(({ item }) => item.categoryId))];
    const walletIds = [...new Set(valid.map(({ item }) => item.walletId))];
    const [categories, wallets] = await Promise.all([
      prisma.category.findMany({
        where: { id: { in: categoryIds }, ...ownerFilter },
        select: { id: true, kind: true, active: true },
      }),
      prisma.wallet.findMany({
        where: { id: { in: walletIds }, ...ownerFilter },
        select: { id: true, type: true },
      }),
    ]);
    const categoryById = new Map<number, CategoryRow>(
      categories.map((c) => [c.id, c as CategoryRow]),
    );
    const walletById = new Map<number, WalletRow>(
      wallets.map((w) => [w.id, w as WalletRow]),
    );

    const fortnightCache = new Map<string, Promise<{ id: number }>>();
    const getFortnight = (ref: FortnightRef) => {
      const key = `${ref.year}-${ref.month}-${ref.period}`;
      let pending = fortnightCache.get(key);
      if (!pending) {
        pending = resolveOrCreateFortnight({
          ownerType,
          ownerId,
          year: ref.year,
          month: ref.month,
          period: ref.period,
        });
        fortnightCache.set(key, pending);
      }
      return pending;
    };

    const checkCategory = (id: number, kind: 'EXPENSE' | 'INCOME') => {
      const category = categoryById.get(id);
      if (!category || category.kind !== kind) {
        throw new BatchItemFailure(
          'CATEGORY_NOT_FOUND',
          kind === 'INCOME'
            ? 'Categoría de ingreso no encontrada'
            : 'Categoría de gasto no encontrada',
          'categoryId',
        );
      }
      if (!category.active) {
        throw new BatchItemFailure(
          'CATEGORY_INACTIVE',
          'La categoría está inactiva',
          'categoryId',
        );
      }
    };

    const checkWallet = (id: number): WalletRow => {
      const wallet = walletById.get(id);
      if (!wallet) {
        throw new BatchItemFailure(
          'WALLET_NOT_FOUND',
          'Billetera no encontrada en este contexto',
          'walletId',
        );
      }
      return wallet;
    };

    const saveExpense = async (item: BatchExpenseItem): Promise<number> => {
      checkCategory(item.categoryId, 'EXPENSE');
      checkWallet(item.walletId);

      const ref = getCalendarFortnightRefForYmd(item.date);
      const fortnight = await getFortnight(ref);
      const bothFortnights = item.isRecurring && item.applyToBothFortnights;
      const otherPeriod = ref.period === 'FIRST' ? 'SECOND' : 'FIRST';
      const otherFortnight = bothFortnights
        ? await getFortnight({ ...ref, period: otherPeriod })
        : null;

      return prisma.$transaction(async (tx) => {
        let templateId: number | null = null;
        const otherDate = bothFortnights
          ? fortnightStartYmd({ ...ref, period: otherPeriod })
          : null;

        if (item.isRecurring) {
          const currentDue = dayOf(item.date);
          const otherDue = otherDate ? dayOf(otherDate) : null;
          const dueDayFirst = ref.period === 'FIRST' ? currentDue : otherDue;
          const dueDaySecond = ref.period === 'SECOND' ? currentDue : otherDue;
          const parsedTemplate = createExpenseTemplateSchema.safeParse({
            name: item.name,
            categoryId: item.categoryId,
            paymentMethodId: item.walletId,
            active: true,
            expenseIds: [],
            dueDayFirst,
            dueDaySecond,
            cutoffDay: null,
            isRecurring: true,
            appliesFirstFortnight: bothFortnights || ref.period === 'FIRST',
            appliesSecondFortnight: bothFortnights || ref.period === 'SECOND',
            isSubscription: false,
          });
          if (!parsedTemplate.success) {
            throw new BatchItemFailure(
              'VALIDATION',
              parsedTemplate.error.issues[0]?.message ??
                'No se pudo crear el gasto recurrente con esa fecha',
              'date',
            );
          }
          const template = await createExpenseTemplateForOwner(
            { ownerType, ownerId },
            parsedTemplate.data,
            tx,
          );
          templateId = template.id;
        }

        const created = await createExpenseInTransaction(tx, {
          fortnightId: fortnight.id,
          categoryId: item.categoryId,
          description: item.name,
          amount: item.amount,
          isPaid: item.isPaid,
          paymentDate: item.date,
          expenseTemplateId: templateId,
          walletId: item.walletId,
          applyWalletDelta: item.applyWalletDelta,
        });

        if (otherFortnight && otherDate) {
          await createExpenseInTransaction(tx, {
            fortnightId: otherFortnight.id,
            categoryId: item.categoryId,
            description: item.name,
            amount: item.amount,
            isPaid: item.isPaid,
            paymentDate: otherDate,
            expenseTemplateId: templateId,
            walletId: item.walletId,
            applyWalletDelta: item.applyWalletDelta,
          });
        }
        return created.id;
      });
    };

    const saveIncome = async (item: BatchIncomeItem): Promise<number> => {
      checkCategory(item.categoryId, 'INCOME');
      const wallet = checkWallet(item.walletId);
      if (!isSpendableCashWalletType(wallet.type)) {
        throw new BatchItemFailure(
          'INVALID_WALLET_TYPE',
          'Los ingresos solo aplican a efectivo, débito y metas.',
          'walletId',
        );
      }
      const fortnight = await getFortnight(getCalendarFortnightRefForYmd(item.date));
      const ownerData =
        ownerType === 'user'
          ? { user_id: ownerId, house_id: null }
          : { user_id: null, house_id: ownerId };
      const income = await prisma.$transaction((tx) =>
        createWalletIncomeRecord(tx, ownerData, {
          fortnightId: fortnight.id,
          walletId: item.walletId,
          categoryId: item.categoryId,
          amount: item.amount,
          source: item.name,
          date: item.date,
        }),
      );
      return income.id;
    };

    // Sequential on purpose: each row sees the wallet balance left by the previous one.
    for (const { index, item } of valid) {
      try {
        const id =
          item.kind === 'expense' ? await saveExpense(item) : await saveIncome(item);
        results[index] = { clientId: item.clientId, status: 'created', id };
      } catch (err) {
        results[index] = {
          clientId: item.clientId,
          status: 'failed',
          error: toItemError(err),
        };
      }
    }
  }

  const created = results.filter((r) => r.status === 'created').length;
  return {
    results,
    summary: { total: results.length, created, failed: results.length - created },
  };
}
