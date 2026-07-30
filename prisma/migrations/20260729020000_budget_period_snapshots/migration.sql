-- CreateTable
CREATE TABLE "BudgetPeriodSnapshot" (
    "id" SERIAL NOT NULL,
    "budget_period_id" INTEGER NOT NULL,
    "budget_name" VARCHAR(25) NOT NULL,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BudgetPeriodSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetPeriodSnapshotAllocation" (
    "id" SERIAL NOT NULL,
    "snapshot_id" INTEGER NOT NULL,
    "wallet_id" INTEGER NOT NULL,
    "wallet_name" VARCHAR(100) NOT NULL,
    "category_id" INTEGER NOT NULL,
    "category_name" VARCHAR(100) NOT NULL,
    "category_icon" TEXT,
    "allocated_amount" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BudgetPeriodSnapshotAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BudgetPeriodSnapshot_budget_period_id_key" ON "BudgetPeriodSnapshot"("budget_period_id");

-- CreateIndex
CREATE INDEX "BudgetPeriodSnapshotAllocation_snapshot_id_idx" ON "BudgetPeriodSnapshotAllocation"("snapshot_id");

-- CreateIndex
CREATE INDEX "BudgetPeriodSnapshotAllocation_wallet_id_idx" ON "BudgetPeriodSnapshotAllocation"("wallet_id");

-- CreateIndex
CREATE INDEX "BudgetPeriodSnapshotAllocation_category_id_idx" ON "BudgetPeriodSnapshotAllocation"("category_id");

-- AddForeignKey
ALTER TABLE "BudgetPeriodSnapshot"
ADD CONSTRAINT "BudgetPeriodSnapshot_budget_period_id_fkey"
FOREIGN KEY ("budget_period_id") REFERENCES "BudgetPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetPeriodSnapshotAllocation"
ADD CONSTRAINT "BudgetPeriodSnapshotAllocation_snapshot_id_fkey"
FOREIGN KEY ("snapshot_id") REFERENCES "BudgetPeriodSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill snapshots from current budget definitions
INSERT INTO "BudgetPeriodSnapshot" ("budget_period_id", "budget_name", "total_amount", "created_at")
SELECT
  bp."id",
  b."name",
  b."total_amount",
  CURRENT_TIMESTAMP
FROM "BudgetPeriod" bp
INNER JOIN "Budget" b ON b."id" = bp."budget_id";

-- Backfill allocation snapshot labels and amounts
INSERT INTO "BudgetPeriodSnapshotAllocation" (
  "snapshot_id",
  "wallet_id",
  "wallet_name",
  "category_id",
  "category_name",
  "category_icon",
  "allocated_amount",
  "created_at"
)
SELECT
  s."id",
  ba."wallet_id",
  w."name",
  ba."category_id",
  c."name",
  c."icon",
  ba."amount",
  CURRENT_TIMESTAMP
FROM "BudgetPeriodSnapshot" s
INNER JOIN "BudgetPeriod" bp ON bp."id" = s."budget_period_id"
INNER JOIN "BudgetAllocation" ba ON ba."budget_id" = bp."budget_id"
INNER JOIN "Wallet" w ON w."id" = ba."wallet_id"
INNER JOIN "Category" c ON c."id" = ba."category_id";
