import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createWalletSchema } from "@/schemas/wallet.schema";

export async function GET() {
  try {
    const wallets = await prisma.wallet.findMany({
      orderBy: [
        {
          status: 'desc',
        },
        {
          name: 'asc'
        }
      ],
    });
    return NextResponse.json(wallets, { status: 200 })
  } catch (error) {
    console.error('Error fetching wallets:', error)
    return NextResponse.json(
      { error: 'Failed to fetch wallets', status: 500 },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = createWalletSchema.parse(body)

    const wallet = await prisma.wallet.create({
      data: {
        name: validatedData.name,
        amount: validatedData.amount,
        type: validatedData.type,
        status: validatedData.status,
        cutoff_day: validatedData.cutoff_day,
        due_day: validatedData.due_day
      },
    })

    return NextResponse.json(wallet, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      )
    }

    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Wallet with this name already exists' },
        { status: 409 }
      )
    }

    console.error('Error creating wallet:', error)
    return NextResponse.json(
      { error: 'Failed to create wallet', status: 500 },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = Number(searchParams.get('id'))

    if (!id || isNaN(id)) {
      return NextResponse.json(
        { error: 'Valid id parameter is required' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const parsedData = createWalletSchema.parse(body)

    const wallet = await prisma.wallet.update({
      where: { id },
      data: parsedData,
    })

    return NextResponse.json(wallet, { status: 200 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      )
    }

    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Wallet not found' },
        { status: 404 }
      )
    }

    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Wallet with this name already exists' },
        { status: 409 }
      )
    }

    console.error('Error updating wallet:', error)
    return NextResponse.json(
      { error: 'Failed to update wallet' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = Number(searchParams.get('id'))

    if (!id || isNaN(id)) {
      return NextResponse.json(
        { error: 'Valid id parameter is required' },
        { status: 400 }
      )
    }

    await prisma.wallet.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Wallet deleted successfully' }, { status: 200 })
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
      { error: 'Failed to delete Wallet' },
      { status: 500 }
    )
  }
}
