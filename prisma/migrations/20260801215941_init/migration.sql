-- AlterTable
ALTER TABLE "BudgetPeriodSnapshot" ALTER COLUMN "created_at" SET DEFAULT timezone('America/Mexico_City'::text, now());

-- AlterTable
ALTER TABLE "BudgetPeriodSnapshotAllocation" ALTER COLUMN "created_at" SET DEFAULT timezone('America/Mexico_City'::text, now());
