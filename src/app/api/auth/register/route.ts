import { NextRequest, NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import prisma from '@/lib/prisma';
import { HouseRole } from '@/generated/prisma/client';
import {
  GENERIC_REGISTER_ERROR_MESSAGE,
  registerSchema,
} from '@/schemas/auth.schema';
import { enforceRateLimit } from '@/lib/server/rate-limit';

export async function POST(request: NextRequest) {
  const limited = await enforceRateLimit(request, 'auth:register');
  if (limited) return limited;

  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return NextResponse.json(
        { error: first?.message ?? 'Datos inválidos' },
        { status: 400 }
      );
    }

    const { name, email, password } = parsed.data;

    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      return NextResponse.json(
        { error: GENERIC_REGISTER_ERROR_MESSAGE },
        { status: 400 }
      );
    }

    const hashedPassword = await hash(password, 10);
    const houseName = `Casa de ${name}`;

    const { user, house } = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
        },
      });

      const h = await tx.house.create({
        data: {
          name: houseName,
          owner_id: u.id,
        },
      });

      await tx.houseMember.create({
        data: {
          house_id: h.id,
          user_id: u.id,
          role: HouseRole.OWNER,
        },
      });

      return { user: u, house: h };
    });

    return NextResponse.json(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        house: { id: house.id, name: house.name },
      },
      { status: 201 }
    );
  } catch (e) {
    console.error('Register error:', e);
    return NextResponse.json(
      { error: 'Error al crear la cuenta. Inténtalo de nuevo.' },
      { status: 500 }
    );
  }
}
