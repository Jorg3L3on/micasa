import { coerceToCalendarDate } from '@/lib/calendar-dates';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import prisma from '@/lib/prisma';
import { resolveOrCreateFortnight } from '@/lib/fortnights';
import { createUserToHouseTransfer } from '@/lib/finance/transfer.service';
import { applyWalletAmountDelta } from '@/lib/finance/wallet-accounting';
import { dateStringSchema } from '@/schemas/common.schema';
import {
  assertOwnedCategoryOfKind,
  CategoryServiceError,
} from '@/lib/finance/category.service';
import { getCalendarFortnightRefForYmd } from '@/lib/fortnight-calendar';
import {
  assertIncomeFundingWallet,
  IncomeServiceError,
  resolveIncomeWalletId,
} from '@/lib/finance/income.service';

const createIncomeSchema = z
  .object({
    fortnight_id: z.number().int().positive().optional(),
    amount: z.number().positive('Amount must be greater than 0'),
    source: z.string().optional().nullable(),
    received_at: dateStringSchema,
    transfer_from_user_id: z.number().int().positive().optional(),
    income_template_id: z.number().int().positive().optional().nullable(),
    wallet_id: z.number().int().positive().optional(),
    category_id: z.number().int().positive('La categoría es requerida'),
    /** Fortnight income only. Stores the wallet and leaves its balance unchanged. */
    planned: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.planned === true) {
      if (data.wallet_id == null) {
        ctx.addIssue({
          code: 'custom',
          message: 'La billetera es requerida',
          path: ['wallet_id'],
        });
      }
      return;
    }
    if (data.fortnight_id == null) {
      ctx.addIssue({
        code: 'custom',
        message: 'fortnight_id is required',
        path: ['fortnight_id'],
      });
    }
    if (data.wallet_id == null) {
      ctx.addIssue({
        code: 'custom',
        message: 'La billetera es requerida',
        path: ['wallet_id'],
      });
    }
  });

const updateIncomeAmountSchema = z.object({
  amount: z.number().min(0, 'El monto debe ser mayor o igual a 0'),
  /** Required when the income has no wallet yet; cannot be cleared once set. */
  wallet_id: z.number().int().positive().optional(),
  force_wallet_credit: z.boolean().optional(),
  /** Required when the income has no category yet. */
  category_id: z.number().int().positive().optional(),
});

function serializeIncome(i: {
  id: number;
  amount: unknown;
  source: string | null;
  received_at: Date;
  fortnight_id: number;
  income_template_id: number | null;
  wallet_id: number | null;
  category_id: number | null;
}) {
  return {
    id: i.id,
    amount: Number(i.amount),
    source: i.source,
    received_at: i.received_at,
    fortnight_id: i.fortnight_id,
    income_template_id: i.income_template_id,
    wallet_id: i.wallet_id,
    category_id: i.category_id,
  };
}

export async function GET(request: NextRequest) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerFilter } = context;

    const { searchParams } = new URL(request.url);
    const fortnightIdRaw = searchParams.get('fortnightId');
    const fortnightId = fortnightIdRaw ? parseInt(fortnightIdRaw, 10) : NaN;
    if (Number.isNaN(fortnightId) || fortnightId < 1) {
      return NextResponse.json(
        { error: 'Valid fortnightId parameter is required' },
        { status: 400 },
      );
    }

    const incomes = await prisma.income.findMany({
      where: { ...ownerFilter, fortnight_id: fortnightId },
      orderBy: { received_at: 'asc' },
    });

    return NextResponse.json(incomes.map(serializeIncome), {
      status: 200,
    });
  } catch (error) {
    console.error('Error fetching incomes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch incomes' },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerFilter, ownerType, ownerId } = context;

    const { searchParams } = new URL(request.url);
    const idRaw = searchParams.get('id');
    const id = idRaw ? parseInt(idRaw, 10) : NaN;
    if (Number.isNaN(id) || id < 1) {
      return NextResponse.json(
        { error: 'Valid id parameter is required' },
        { status: 400 },
      );
    }

    const body = await request.json();
    const validated = updateIncomeAmountSchema.parse(body);

    const income = await prisma.income.findFirst({
      where: { id, ...ownerFilter },
    });
    if (!income) {
      return NextResponse.json(
        { error: 'Income not found' },
        { status: 404 },
      );
    }

    const oldAmount = Number(income.amount);
    const newAmount = validated.amount;

    let nextCategoryId = income.category_id;
    if (validated.category_id !== undefined) {
      await assertOwnedCategoryOfKind(
        prisma,
        ownerType,
        ownerId,
        validated.category_id,
        'INCOME',
      );
      nextCategoryId = validated.category_id;
    } else if (income.category_id == null) {
      return NextResponse.json(
        {
          error:
            'La categoría es requerida. Asigna una categoría de ingreso a este registro.',
        },
        { status: 400 },
      );
    }

    const oldWalletId = income.wallet_id;
    const wasCredited =
      income.wallet_credited === true ||
      (income.wallet_credited == null && oldWalletId != null);
    const newWalletId = resolveIncomeWalletId(oldWalletId, validated.wallet_id);

    const fundingWallet = await prisma.wallet.findFirst({
      where: { id: newWalletId, ...ownerFilter },
      select: { id: true, type: true },
    });
    assertIncomeFundingWallet(fundingWallet);

    const updated = await prisma.$transaction(async (tx) => {
      if (!wasCredited && newWalletId != null) {
        await applyWalletAmountDelta(tx, newWalletId, newAmount);
      } else if (wasCredited && oldWalletId != null && newWalletId != null) {
        if (oldWalletId === newWalletId) {
          if (validated.force_wallet_credit === true) {
            await applyWalletAmountDelta(tx, newWalletId, newAmount);
          } else {
            const delta = newAmount - oldAmount;
            if (delta !== 0) await applyWalletAmountDelta(tx, newWalletId, delta);
          }
        } else {
          await applyWalletAmountDelta(tx, oldWalletId, -oldAmount);
          await applyWalletAmountDelta(tx, newWalletId, newAmount);
        }
      }

      return tx.income.update({
        where: { id },
        data: {
          amount: newAmount,
          wallet_id: newWalletId,
          wallet_credited: true,
          category_id: nextCategoryId,
        },
      });
    });

    return NextResponse.json(serializeIncome(updated), { status: 200 });
  } catch (error) {
    if (error instanceof IncomeServiceError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    if (error instanceof CategoryServiceError || error instanceof IncomeServiceError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 },
      );
    }
    console.error('Error updating income amount:', error);
    return NextResponse.json(
      { error: 'Failed to update income amount' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerType, ownerId, ownerFilter } = context;

    const ownerData: { user_id?: number | null; house_id?: number | null } =
      ownerType === 'user'
        ? { user_id: ownerId, house_id: null }
        : { user_id: null, house_id: ownerId };

    const body = await request.json();
    const validated = createIncomeSchema.parse(body);

    await assertOwnedCategoryOfKind(
      prisma,
      ownerType,
      ownerId,
      validated.category_id,
      'INCOME',
    );

    if (validated.planned === true) {
      const plannedWalletId = validated.wallet_id;
      if (plannedWalletId == null) {
        return NextResponse.json(
          { error: 'La billetera es requerida' },
          { status: 400 },
        );
      }
      const plannedWallet = await prisma.wallet.findFirst({
        where: { id: plannedWalletId, ...ownerFilter },
        select: { id: true, type: true },
      });
      assertIncomeFundingWallet(plannedWallet);

      const ref = getCalendarFortnightRefForYmd(validated.received_at);
      const fortnight = await resolveOrCreateFortnight({
        ownerType,
        ownerId,
        year: ref.year,
        month: ref.month,
        period: ref.period,
      });
      const created = await prisma.income.create({
        data: {
          fortnight_id: fortnight.id,
          amount: validated.amount,
          source:
            validated.source && validated.source.length > 0
              ? validated.source
              : null,
          received_at: coerceToCalendarDate(validated.received_at),
          category_id: validated.category_id,
          wallet_id: plannedWalletId,
          ...ownerFilter,
        },
      });
      return NextResponse.json(serializeIncome(created), { status: 201 });
    }

    const fortnightId = validated.fortnight_id;
    const walletIdRequired = validated.wallet_id;
    if (fortnightId == null || walletIdRequired == null) {
      return NextResponse.json(
        { error: 'La quincena y la billetera son requeridas' },
        { status: 400 },
      );
    }

    const fortnight = await prisma.fortnight.findUnique({
      where: { id: fortnightId },
      select: {
        id: true,
        user_id: true,
        house_id: true,
        year: true,
        month: true,
        period: true,
      },
    });

    if (
      !fortnight ||
      (fortnight.user_id == null && fortnight.house_id == null) ||
      (fortnight.user_id != null && fortnight.house_id != null)
    ) {
      return NextResponse.json(
        { error: 'Invalid fortnight for this income' },
        { status: 400 },
      );
    }

    if (ownerType === 'user') {
      if (fortnight.user_id !== ownerId || fortnight.house_id != null) {
        return NextResponse.json(
          {
            error:
              'Fortnight does not belong to the same owner (user/house) as the income',
          },
          { status: 400 },
        );
      }
    } else if (fortnight.house_id !== ownerId || fortnight.user_id != null) {
      return NextResponse.json(
        {
          error:
            'Fortnight does not belong to the same owner (user/house) as the income',
        },
        { status: 400 },
      );
    }

    const transferFromUserId = validated.transfer_from_user_id;

    if (ownerType === 'house' && transferFromUserId != null) {
      const membership = await prisma.houseMember.findFirst({
        where: {
          house_id: ownerId,
          user_id: transferFromUserId,
        },
      });

      if (!membership) {
        return NextResponse.json(
          { error: 'User is not a member of this house' },
          { status: 400 },
        );
      }

      const userFortnight = await resolveOrCreateFortnight({
        ownerType: 'user',
        ownerId: transferFromUserId,
        year: fortnight.year,
        month: fortnight.month,
        period: fortnight.period,
      });

      const transfer = await createUserToHouseTransfer({
        userId: transferFromUserId,
        houseId: ownerId,
        amount: validated.amount,
        userFortnightId: userFortnight.id,
        houseFortnightId: fortnightId,
        note:
          validated.source && validated.source.length > 0
            ? validated.source
            : null,
        date: coerceToCalendarDate(validated.received_at),
        userWalletId: null,
        houseWalletId: walletIdRequired,
      });

      type TransferWithHouseIncome = {
        house_income: {
          id: number;
          amount: unknown;
          source: string | null;
          received_at: Date;
          fortnight_id: number;
          house_id: number;
          wallet_id: number | null;
          category_id: number | null;
        };
      };
      const houseIncome = (transfer as unknown as TransferWithHouseIncome)
        .house_income;

      const withCategory = await prisma.income.update({
        where: { id: houseIncome.id },
        data: { category_id: validated.category_id },
      });

      return NextResponse.json(
        {
          id: withCategory.id,
          amount: withCategory.amount,
          source: withCategory.source,
          received_at: withCategory.received_at,
          fortnight_id: withCategory.fortnight_id,
          house_id: withCategory.house_id,
          user_id: null,
          wallet_id: withCategory.wallet_id ?? null,
          category_id: withCategory.category_id,
        },
        { status: 201 },
      );
    }

    const walletId = walletIdRequired;

    const created = await prisma.$transaction(async (tx) => {
      const income = await tx.income.create({
        data: {
          fortnight_id: fortnightId,
          amount: validated.amount,
          source:
            validated.source && validated.source.length > 0
              ? validated.source
              : null,
          received_at: coerceToCalendarDate(validated.received_at),
          income_template_id: validated.income_template_id ?? null,
          wallet_id: walletId,
          wallet_credited: true,
          category_id: validated.category_id,
          ...ownerData,
        },
      });

      await applyWalletAmountDelta(tx, walletId, validated.amount);

      return income;
    });

    return NextResponse.json(serializeIncome(created), { status: 201 });
  } catch (error) {
    if (error instanceof CategoryServiceError || error instanceof IncomeServiceError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 },
      );
    }

    console.error('Error creating income:', error);
    return NextResponse.json(
      { error: 'Failed to create income' },
      { status: 500 },
    );
  }
}
