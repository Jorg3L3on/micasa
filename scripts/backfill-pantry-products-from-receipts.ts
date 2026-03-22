import 'dotenv/config';

import prisma from '@/lib/prisma';
import { backfillPantryProductsFromAllReceipts } from '@/lib/server/pantry/sync-pantry-products-from-lines';

const main = async () => {
  const { receiptCount } = await backfillPantryProductsFromAllReceipts();
  console.log(`Backfill done. Receipts processed: ${receiptCount}`);
  await prisma.$disconnect();
  process.exit(0);
};

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
