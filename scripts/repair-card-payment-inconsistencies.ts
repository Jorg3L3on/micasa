/**
 * Repairs common card payment inconsistencies (stale plans, wallet drift, tampered expenses).
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.json scripts/repair-card-payment-inconsistencies.ts
 *   npx tsx --tsconfig tsconfig.json scripts/repair-card-payment-inconsistencies.ts --dry-run
 *   npx tsx --tsconfig tsconfig.json scripts/repair-card-payment-inconsistencies.ts --wallet-id=3
 */
import prisma from '../src/lib/prisma';
import type { OwnerFilter } from '../src/lib/server/get-owner-context';
import {
  getCreditCardReconciliationReport,
  repairCreditCardReconciliationIssues,
} from '../src/lib/finance/credit-card-reconciliation.service';

const parseArgs = () => {
  const dryRun = process.argv.includes('--dry-run');
  const walletArg = process.argv.find((arg) => arg.startsWith('--wallet-id='));
  const walletId = walletArg ? Number(walletArg.split('=')[1]) : undefined;
  const userArg = process.argv.find((arg) => arg.startsWith('--user-id='));
  const userId = userArg ? Number(userArg.split('=')[1]) : 1;
  const ownerFilter: OwnerFilter = { user_id: userId, house_id: null };
  return {
    dryRun,
    walletId: Number.isFinite(walletId) ? walletId : undefined,
    ownerFilter,
  };
};

async function main() {
  const { dryRun, walletId, ownerFilter } = parseArgs();

  const report = await getCreditCardReconciliationReport(ownerFilter, walletId);
  console.log(`Found ${report.summary.total} issue(s), ${report.summary.repairable} repairable.`);

  if (report.issues.length > 0) {
    for (const issue of report.issues) {
      console.log(
        `- [${issue.severity}] ${issue.kind} · ${issue.walletName}: ${issue.message}`,
      );
    }
  }

  const result = await repairCreditCardReconciliationIssues(ownerFilter, {
    dryRun,
    walletId,
    kinds: ['stale_covered_plan', 'wallet_debt_drift', 'tampered_generated_expense'],
  });

  console.log(`\n${dryRun ? 'Dry run' : 'Applied'} repairs:`);
  if (result.repaired.length === 0) {
    console.log('  (none)');
  } else {
    for (const line of result.repaired) {
      console.log(`  ✓ ${line}`);
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
