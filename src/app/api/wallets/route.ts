import prisma from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  createWalletSchema,
  updateWalletSchema,
} from '@/schemas/wallet.schema';
import {
  listWallets,
  createWalletForDefaultUser,
  updateWalletMetadata,
  deleteWalletIfUnused,
} from '@/lib/finance/wallet.service';

export async function GET() {
  try {
    const wallets = await listWallets();
    return NextResponse.json(wallets, { status: 200 });
  } catch (error) {
    console.error('Error fetching wallets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch wallets', status: 500 },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = createWalletSchema.parse(body);

    try {
      const wallet = await createWalletForDefaultUser(validatedData);
      return NextResponse.json(wallet, { status: 201 });
    } catch (error: any) {
      if (error.code === 'NO_DEFAULT_USER') {
        return NextResponse.json(
          { error: 'No active user found to own wallet' },
          { status: 400 },
        );
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 },
      );
    }

    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'Wallet with this name already exists' },
        { status: 409 },
      );
    }

    console.error('Error creating wallet:', error);
    return NextResponse.json(
      { error: 'Failed to create wallet', status: 500 },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const idParam = searchParams.get('id');
    if (!idParam || isNaN(Number(idParam))) {
      return NextResponse.json(
        { error: 'Valid id parameter is required' },
        { status: 400 },
      );
    }
    const id = Number(idParam);

    const body = await request.json();
    const parsedData = updateWalletSchema.parse(body);

    const wallet = await updateWalletMetadata(id, parsedData);

    return NextResponse.json(wallet, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 },
      );
    }

    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2025'
    ) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'Wallet with this name already exists' },
        { status: 409 },
      );
    }

    console.error('Error updating wallet:', error);
    return NextResponse.json(
      { error: 'Failed to update wallet' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const idParam = searchParams.get('id');
    if (!idParam || isNaN(Number(idParam))) {
      return NextResponse.json(
        { error: 'Valid id parameter is required' },
        { status: 400 },
      );
    }
    const id = Number(idParam);

    try {
      await deleteWalletIfUnused(id);
    } catch (error: any) {
      if (error.code === 'WALLET_IN_USE') {
        return NextResponse.json(
          {
            error:
              'La cartera tiene gastos o plantillas asociadas y no puede eliminarse',
          },
          { status: 409 },
        );
      }
      throw error;
    }

    return NextResponse.json(
      { message: 'Wallet deleted successfully' },
      { status: 200 },
    );
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2025'
    ) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    console.error('Error deleting Wallet:', error);
    return NextResponse.json(
      { error: 'Failed to delete Wallet' },
      { status: 500 },
    );
  }
}
