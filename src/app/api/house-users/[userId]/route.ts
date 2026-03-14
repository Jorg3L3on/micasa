import { NextRequest, NextResponse } from 'next/server';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import prisma from '@/lib/prisma';

/**
 * DELETE /api/house-users/[userId]?ownerType=house&ownerId=number
 * Removes a user from the house (deletes the membership).
 * Requires ownerType === "house".
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerType, ownerId, role } = context;

    if (ownerType !== 'house') {
      return NextResponse.json(
        { error: 'House context required' },
        { status: 400 },
      );
    }

    if (role !== 'owner') {
      return NextResponse.json(
        { error: 'Only the house owner can remove users' },
        { status: 403 },
      );
    }

    const { userId } = await params;
    const userIdNum = Number(userId);

    if (!userId || Number.isNaN(userIdNum)) {
      return NextResponse.json(
        { error: 'Valid userId parameter is required' },
        { status: 400 },
      );
    }

    await prisma.houseMember.deleteMany({
      where: {
        house_id: ownerId,
        user_id: userIdNum,
      },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error deleting house member:', error);
    return NextResponse.json(
      { error: 'Failed to delete house member' },
      { status: 500 },
    );
  }
}
