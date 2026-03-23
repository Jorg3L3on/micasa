-- CreateEnum
CREATE TYPE "StatementImportProvider" AS ENUM ('MERCADO_PAGO');

-- CreateTable
CREATE TABLE "CreditCardStatementImport" (
    "id" SERIAL NOT NULL,
    "provider" "StatementImportProvider" NOT NULL,
    "wallet_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "house_id" INTEGER,
    "created_by_user_id" INTEGER NOT NULL,
    "file_name" TEXT,
    "file_mime" TEXT,
    "file_data" BYTEA,
    "period_start" TIMESTAMP(3),
    "period_end" TIMESTAMP(3),
    "account_number" TEXT,
    "statement_issue_date" TIMESTAMP(3),
    "total_due" DECIMAL(12,2),
    "parse_warnings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditCardStatementImport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreditCardStatementImport_wallet_id_idx" ON "CreditCardStatementImport"("wallet_id");

-- CreateIndex
CREATE INDEX "CreditCardStatementImport_user_id_idx" ON "CreditCardStatementImport"("user_id");

-- CreateIndex
CREATE INDEX "CreditCardStatementImport_house_id_idx" ON "CreditCardStatementImport"("house_id");

-- CreateIndex
CREATE INDEX "CreditCardStatementImport_created_at_idx" ON "CreditCardStatementImport"("created_at");

-- AddForeignKey
ALTER TABLE "CreditCardStatementImport" ADD CONSTRAINT "CreditCardStatementImport_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditCardStatementImport" ADD CONSTRAINT "CreditCardStatementImport_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditCardStatementImport" ADD CONSTRAINT "CreditCardStatementImport_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "House"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditCardStatementImport" ADD CONSTRAINT "CreditCardStatementImport_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN "statement_import_id" INTEGER;

-- CreateIndex
CREATE INDEX "Expense_statement_import_id_idx" ON "Expense"("statement_import_id");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_statement_import_id_fkey" FOREIGN KEY ("statement_import_id") REFERENCES "CreditCardStatementImport"("id") ON DELETE SET NULL ON UPDATE CASCADE;
