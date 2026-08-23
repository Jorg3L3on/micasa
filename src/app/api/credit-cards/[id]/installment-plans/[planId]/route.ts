import { NextRequest, NextResponse } from 'next/server';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import { deleteInstallmentPlan } from '@/lib/finance/credit-card-installment-plan.service';

type RouteParams = { params: Promise<{ id: string; planId: string }> };

const parseIds = async (params: RouteParams['params']) => {
  const { id, planId } = await params;
  const walletId = Number(id);
  const parsedPlanId = Number(planId);
  if (
    !id ||
    !planId ||
    !Number.isFinite(walletId) ||
    walletId <= 0 ||
    !Number.isFinite(parsedPlanId) ||
    parsedPlanId <= 0
  ) {
    return null;
  }
  return { walletId, planId: parsedPlanId };
};

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const context = await getOwnerContext(_request);
    if ('error' in context) return context.error;

    const ids = await parseIds(params);
    if (ids == null) {
      return NextResponse.json(
        { error: 'Valid id and planId parameters are required' },
        { status: 400 },
      );
    }

    await deleteInstallmentPlan(
      ids.planId,
      ids.walletId,
      context.ownerFilter,
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === 'NOT_FOUND') {
      return NextResponse.json({ error: (error as Error).message }, { status: 404 });
    }

    console.error('Error deleting installment plan:', error);
    return NextResponse.json(
      { error: 'Failed to delete installment plan' },
      { status: 500 },
    );
  }
}
