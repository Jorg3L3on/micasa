import { NextRequest, NextResponse } from 'next/server';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import prisma from '@/lib/prisma';
import {
  computeMovementTotals,
  listWalletMovements,
} from '@/lib/finance/wallet-movements';
import type {
  WalletDetail,
  WalletMovementsResponse,
} from '@/types/wallet-movements';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function firstDayOfMonth(now: Date): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

function lastDayOfMonth(now: Date): string {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerFilter } = context;

    const { id } = await params;
    const walletId = Number(id);
    if (!Number.isFinite(walletId) || walletId <= 0) {
      return NextResponse.json(
        { error: 'Invalid wallet id' },
        { status: 400 },
      );
    }

    const wallet = await prisma.wallet.findFirst({
      where: { id: walletId, ...ownerFilter },
    });
    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet not found' },
        { status: 404 },
      );
    }

    const { searchParams } = new URL(request.url);
    const now = new Date();
    const fromRaw = searchParams.get('from') ?? firstDayOfMonth(now);
    const toRaw = searchParams.get('to') ?? lastDayOfMonth(now);
    if (!DATE_RE.test(fromRaw) || !DATE_RE.test(toRaw)) {
      return NextResponse.json(
        { error: 'Invalid from/to dates' },
        { status: 400 },
      );
    }

    const movements = await listWalletMovements(
      walletId,
      ownerFilter,
      fromRaw,
      toRaw,
    );
    const totals = computeMovementTotals(movements);

    const walletDetail: WalletDetail = {
      id: wallet.id,
      name: wallet.name,
      provider_icon_key: wallet.provider_icon_key ?? null,
      type: wallet.type,
      amount: Number(wallet.amount),
      credit_limit: wallet.credit_limit == null ? null : Number(wallet.credit_limit),
      active: wallet.active,
    };

    const response: WalletMovementsResponse = {
      wallet: walletDetail,
      range: { from: fromRaw, to: toRaw },
      movements,
      totals,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Error fetching wallet movements:', error);
    return NextResponse.json(
      { error: 'Failed to fetch wallet movements' },
      { status: 500 },
    );
  }
}
