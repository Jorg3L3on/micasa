import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import {
  createInstallmentPlan,
  listInstallmentPlansForCard,
} from '@/lib/finance/credit-card-installment-plan.service';
import { createCreditCardInstallmentPlanSchema } from '@/schemas/credit-card-installment-plan.schema';

type RouteParams = { params: Promise<{ id: string }> };

const parseWalletId = async (params: RouteParams['params']) => {
  const { id } = await params;
  const walletId = Number(id);
  if (!id || !Number.isFinite(walletId) || walletId <= 0) {
    return null;
  }
  return walletId;
};

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const context = await getOwnerContext(_request);
    if ('error' in context) return context.error;

    const walletId = await parseWalletId(params);
    if (walletId == null) {
      return NextResponse.json(
        { error: 'Valid id parameter is required' },
        { status: 400 },
      );
    }

    const items = await listInstallmentPlansForCard(
      walletId,
      context.ownerFilter,
      { activeOnly: true },
    );
    return NextResponse.json({ items }, { status: 200 });
  } catch (error) {
    console.error('Error listing installment plans:', error);
    return NextResponse.json(
      { error: 'Failed to list installment plans' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;

    const walletId = await parseWalletId(params);
    if (walletId == null) {
      return NextResponse.json(
        { error: 'Valid id parameter is required' },
        { status: 400 },
      );
    }

    const body = await request.json();
    const validated = createCreditCardInstallmentPlanSchema.parse(body);
    const item = await createInstallmentPlan(
      walletId,
      context.ownerFilter,
      validated,
    );

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 },
      );
    }

    const code = (error as { code?: string }).code;
    if (code === 'WALLET_NOT_FOUND') {
      return NextResponse.json({ error: (error as Error).message }, { status: 404 });
    }
    if (code === 'INSUFFICIENT_CREDIT') {
      return NextResponse.json({ error: (error as Error).message }, { status: 400 });
    }

    console.error('Error creating installment plan:', error);
    return NextResponse.json(
      { error: 'Failed to create installment plan' },
      { status: 500 },
    );
  }
}
