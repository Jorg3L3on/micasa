-- AlterTable
ALTER TABLE "ExpenseTemplate" ADD COLUMN     "due_day_first_fortnight" INTEGER,
ADD COLUMN     "due_day_second_fortnight" INTEGER;

-- Backfill from legacy due_day + applies_* flags
UPDATE "ExpenseTemplate"
SET
  "due_day_first_fortnight" = CASE
    WHEN "applies_first_fortnight" THEN "due_day"
    ELSE NULL
  END,
  "due_day_second_fortnight" = CASE
    WHEN "applies_second_fortnight" THEN "due_day"
    ELSE NULL
  END
WHERE "due_day" IS NOT NULL;
