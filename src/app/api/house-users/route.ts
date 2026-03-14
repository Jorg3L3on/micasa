import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import prisma from '@/lib/prisma';

const addHouseUserSchema = z.object({
  email: z.string().email(),
});

/**
 * GET /api/house-users?ownerType=house&ownerId=number
 * Returns users that are members of the given house.
 * Requires ownerType === "house".
 */
export async function GET(request: NextRequest) {
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

    const memberships = await prisma.houseMember.findMany({
      where: { house_id: ownerId },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    const users = memberships.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
    }));

    return NextResponse.json({ users, role }, { status: 200 });
  } catch (error) {
    console.error('Error fetching house users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch house users' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/house-users?ownerType=house&ownerId=number
 * Adds a user to the house by email.
 * Body: { email: string }
 * Requires ownerType === "house".
 */
export async function POST(request: NextRequest) {
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
        { error: 'Only the house owner can add users' },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { email } = addHouseUserSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User with this email does not exist' },
        { status: 400 },
      );
    }

    const existingMembership = await prisma.houseMember.findFirst({
      where: {
        house_id: ownerId,
        user_id: user.id,
      },
    });

    if (existingMembership) {
      return NextResponse.json(
        { error: 'User already belongs to this house' },
        { status: 409 },
      );
    }

    await prisma.houseMember.create({
      data: {
        house_id: ownerId,
        user_id: user.id,
      },
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 },
      );
    }
    console.error('Error adding house user:', error);
    return NextResponse.json(
      { error: 'Failed to add house user' },
      { status: 500 },
    );
  }
}
