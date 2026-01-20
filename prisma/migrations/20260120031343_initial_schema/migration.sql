-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fortnight" (
    "id" SERIAL NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "label" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "closed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fortnight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Card" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "payment_method_id" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "group" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" SERIAL NOT NULL,
    "fortnight_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "card_id" INTEGER,
    "category_id" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "is_paid" BOOLEAN NOT NULL DEFAULT false,
    "payment_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FortnightIncome" (
    "id" SERIAL NOT NULL,
    "fortnight_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "source" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FortnightIncome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FortnightAllocation" (
    "id" SERIAL NOT NULL,
    "fortnight_id" INTEGER NOT NULL,
    "category_id" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FortnightAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FortnightBalance" (
    "id" SERIAL NOT NULL,
    "fortnight_id" INTEGER NOT NULL,
    "total_income" DECIMAL(10,2) NOT NULL,
    "total_expenses" DECIMAL(10,2) NOT NULL,
    "total_paid" DECIMAL(10,2) NOT NULL,
    "total_unpaid" DECIMAL(10,2) NOT NULL,
    "remaining" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FortnightBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserFortnightSummary" (
    "id" SERIAL NOT NULL,
    "fortnight_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "total_income" DECIMAL(10,2) NOT NULL,
    "total_expenses" DECIMAL(10,2) NOT NULL,
    "paid" DECIMAL(10,2) NOT NULL,
    "unpaid" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserFortnightSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "User_active_idx" ON "User"("active");

-- CreateIndex
CREATE INDEX "Fortnight_year_month_idx" ON "Fortnight"("year", "month");

-- CreateIndex
CREATE INDEX "Fortnight_closed_idx" ON "Fortnight"("closed");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethod_name_key" ON "PaymentMethod"("name");

-- CreateIndex
CREATE INDEX "Card_user_id_idx" ON "Card"("user_id");

-- CreateIndex
CREATE INDEX "Card_active_idx" ON "Card"("active");

-- CreateIndex
CREATE INDEX "Category_group_idx" ON "Category"("group");

-- CreateIndex
CREATE INDEX "Expense_fortnight_id_idx" ON "Expense"("fortnight_id");

-- CreateIndex
CREATE INDEX "Expense_user_id_idx" ON "Expense"("user_id");

-- CreateIndex
CREATE INDEX "Expense_card_id_idx" ON "Expense"("card_id");

-- CreateIndex
CREATE INDEX "Expense_category_id_idx" ON "Expense"("category_id");

-- CreateIndex
CREATE INDEX "Expense_is_paid_idx" ON "Expense"("is_paid");

-- CreateIndex
CREATE INDEX "FortnightIncome_fortnight_id_idx" ON "FortnightIncome"("fortnight_id");

-- CreateIndex
CREATE INDEX "FortnightIncome_user_id_idx" ON "FortnightIncome"("user_id");

-- CreateIndex
CREATE INDEX "FortnightAllocation_fortnight_id_idx" ON "FortnightAllocation"("fortnight_id");

-- CreateIndex
CREATE INDEX "FortnightAllocation_category_id_idx" ON "FortnightAllocation"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "FortnightBalance_fortnight_id_key" ON "FortnightBalance"("fortnight_id");

-- CreateIndex
CREATE INDEX "UserFortnightSummary_fortnight_id_idx" ON "UserFortnightSummary"("fortnight_id");

-- CreateIndex
CREATE INDEX "UserFortnightSummary_user_id_idx" ON "UserFortnightSummary"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "UserFortnightSummary_fortnight_id_user_id_key" ON "UserFortnightSummary"("fortnight_id", "user_id");

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "PaymentMethod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_fortnight_id_fkey" FOREIGN KEY ("fortnight_id") REFERENCES "Fortnight"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "Card"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FortnightIncome" ADD CONSTRAINT "FortnightIncome_fortnight_id_fkey" FOREIGN KEY ("fortnight_id") REFERENCES "Fortnight"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FortnightIncome" ADD CONSTRAINT "FortnightIncome_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FortnightAllocation" ADD CONSTRAINT "FortnightAllocation_fortnight_id_fkey" FOREIGN KEY ("fortnight_id") REFERENCES "Fortnight"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FortnightAllocation" ADD CONSTRAINT "FortnightAllocation_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FortnightBalance" ADD CONSTRAINT "FortnightBalance_fortnight_id_fkey" FOREIGN KEY ("fortnight_id") REFERENCES "Fortnight"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFortnightSummary" ADD CONSTRAINT "UserFortnightSummary_fortnight_id_fkey" FOREIGN KEY ("fortnight_id") REFERENCES "Fortnight"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFortnightSummary" ADD CONSTRAINT "UserFortnightSummary_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
