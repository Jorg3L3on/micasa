/**
 * One-time fix: incomes that had wallet_id assigned during a buggy run
 * (where the wallet balance was never actually credited) need to be reset
 * to wallet_id = null so the next "Recibir quincena" flow properly credits them.
 */
import prisma from '../src/lib/prisma';

async function main() {
  const incomes = await prisma.income.findMany({
    where: { wallet_id: { not: null } },
    select: { id: true, amount: true, wallet_id: true, source: true },
  });

  if (incomes.length === 0) {
    console.log('No incomes with wallet_id found — nothing to reset.');
    return;
  }

  console.log(`Found ${incomes.length} income(s) with wallet_id set:`);
  for (const i of incomes) {
    console.log(`  id=${i.id} amount=${i.amount} source="${i.source}" wallet_id=${i.wallet_id}`);
  }

  const result = await prisma.income.updateMany({
    where: { wallet_id: { not: null } },
    data: { wallet_id: null },
  });

  console.log(`\nReset ${result.count} income(s) to wallet_id = null.`);
  console.log('Now run "Recibir quincena" again to properly credit the wallets.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
