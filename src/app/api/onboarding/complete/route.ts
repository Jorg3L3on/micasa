import {
  isValidCalendarDateString,
} from '@/lib/calendar-dates';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { resolveTemplateDueDay } from '@/lib/finance/expense-template-due';
import { WALLET_PROVIDER_ICON_KEYS } from '@/lib/wallet-provider-icons';
import { getCanonicalFortnightBounds } from '@/lib/finance/budget-period-windows';
import { seedDefaultCategoriesForOwner } from '@/lib/finance/category-seed.service';

type WalletPayload = {
  id: string;
  name: string;
  type?: 'CASH' | 'BANK' | 'CREDIT';
  providerIconKey?: string | null;
};

type IncomeTemplatePayload = {
  id: string;
  name: string;
  amount: number;
  walletId: string;
  source?: string;
  appliesFirstFortnight?: boolean;
  appliesSecondFortnight?: boolean;
};

type ExpenseTemplatePayload = {
  id: string;
  name: string;
  amount: number;
  categoryId: string;
  walletId: string;
  isRecurring?: boolean;
  appliesFirstFortnight?: boolean;
  appliesSecondFortnight?: boolean;
};

type OnboardingPayload = {
  wallets: WalletPayload[];
  categories?: unknown;
  incomeTemplates: IncomeTemplatePayload[];
  expenseTemplates: ExpenseTemplatePayload[];
  // Temporarily optional until the frontend wiring is complete.
  startDate?: string | null;
};

type FortnightPeriod = 'FIRST' | 'SECOND';

type GeneratedFortnight = {
  startDate: Date;
  endDate: Date;
  label: string;
  month: number;
  year: number;
  period: FortnightPeriod;
};

const WALLET_PROVIDER_ICON_KEY_SET = new Set<string>(WALLET_PROVIDER_ICON_KEYS);

function normalizeProviderIconKey(
  walletType: WalletPayload['type'],
  providerIconKey: string | null | undefined,
): string | null {
  if (walletType === 'CASH') return 'CASH_GENERIC';
  if (!providerIconKey || providerIconKey === 'CASH_GENERIC') return null;
  return WALLET_PROVIDER_ICON_KEY_SET.has(providerIconKey)
    ? providerIconKey
    : null;
}

function generateFortnights(startYmd: string, count: number): GeneratedFortnight[] {
  if (!isValidCalendarDateString(startYmd)) return [];

  const result: GeneratedFortnight[] = [];
  const [baseYear, baseMonth] = startYmd.split('-').map(Number);

  // count is number of fortnights; two per month (1–15 and 16–end)
  for (let i = 0; i < count; i++) {
    const monthOffset = Math.floor(i / 2);
    const period: FortnightPeriod = i % 2 === 0 ? 'FIRST' : 'SECOND';

    const absoluteMonth = baseMonth + monthOffset;
    const year = baseYear + Math.floor((absoluteMonth - 1) / 12);
    const month = ((absoluteMonth - 1) % 12) + 1;
    const bounds = getCanonicalFortnightBounds(year, month, period);

    result.push({
      startDate: bounds.start_date,
      endDate: bounds.end_date,
      label:
        period === 'FIRST'
          ? `Primera quincena - ${month}/${year}`
          : `Segunda quincena - ${month}/${year}`,
      month,
      year,
      period,
    });
  }

  return result;
}

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 });
    }

    const userId = Number(session.user.id);

    if (!Number.isFinite(userId)) {
      return NextResponse.json(
        { success: false, message: 'Usuario inválido' },
        { status: 400 },
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: 'JSON inválido' },
        { status: 400 },
      );
    }

    const payload = body as OnboardingPayload;

    if (
      !payload ||
      !Array.isArray(payload.wallets) ||
      !Array.isArray(payload.incomeTemplates) ||
      !Array.isArray(payload.expenseTemplates)
    ) {
      return NextResponse.json(
        { success: false, message: 'Payload de onboarding inválido' },
        { status: 400 },
      );
    }

    let startYmd: string | null = null;
    if (typeof payload.startDate === 'string' && payload.startDate.trim() !== '') {
      const trimmed = payload.startDate.trim();
      if (!isValidCalendarDateString(trimmed)) {
        return NextResponse.json(
          { success: false, message: 'Fecha de inicio inválida' },
          { status: 400 },
        );
      }
      startYmd = trimmed;
    }

    await prisma.$transaction(async (tx) => {
      // Maps from client-side IDs (UUIDs) to database IDs (ints)
      const walletIdMap = new Map<string, number>();

      // Ensure default categories exist (register seeds them; backfill for older signups).
      await seedDefaultCategoriesForOwner(tx, { userId });

      const userCategories = await tx.category.findMany({
        where: { user_id: userId, house_id: null },
        select: { id: true, name: true, kind: true },
      });
      const validCategoryIds = new Set(
        userCategories
          .filter((c) => c.kind === 'EXPENSE')
          .map((c) => c.id),
      );
      const defaultIncomeCategoryId =
        userCategories.find(
          (c) => c.kind === 'INCOME' && c.name === 'Salario',
        )?.id ??
        userCategories.find((c) => c.kind === 'INCOME')?.id ??
        null;

      // 1. Wallets
      for (const wallet of payload.wallets) {
        const prismaType =
          wallet.type === 'BANK'
            ? 'DEBIT_CARD'
            : wallet.type === 'CREDIT'
              ? 'CREDIT_CARD'
              : 'CASH';

        const created = await tx.wallet.create({
          data: {
            name: wallet.name,
            amount: 0,
            type: prismaType,
            provider_icon_key: normalizeProviderIconKey(
              wallet.type,
              wallet.providerIconKey,
            ),
            active: true,
            user_id: userId,
            house_id: null,
          },
        });
        walletIdMap.set(wallet.id, created.id);
      }

      // 2. Income templates
      if (payload.incomeTemplates.length > 0) {
        await tx.incomeTemplate.createMany({
          data: payload.incomeTemplates.map((income) => ({
            name: income.name,
            suggested_amount: income.amount,
            source: income.source ?? null,
            applies_first_fortnight: !!income.appliesFirstFortnight,
            applies_second_fortnight: !!income.appliesSecondFortnight,
            active: true,
            user_id: userId,
            house_id: null,
            category_id: defaultIncomeCategoryId,
          })),
        });
      }

      // 3. Expense templates (categoryId is the seeded DB id as string)
      if (payload.expenseTemplates.length > 0) {
        await tx.expenseTemplate.createMany({
          data: payload.expenseTemplates.map((expense) => {
            const parsedCategoryId = Number(expense.categoryId);
            const categoryId =
              Number.isFinite(parsedCategoryId) &&
              validCategoryIds.has(parsedCategoryId)
                ? parsedCategoryId
                : null;
            return {
              name: expense.name,
              suggested_amount: expense.amount,
              is_recurring: !!expense.isRecurring,
              applies_first_fortnight: !!expense.appliesFirstFortnight,
              applies_second_fortnight: !!expense.appliesSecondFortnight,
              is_subscription: false,
              due_day: null,
              due_day_first_fortnight: null,
              due_day_second_fortnight: null,
              cutoff_day: null,
              active: true,
              user_id: userId,
              house_id: null,
              category_id: categoryId,
              wallet_id: walletIdMap.get(expense.walletId) ?? null,
            };
          }),
        });
      }

      // 5. Fortnights (first 4 cycles) — only if we have a valid start date
      if (startYmd) {
        const generatedFortnights = generateFortnights(startYmd, 4);

        if (generatedFortnights.length > 0) {
          await tx.fortnight.createMany({
            skipDuplicates: true,
            data: generatedFortnights.map((f) => ({
              start_date: f.startDate,
              end_date: f.endDate,
              label: f.label,
              month: f.month,
              year: f.year,
              period: f.period,
              closed: false,
              user_id: userId,
              house_id: null,
            })),
          });

          // Resolve the created fortnights so we can seed incomes/expenses into them.
          const fortnightRecords = await tx.fortnight.findMany({
            where: {
              user_id: userId,
              OR: generatedFortnights.map((f) => ({
                year: f.year,
                month: f.month,
                period: f.period,
              })),
            },
          });

          const fortnightKey = (f: { year: number; month: number; period: FortnightPeriod }) =>
            `${f.year}-${f.month}-${f.period}`;

          const fortnightMap = new Map<string, { id: number; start_date: Date }>();
          for (const f of fortnightRecords) {
            fortnightMap.set(
              fortnightKey({
                year: f.year,
                month: f.month,
                period: f.period as FortnightPeriod,
              }),
              { id: f.id, start_date: f.start_date },
            );
          }

          // Seed Income rows from income templates
          const incomeTemplatesDb = await tx.incomeTemplate.findMany({
            where: { user_id: userId, house_id: null, active: true },
          });

          const incomeCreates: {
            amount: number;
            source: string | null;
            received_at: Date;
            user_id: number | null;
            house_id: number | null;
            fortnight_id: number;
            income_template_id: number | null;
            category_id: number | null;
          }[] = [];

          for (const f of generatedFortnights) {
            const record = fortnightMap.get(
              fortnightKey({ year: f.year, month: f.month, period: f.period }),
            );
            if (!record) continue;

            for (const tmpl of incomeTemplatesDb) {
              const appliesFirst = tmpl.applies_first_fortnight;
              const appliesSecond = tmpl.applies_second_fortnight;

              if (
                (f.period === 'FIRST' && !appliesFirst) ||
                (f.period === 'SECOND' && !appliesSecond)
              ) {
                continue;
              }

              incomeCreates.push({
                amount: Number(tmpl.suggested_amount ?? 0),
                source: tmpl.source ?? null,
                received_at: record.start_date,
                user_id: userId,
                house_id: null,
                fortnight_id: record.id,
                income_template_id: tmpl.id,
                category_id: tmpl.category_id,
              });
            }
          }

          if (incomeCreates.length > 0) {
            await tx.income.createMany({ data: incomeCreates });
          }

          // Seed Expense rows from expense templates
          const expenseTemplatesDb = await tx.expenseTemplate.findMany({
            where: { user_id: userId, house_id: null, active: true },
          });

          const expenseCreates: {
            description: string;
            amount: number;
            is_paid: boolean;
            payment_date: Date | null;
            due_day: number | null;
            user_id: number | null;
            house_id: number | null;
            fortnight_id: number;
            category_id: number | null;
            expense_template_id: number | null;
            wallet_id: number | null;
          }[] = [];

          for (const f of generatedFortnights) {
            const record = fortnightMap.get(
              fortnightKey({ year: f.year, month: f.month, period: f.period }),
            );
            if (!record) continue;

            for (const tmpl of expenseTemplatesDb) {
              const appliesFirst = tmpl.applies_first_fortnight;
              const appliesSecond = tmpl.applies_second_fortnight;

              if (
                (f.period === 'FIRST' && !appliesFirst) ||
                (f.period === 'SECOND' && !appliesSecond)
              ) {
                continue;
              }

              const resolvedDue = resolveTemplateDueDay(f.period, {
                due_day: tmpl.due_day,
                due_day_first_fortnight: tmpl.due_day_first_fortnight,
                due_day_second_fortnight: tmpl.due_day_second_fortnight,
              });

              expenseCreates.push({
                description: tmpl.name,
                amount: Number(tmpl.suggested_amount ?? 0),
                is_paid: false,
                payment_date: null,
                due_day: resolvedDue ?? null,
                user_id: userId,
                house_id: null,
                fortnight_id: record.id,
                category_id: tmpl.category_id,
                expense_template_id: tmpl.id,
                wallet_id: tmpl.wallet_id,
              });
            }
          }

          if (expenseCreates.length > 0) {
            await tx.expense.createMany({ data: expenseCreates });
          }
        }
      }

      // Mark onboarding as completed for the user
      await tx.user.update({
        where: { id: userId },
        data: { onboarding_completed: true },
      });
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Onboarding completion failed:', error);

    return NextResponse.json(
      { success: false, message: 'Onboarding failed' },
      { status: 500 },
    );
  }
}

