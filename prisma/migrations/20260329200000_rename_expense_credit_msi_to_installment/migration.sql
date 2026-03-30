-- Rename MSI columns to neutral installment naming (matches Prisma `credit_installment_*`).
ALTER TABLE "Expense" RENAME COLUMN "credit_msi_current" TO "credit_installment_current";
ALTER TABLE "Expense" RENAME COLUMN "credit_msi_total" TO "credit_installment_total";
