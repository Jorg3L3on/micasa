import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { createWalletForUser } from '@/lib/finance/wallet.service';

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const userId = Number(session.user.id);
  if (isNaN(userId)) {
    return NextResponse.json(
      { error: 'Usuario inválido' },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.json(
      { error: 'No autorizado' },
      { status: 401 },
    );
  }

  const existingWallet = await prisma.wallet.findFirst({
    where: {
      user_id: userId,
      house_id: null,
    },
  });

  if (existingWallet) {
    await prisma.user.update({
      where: { id: userId },
      data: { onboarding_completed: true },
    });
    return NextResponse.json(
      { completed: true, walletCreated: false },
      { status: 200 },
    );
  }

  await createWalletForUser(userId, {
    name: 'Cash',
    amount: 0,
    type: 'CASH',
    active: true,
    cutoff_day: null,
    due_day: null,
  });

  await prisma.user.update({
    where: { id: userId },
    data: { onboarding_completed: true },
  });

  return NextResponse.json(
    { completed: true, walletCreated: true },
    { status: 200 },
  );
}
