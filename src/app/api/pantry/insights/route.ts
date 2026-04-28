import { NextRequest, NextResponse } from 'next/server';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import prisma from '@/lib/prisma';
import { pantryReceiptOwnerWhere } from '@/lib/server/pantry/pantry-receipt-owner';
import { computePantryInsights } from '@/lib/server/pantry/compute-pantry-insights';

const PRICE_CHANGE_LIMIT = 12;

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;

    const receipts = await prisma.pantryReceipt.findMany({
      where: pantryReceiptOwnerWhere(context.ownerType, context.ownerId),
      orderBy: { created_at: 'desc' },
      select: {
        title: true,
        grand_total: true,
        currency: true,
        store: true,
        purchased_at: true,
        created_at: true,
        lines: {
          select: {
            description: true,
            quantity: true,
            line_total: true,
            unit_price: true,
          },
        },
      },
    });

    const insights = computePantryInsights(receipts, {
      topProductsLimit: 12,
    });

    return NextResponse.json(
      {
        ...insights,
        price_increases: insights.price_increases.slice(0, PRICE_CHANGE_LIMIT),
        price_decreases: insights.price_decreases.slice(0, PRICE_CHANGE_LIMIT),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('pantry insights GET', error);
    return NextResponse.json(
      { error: 'No se pudieron calcular las métricas de despensa' },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
