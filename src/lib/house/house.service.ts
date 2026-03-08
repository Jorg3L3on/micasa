import prisma from '@/lib/prisma';
import { HouseRole } from '@/generated/prisma/client';
import type { HouseSummary } from '@/types/house';

export const createHouse = async (
  userId: number,
  name: string
): Promise<{ id: number; name: string; owner_id: number | null }> => {
  return prisma.$transaction(async (tx) => {
    const house = await tx.house.create({
      data: {
        name: name.trim(),
        owner_id: userId,
      },
    });

    await tx.houseMember.create({
      data: {
        house_id: house.id,
        user_id: userId,
        role: HouseRole.OWNER,
      },
    });

    return house;
  });
};

export const listUserHouses = async (userId: number): Promise<HouseSummary[]> => {
  const memberships = await prisma.houseMember.findMany({
    where: { user_id: userId },
    include: { house: true },
  });

  return memberships.map((m) => ({
    id: m.house.id,
    name: m.house.name,
    role: m.role,
  }));
};

export const getHouseIfMember = async (
  userId: number,
  houseId: number
): Promise<{ id: number; name: string; owner_id: number | null } | null> => {
  const membership = await prisma.houseMember.findFirst({
    where: {
      user_id: userId,
      house_id: houseId,
    },
    include: { house: true },
  });

  if (!membership) return null;

  return membership.house;
};
