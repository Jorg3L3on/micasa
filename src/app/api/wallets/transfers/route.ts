import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import { createWalletTransferSchema } from '@/schemas/wallet-transfer.schema';
import {
  createWalletTransferForOwner,
  type WalletTransferCodedError,
} from '@/lib/finance/wallet-transfer.service';

export async function POST(request: NextRequest) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerFilter } = context;

    const body = await request.json();
    const data = createWalletTransferSchema.parse(body);

    const result = await createWalletTransferForOwner(ownerFilter, data);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.flatten() },
        { status: 400 },
      );
    }

    const coded = error as WalletTransferCodedError;
    if (coded?.code) {
      return NextResponse.json(
        { error: coded.message, code: coded.code },
        { status: coded.status ?? 400 },
      );
    }

    console.error('Error creating wallet transfer:', error);
    return NextResponse.json(
      { error: 'No se pudo completar la transferencia' },
      { status: 500 },
    );
  }
}
