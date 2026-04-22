import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  createWalletSchema,
  updateWalletSchema,
} from '@/schemas/wallet.schema';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import {
  listWalletsByOwner,
  createWalletForOwner,
  updateWalletMetadataForOwner,
  deleteWalletIfUnusedForOwner,
} from '@/lib/finance/wallet.service';

export async function GET(request: NextRequest) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerFilter } = context;

    const wallets = await listWalletsByOwner(ownerFilter);
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
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerType, ownerId } = context;

    const body = await request.json();
    const validatedData = createWalletSchema.parse(body);

    const wallet = await createWalletForOwner(ownerType, ownerId, validatedData);
    return NextResponse.json(wallet, { status: 201 });
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
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerFilter } = context;

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

    const wallet = await updateWalletMetadataForOwner(id, parsedData, ownerFilter);

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
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerFilter } = context;

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
      await deleteWalletIfUnusedForOwner(id, ownerFilter);
    } catch (error) {
      if (
        error != null &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code: string }).code === 'WALLET_IN_USE'
      ) {
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

export async function PATCH(request: NextRequest) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerFilter } = context;

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

    const wallet = await updateWalletMetadataForOwner(id, parsedData, ownerFilter);

    return NextResponse.json(wallet, { status: 200 });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Wallet not found' },
        { status: 404 }
      )
    }

    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2003') {
      return NextResponse.json(
        { error: 'Cannot delete Wallet with related records' },
        { status: 409 }
      )
    }

    console.error('Error deleting Wallet:', error)
    return NextResponse.json(
      { error: 'Failed to update Wallet' },
      { status: 500 }
    )
  }
}