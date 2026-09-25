/**
 * Round-trip of `@db.Date` columns through the real Prisma client and its
 * timestamp shim.
 *
 * Local run (Postgres must be up; see AGENTS.md):
 *   sudo pg_ctlcluster 16 main start
 *   npx prisma migrate deploy
 *   npm test -- src/lib/database-timestamps.integration.test.ts
 *
 * CI without a reachable database skips this file. The shim itself is still
 * covered by `database-timestamps.test.ts`, which uses the same transform the
 * Prisma extension calls and the schema-derived DATE column set.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { formatStoredDateOnly, parseDateOnly } from '@/lib/calendar-dates';
import prisma from '@/lib/prisma';

const CIVIL_DAY = '2026-09-12';

const databaseUrl = process.env.DATABASE_URL ?? '';
const databaseConfigured =
  databaseUrl.length > 0 && !databaseUrl.includes('prisma:prisma@127.0.0.1');

const canReachDatabase = async (): Promise<boolean> => {
  if (!databaseConfigured) return false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
};

const roundTripDateColumns = async (timeZone: string) => {
  const previous = process.env.TZ;
  process.env.TZ = timeZone;
  const stamp = Date.now();
  const email = `date-shim-${timeZone.replace(/\//g, '-')}-${stamp}@example.test`;
  const user = await prisma.user.create({
    data: {
      name: 'Date Shim',
      email,
      password: 'synthetic',
    },
  });
  const wallet = await prisma.wallet.create({
    data: {
      name: 'Tarjeta sintetica',
      type: 'CREDIT_CARD',
      cutoff_day: 12,
      due_day: 20,
      user_id: user.id,
    },
  });
  const fortnight = await prisma.fortnight.create({
    data: {
      start_date: parseDateOnly('2026-09-01'),
      end_date: parseDateOnly('2026-09-14'),
      label: 'Q1',
      month: 9,
      year: 2026,
      period: 'FIRST',
      user_id: user.id,
    },
  });
  const written = parseDateOnly(CIVIL_DAY);
  try {
    const created = await prisma.creditCardPaymentPlan.create({
      data: {
        credit_card_wallet_id: wallet.id,
        fortnight_id: fortnight.id,
        planned_amount: 10,
        scope: 'UNTIL_DATE',
        valid_until: written,
        anchor_statement_end: written,
        user_id: user.id,
      },
    });
    const read = await prisma.creditCardPaymentPlan.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(formatStoredDateOnly(read.anchor_statement_end!)).toBe(CIVIL_DAY);
    expect(formatStoredDateOnly(read.valid_until!)).toBe(CIVIL_DAY);
    expect(read.anchor_statement_end!.toISOString().slice(0, 10)).toBe(CIVIL_DAY);
    expect(read.valid_until!.toISOString().slice(0, 10)).toBe(CIVIL_DAY);
  } finally {
    await prisma.creditCardPaymentPlan.deleteMany({
      where: { credit_card_wallet_id: wallet.id },
    });
    await prisma.fortnight.delete({ where: { id: fortnight.id } });
    await prisma.wallet.delete({ where: { id: wallet.id } });
    await prisma.user.delete({ where: { id: user.id } });
    if (previous == null) delete process.env.TZ;
    else process.env.TZ = previous;
  }
};

describe('planned payment DATE columns through Prisma', () => {
  it('keeps the civil day under UTC and America/Mexico_City', async () => {
    if (!(await canReachDatabase())) return;
    await roundTripDateColumns('UTC');
    await roundTripDateColumns('America/Mexico_City');
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
