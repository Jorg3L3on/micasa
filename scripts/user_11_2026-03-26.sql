-- ============================================================
-- RESTORE: User 11 (Jorge) + owned houses
-- Captured: 2026-03-26
-- Run with: psql $DATABASE_URL -f scripts/user_11_2026-03-26.sql
-- ============================================================

BEGIN;

-- ── 1. User ───────────────────────────────────────────────────
INSERT INTO "User" (id, name, active, email, password, created_at, onboarding_completed)
VALUES (
  11,
  'Jorge',
  true,
  'jorgeleon983@gmail.com',
  '$2b$10$aQ3ysqW11bKTvfKfvBx86uLJpuYd5ASjhczWiw1nQO3OdQ/BA7zEm',
  '2026-03-16T01:27:24.189',
  true
);

-- ── 2. Houses ─────────────────────────────────────────────────
INSERT INTO "House" (id, name, owner_id, created_at)
VALUES (12, 'Casa de Jorge', 11, '2026-03-16T01:27:24.19');

-- ── 3. House members ──────────────────────────────────────────
INSERT INTO "HouseMember" (id, house_id, user_id, role, created_at)
VALUES
  (14, 12, 11, 'OWNER',  '2026-03-16T01:27:24.192'),
  (15, 11, 11, 'MEMBER', '2026-03-16T01:33:51.228');

-- ── 4. Categories ─────────────────────────────────────────────
INSERT INTO "Category" (id, name, description, created_at, house_id, user_id)
VALUES
  (32, 'Comida',     NULL, '2026-03-16T01:29:19.07',  NULL, 11),
  (33, 'Transporte', NULL, '2026-03-16T01:29:19.073', NULL, 11),
  (34, 'Vivienda',   NULL, '2026-03-16T01:29:19.074', NULL, 11);

-- ── 5. Wallets ────────────────────────────────────────────────
INSERT INTO "Wallet" (id, name, amount, type, cutoff_day, due_day, created_at, active, description, house_id, user_id, credit_limit, last_paid_period)
VALUES
  (29, 'Efectivo', 0,    'CASH',        NULL, NULL, '2026-03-16T01:29:19.06',  true, NULL, NULL, 11, NULL, NULL),
  (30, 'BANAMEX',  -678, 'DEBIT_CARD',  NULL, NULL, '2026-03-16T01:29:19.068', true, NULL, NULL, 11, NULL, NULL);

-- ── 6. Income templates ───────────────────────────────────────
INSERT INTO "IncomeTemplate" (id, name, suggested_amount, source, applies_first_fortnight, applies_second_fortnight, active, user_id, created_at, house_id)
VALUES (12, 'Sueldo', 15000, 'SALARIO', true, true, true, 11, '2026-03-16T01:29:19.075', NULL);

-- ── 7. Expense templates ──────────────────────────────────────
INSERT INTO "ExpenseTemplate" (id, name, suggested_amount, is_recurring, applies_first_fortnight, applies_second_fortnight, is_subscription, due_day, cutoff_day, active, category_id, house_id, created_at, user_id, wallet_id, due_day_first_fortnight, due_day_second_fortnight)
VALUES
  (36, 'Renta',    0, true, true, true, false, NULL, NULL, true, NULL, NULL, '2026-03-16T01:29:19.079', 11, NULL, NULL, NULL),
  (37, 'Internet', 0, true, true, true, false, NULL, NULL, true, NULL, NULL, '2026-03-16T01:29:19.079', 11, NULL, NULL, NULL);

-- ── 8. Fortnights ─────────────────────────────────────────────
INSERT INTO "Fortnight" (id, start_date, end_date, label, month, year, period, closed, house_id, created_at, user_id)
VALUES
  (67, '2026-03-01T06:00:00', '2026-03-14T06:00:00', 'Primera quincena - 3/2026',  3, 2026, 'FIRST',  false, NULL, '2026-03-16T01:29:19.083', 11),
  (68, '2026-03-15T06:00:00', '2026-03-31T06:00:00', 'Segunda quincena - 3/2026',  3, 2026, 'SECOND', false, NULL, '2026-03-16T01:29:19.083', 11),
  (69, '2026-04-01T06:00:00', '2026-04-14T06:00:00', 'Primera quincena - 4/2026',  4, 2026, 'FIRST',  false, NULL, '2026-03-16T01:29:19.083', 11),
  (70, '2026-04-15T06:00:00', '2026-04-30T06:00:00', 'Segunda quincena - 4/2026',  4, 2026, 'SECOND', false, NULL, '2026-03-16T01:29:19.083', 11);

-- ── 9. Incomes ────────────────────────────────────────────────
INSERT INTO "Income" (id, amount, source, received_at, user_id, house_id, fortnight_id, income_template_id, created_at)
VALUES
  (39, 15000, 'SALARIO', '2026-04-01T06:00:00', 11, NULL, 69, 12, '2026-03-16T01:29:19.09'),
  (40, 15000, 'SALARIO', '2026-04-15T06:00:00', 11, NULL, 70, 12, '2026-03-16T01:29:19.09'),
  (59, 15000, 'SALARIO', '2026-03-01T06:00:00', 11, NULL, 67, 12, '2026-03-16T09:30:47.285'),
  (60, 15000, 'SALARIO', '2026-03-15T06:00:00', 11, NULL, 68, 12, '2026-03-16T09:30:49.651');

-- ── 10. Expenses ──────────────────────────────────────────────
INSERT INTO "Expense" (id, description, amount, is_paid, payment_date, due_day, house_id, fortnight_id, category_id, expense_template_id, created_at, user_id, wallet_id, statement_import_id, credit_msi_current, credit_msi_total)
VALUES
  (84,  'Renta',    0,   false, NULL,                       14,   NULL, 69, NULL, 36, '2026-03-16T01:29:19.096',  11, NULL, NULL, NULL, NULL),
  (85,  'Internet', 0,   false, NULL,                       14,   NULL, 69, NULL, 37, '2026-03-16T01:29:19.096',  11, NULL, NULL, NULL, NULL),
  (86,  'Renta',    0,   false, NULL,                       30,   NULL, 70, NULL, 36, '2026-03-16T01:29:19.096',  11, NULL, NULL, NULL, NULL),
  (87,  'Internet', 0,   false, NULL,                       30,   NULL, 70, NULL, 37, '2026-03-16T01:29:19.096',  11, NULL, NULL, NULL, NULL),
  (210, 'Internet', 678, true,  '2026-03-01T00:00:00', NULL, NULL, 67, 34, 37, '2026-03-16T09:31:22.404',  11, 30,   NULL, NULL, NULL);

-- ── 11. Budgets + allocations ─────────────────────────────────
-- (none)

-- ── 12. Transfers ─────────────────────────────────────────────
-- (none)

-- ── 13. Credit card payments ──────────────────────────────────
-- (none)

-- ── 14. Credit card statement imports ────────────────────────
-- (none)

-- ── 15. Pantry receipts + lines + products ────────────────────
-- (none)

COMMIT;
