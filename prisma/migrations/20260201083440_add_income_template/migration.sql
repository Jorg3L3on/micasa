-- AlterTable
ALTER TABLE "FortnightIncome" ADD COLUMN     "income_template_id" INTEGER;

-- CreateTable
CREATE TABLE "IncomeTemplate" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "suggested_amount" DECIMAL(10,2),
    "source" TEXT,
    "is_deduction" BOOLEAN NOT NULL DEFAULT false,
    "applies_first_fortnight" BOOLEAN NOT NULL DEFAULT false,
    "applies_second_fortnight" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "user_id" INTEGER,
    "house_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncomeTemplate_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "FortnightIncome" ADD CONSTRAINT "FortnightIncome_income_template_id_fkey" FOREIGN KEY ("income_template_id") REFERENCES "IncomeTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomeTemplate" ADD CONSTRAINT "IncomeTemplate_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomeTemplate" ADD CONSTRAINT "IncomeTemplate_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "House"("id") ON DELETE SET NULL ON UPDATE CASCADE;
