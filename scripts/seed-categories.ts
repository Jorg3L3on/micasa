/**
 * Merge the default category catalog into owners without wiping other data.
 *
 * - Empty owners: full catalog clone
 * - Existing owners: reuse matching names as roots (fathers); create only missing roots/children
 *
 * Usage:
 *   npm run seed:categories
 *   npm run seed:categories -- --dry-run
 *   npm run seed:categories -- --user-id=1
 *   npm run seed:categories -- --house-id=3
 */
import prisma from '../src/lib/prisma';
import {
  ensureDefaultCategoriesForOwner,
  type CategoryOwnerRef,
  type EnsureCategoriesResult,
} from '../src/lib/finance/category-seed.service';

const parseArgs = () => {
  const dryRun = process.argv.includes('--dry-run');
  const userArg = process.argv.find((arg) => arg.startsWith('--user-id='));
  const houseArg = process.argv.find((arg) => arg.startsWith('--house-id='));
  const userId = userArg ? Number(userArg.split('=')[1]) : undefined;
  const houseId = houseArg ? Number(houseArg.split('=')[1]) : undefined;

  if (userArg && (!Number.isFinite(userId) || userId! <= 0)) {
    throw new Error(`Invalid --user-id: ${userArg}`);
  }
  if (houseArg && (!Number.isFinite(houseId) || houseId! <= 0)) {
    throw new Error(`Invalid --house-id: ${houseArg}`);
  }
  if (userArg && houseArg) {
    throw new Error('Pass only one of --user-id or --house-id');
  }

  return {
    dryRun,
    userId: userId != null && Number.isFinite(userId) ? userId : undefined,
    houseId: houseId != null && Number.isFinite(houseId) ? houseId : undefined,
  };
};

const labelFor = (owner: CategoryOwnerRef) =>
  'userId' in owner ? `user:${owner.userId}` : `house:${owner.houseId}`;

const logResult = (label: string, result: EnsureCategoriesResult) => {
  console.log(
    `  ${label}: created=${result.created} reusedRoots=${result.reusedRoots} skippedExisting=${result.skippedExisting}`,
  );
};

async function resolveOwners(opts: {
  userId?: number;
  houseId?: number;
}): Promise<CategoryOwnerRef[]> {
  if (opts.userId != null) {
    const user = await prisma.user.findUnique({
      where: { id: opts.userId },
      select: { id: true },
    });
    if (!user) throw new Error(`User ${opts.userId} not found`);
    return [{ userId: user.id }];
  }

  if (opts.houseId != null) {
    const house = await prisma.house.findUnique({
      where: { id: opts.houseId },
      select: { id: true },
    });
    if (!house) throw new Error(`House ${opts.houseId} not found`);
    return [{ houseId: house.id }];
  }

  const [users, houses] = await Promise.all([
    prisma.user.findMany({ select: { id: true }, orderBy: { id: 'asc' } }),
    prisma.house.findMany({ select: { id: true }, orderBy: { id: 'asc' } }),
  ]);

  return [
    ...users.map((u) => ({ userId: u.id })),
    ...houses.map((h) => ({ houseId: h.id })),
  ];
}

async function main() {
  const { dryRun, userId, houseId } = parseArgs();
  const owners = await resolveOwners({ userId, houseId });

  console.log(
    `${dryRun ? 'Dry run' : 'Applying'} category catalog merge for ${owners.length} owner(s)`,
  );

  let totalCreated = 0;
  let totalReused = 0;
  let totalSkipped = 0;

  for (const owner of owners) {
    const result = dryRun
      ? await ensureDefaultCategoriesForOwner(prisma, owner, { dryRun: true })
      : await prisma.$transaction((tx) =>
          ensureDefaultCategoriesForOwner(tx, owner),
        );

    logResult(labelFor(owner), result);
    totalCreated += result.created;
    totalReused += result.reusedRoots;
    totalSkipped += result.skippedExisting;
  }

  console.log(
    `\nTotals: created=${totalCreated} reusedRoots=${totalReused} skippedExisting=${totalSkipped}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
