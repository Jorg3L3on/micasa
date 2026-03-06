-- Enforce single-owner rule for key finance tables
-- A record must belong to exactly one owner:
-- (user_id IS NOT NULL AND house_id IS NULL) OR (user_id IS NULL AND house_id IS NOT NULL)

-- 1) DATA FIXES TO SATISFY CONSTRAINTS ---------------------------------------

-- Choose the first active user for orphaned records (if any).
UPDATE "Fortnight" f
SET user_id = (
      SELECT id
      FROM "User"
      WHERE active = true
      ORDER BY id
      LIMIT 1
    ),
    house_id = NULL
WHERE f.user_id IS NULL
  AND f.house_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM "User"
    WHERE active = true
  );

-- Backfill owner for expenses from their fortnights when missing.
UPDATE "Expense" e
SET user_id = ft.user_id,
    house_id = ft.house_id
FROM "Fortnight" ft
WHERE e.fortnight_id = ft.id
  AND e.user_id IS NULL
  AND e.house_id IS NULL;

-- Backfill owner for incomes from their fortnights when missing.
UPDATE "Income" i
SET user_id = ft.user_id,
    house_id = ft.house_id
FROM "Fortnight" ft
WHERE i.fortnight_id = ft.id
  AND i.user_id IS NULL
  AND i.house_id IS NULL;

-- If any income rows somehow have both owners set, prefer keeping the house side
-- for house incomes and clear the user side.
UPDATE "Income"
SET user_id = NULL
WHERE user_id IS NOT NULL
  AND house_id IS NOT NULL;

-- For wallets without an owner, attach them to the first active user.
UPDATE "Wallet" w
SET user_id = (
      SELECT id
      FROM "User"
      WHERE active = true
      ORDER BY id
      LIMIT 1
    ),
    house_id = NULL
WHERE w.user_id IS NULL
  AND w.house_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM "User"
    WHERE active = true
  );

-- For expense templates without an owner, attach them to the first active user.
UPDATE "ExpenseTemplate" et
SET user_id = (
      SELECT id
      FROM "User"
      WHERE active = true
      ORDER BY id
      LIMIT 1
    ),
    house_id = NULL
WHERE et.user_id IS NULL
  AND et.house_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM "User"
    WHERE active = true
  );

-- For income templates without an owner, attach them to the first active user.
UPDATE "IncomeTemplate" it
SET user_id = (
      SELECT id
      FROM "User"
      WHERE active = true
      ORDER BY id
      LIMIT 1
    ),
    house_id = NULL
WHERE it.user_id IS NULL
  AND it.house_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM "User"
    WHERE active = true
  );

-- 2) CHECK CONSTRAINTS -------------------------------------------------------

ALTER TABLE "Fortnight"
ADD CONSTRAINT "fortnight_single_owner_check"
CHECK (
  (user_id IS NOT NULL AND house_id IS NULL)
  OR
  (user_id IS NULL AND house_id IS NOT NULL)
);

ALTER TABLE "Expense"
ADD CONSTRAINT "expense_single_owner_check"
CHECK (
  (user_id IS NOT NULL AND house_id IS NULL)
  OR
  (user_id IS NULL AND house_id IS NOT NULL)
);

ALTER TABLE "Income"
ADD CONSTRAINT "income_single_owner_check"
CHECK (
  (user_id IS NOT NULL AND house_id IS NULL)
  OR
  (user_id IS NULL AND house_id IS NOT NULL)
);

ALTER TABLE "Wallet"
ADD CONSTRAINT "wallet_single_owner_check"
CHECK (
  (user_id IS NOT NULL AND house_id IS NULL)
  OR
  (user_id IS NULL AND house_id IS NOT NULL)
);

ALTER TABLE "ExpenseTemplate"
ADD CONSTRAINT "expense_template_single_owner_check"
CHECK (
  (user_id IS NOT NULL AND house_id IS NULL)
  OR
  (user_id IS NULL AND house_id IS NOT NULL)
);

ALTER TABLE "IncomeTemplate"
ADD CONSTRAINT "income_template_single_owner_check"
CHECK (
  (user_id IS NOT NULL AND house_id IS NULL)
  OR
  (user_id IS NULL AND house_id IS NOT NULL)
);

