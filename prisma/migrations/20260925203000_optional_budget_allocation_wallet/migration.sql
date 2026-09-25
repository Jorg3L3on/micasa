-- Make budget allocation wallets optional.
-- Existing wallet ids are left as they are. Null means "Cualquier cartera".

ALTER TABLE "BudgetAllocation" ALTER COLUMN "wallet_id" DROP NOT NULL;

ALTER TABLE "BudgetPeriodSnapshotAllocation" ALTER COLUMN "wallet_id" DROP NOT NULL;
