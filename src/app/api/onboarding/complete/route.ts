import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { resolveTemplateDueDay } from '@/lib/finance/expense-template-due';
import { WALLET_PROVIDER_ICON_KEYS } from '@/lib/wallet-provider-icons';
import { formatFortnightPeriodTitle } from '@/lib/fortnight-calendar';
import { seedDefaultCategoriesForOwner } from '@/lib/finance/category-seed.service';
import { generateOnboardingFortnights } from '@/lib/finance/onboarding-fortnights';
import {
  onboardingCompleteSchema,
  type OnboardingCompletePayload,
} from '@/schemas/onboarding.schema';

type WalletPayload = OnboardingCompletePayload['wallets'][number];

type FortnightPeriod = 'FIRST' | 'SECOND';

/** Seeding ~10 wallets/templates plus 4 fortnights against a remote DB. */
const ONBOARDING_TRANSACTION_OPTIONS = { maxWait: 5_000, timeout: 20_000 };

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

    const parsed = onboardingCompleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: parsed.error.issues[0]?.message ?? 'Datos de configuración inválidos',
        },
        { status: 400 },
      );
    }

    const payload = parsed.data;
    const startYmd = payload.startDate ?? null;

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
            amount: wallet.type === 'CREDIT' ? 0 : wallet.initialBalance,
            // Credit cards must carry a line and statement days (DB check).
            credit_limit: wallet.type === 'CREDIT' ? wallet.creditLimit : null,
            cutoff_day: wallet.type === 'CREDIT' ? wallet.cutoffDay : null,
            due_day: wallet.type === 'CREDIT' ? wallet.dueDay : null,
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
            source: income.source || null,
            applies_first_fortnight: !!income.appliesFirstFortnight,
            applies_second_fortnight: !!income.appliesSecondFortnight,
            active: true,
            user_id: userId,
            house_id: null,
            category_id: defaultIncomeCategoryId,
            wallet_id: walletIdMap.get(income.walletId) ?? null,
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
        const generatedFortnights = generateOnboardingFortnights(startYmd).map(
          (f) => ({
            ...f,
            label: formatFortnightPeriodTitle(f.period, f.month, f.year),
          }),
        );

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
    }, ONBOARDING_TRANSACTION_OPTIONS);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Onboarding completion failed:', error);

    return NextResponse.json(
      {
        success: false,
        message: 'No pudimos crear tu panel. Inténtalo de nuevo.',
      },
      { status: 500 },
    );
  }
}

