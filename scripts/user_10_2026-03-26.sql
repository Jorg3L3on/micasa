-- ============================================================
-- RESTORE: User 10 (Carmen Solorzano) + owned houses (10, 11)
-- Captured: 2026-03-26
-- Run with: psql $DATABASE_URL -f scripts/user_10_2026-03-26.sql
-- ============================================================

BEGIN;

-- ── 1. User ───────────────────────────────────────────────────
INSERT INTO "User" (id, name, active, email, password, created_at, onboarding_completed)
VALUES (
  10,
  'Carmen Solorzano',
  true,
  'Consepcionsolorzano39@gmail.com',
  '$2b$10$vdMUZutPzS9lwfk/GegW5.fWj6nUV55Q.BREbf.2/g59OaIrZ.i.W',
  '2026-03-16T01:18:18.745',
  true
);

-- ── 2. Houses ─────────────────────────────────────────────────
INSERT INTO "House" (id, name, owner_id, created_at)
VALUES
  (10, 'Casa de Carmen Solorzano', 10, '2026-03-16T01:18:18.786'),
  (11, 'Leon Solorzano',           10, '2026-03-16T01:25:22.999');

-- ── 3. House members ──────────────────────────────────────────
-- Note: member id=15 (user_id=11) is included because they belong to house 11
INSERT INTO "HouseMember" (id, house_id, user_id, role, created_at)
VALUES
  (12, 10, 10, 'OWNER',  '2026-03-16T01:18:18.792'),
  (13, 11, 10, 'OWNER',  '2026-03-16T01:25:23.006'),
  (15, 11, 11, 'MEMBER', '2026-03-16T01:33:51.228');

-- ── 4. Categories ─────────────────────────────────────────────
-- User-owned
INSERT INTO "Category" (id, name, description, created_at, house_id, user_id)
VALUES
  (29, 'Comida',     NULL, '2026-03-16T01:20:58.179', NULL, 10),
  (30, 'Transporte', NULL, '2026-03-16T01:20:58.183', NULL, 10),
  (31, 'Vivienda',   NULL, '2026-03-16T01:20:58.184', NULL, 10);

-- House 11-owned
INSERT INTO "Category" (id, name, description, created_at, house_id, user_id)
VALUES
  (35, 'Casa',                 NULL, '2026-03-16T01:47:11.256', 11, NULL),
  (36, 'Suscripciones',        NULL, '2026-03-16T01:47:33.892', 11, NULL),
  (37, 'Tarjeta de credito',   NULL, '2026-03-16T01:47:47.2',   11, NULL),
  (38, 'Tarjeta departamental',NULL, '2026-03-16T01:47:58.512', 11, NULL),
  (39, 'Comida',               NULL, '2026-03-16T01:48:47.957', 11, NULL),
  (40, 'Salidas',              NULL, '2026-03-16T01:49:00.95',  11, NULL),
  (41, 'Entretenimiento',      NULL, '2026-03-16T01:49:10.996', 11, NULL),
  (42, 'Medicamentos',         NULL, '2026-03-16T01:49:24.478', 11, NULL),
  (43, 'Trnasporte',           NULL, '2026-03-16T01:49:29.184', 11, NULL),
  (44, 'Inversiones',          NULL, '2026-03-16T01:49:37.088', 11, NULL),
  (45, 'Apoyos familiares',    NULL, '2026-03-16T01:50:03.289', 11, NULL),
  (46, 'Prestamos',            NULL, '2026-03-16T05:18:17.997', 11, NULL);

-- ── 5. Wallets ────────────────────────────────────────────────
-- User-owned
INSERT INTO "Wallet" (id, name, amount, type, cutoff_day, due_day, created_at, active, description, house_id, user_id, credit_limit, last_paid_period)
VALUES
  (27, 'Efectivo',        0,        'CASH',        NULL, NULL, '2026-03-16T01:20:58.155', true, NULL, NULL, 10, NULL, NULL),
  (28, 'Cuenta principal',0,        'DEBIT_CARD',  NULL, NULL, '2026-03-16T01:20:58.177', true, NULL, NULL, 10, NULL, NULL);

-- House 11-owned
INSERT INTO "Wallet" (id, name, amount, type, cutoff_day, due_day, created_at, active, description, house_id, user_id, credit_limit, last_paid_period)
VALUES
  (31, 'Santander', -2273.72, 'DEBIT_CARD',  NULL, NULL, '2026-03-16T01:35:00.98',   true, NULL, 11, NULL, NULL,  NULL),
  (32, 'Banamex',   0,        'DEBIT_CARD',  NULL, NULL, '2026-03-16T01:35:16.976',  true, NULL, 11, NULL, NULL,  NULL),
  (33, 'DIDI Card', 0,        'CREDIT_CARD', 3,    18,   '2026-03-16T23:36:24.757',  true, NULL, 11, NULL, 1000,  NULL);

-- ── 6. Income templates ───────────────────────────────────────
-- User-owned
INSERT INTO "IncomeTemplate" (id, name, suggested_amount, source, applies_first_fortnight, applies_second_fortnight, active, user_id, created_at, house_id)
VALUES (11, 'Sueldo', 6000, NULL, true, true, true, 10, '2026-03-16T01:20:58.186', NULL);

-- House 11-owned
INSERT INTO "IncomeTemplate" (id, name, suggested_amount, source, applies_first_fortnight, applies_second_fortnight, active, user_id, created_at, house_id)
VALUES
  (13, 'Salario Carmen', 5500,  'Salario', true, true, true, NULL, '2026-03-16T01:37:06.294', 11),
  (14, 'Salario Jorge',  15000, 'Salario', true, true, true, NULL, '2026-03-16T01:37:54.687', 11);

-- ── 7. Expense templates ──────────────────────────────────────
-- User-owned
INSERT INTO "ExpenseTemplate" (id, name, suggested_amount, is_recurring, applies_first_fortnight, applies_second_fortnight, is_subscription, due_day, cutoff_day, active, category_id, house_id, created_at, user_id, wallet_id, due_day_first_fortnight, due_day_second_fortnight)
VALUES
  (34, 'Renta',    0, true, true, true, false, NULL, NULL, true, NULL, NULL, '2026-03-16T01:20:58.189', 10, NULL, NULL, NULL),
  (35, 'Internet', 0, true, true, true, false, NULL, NULL, true, NULL, NULL, '2026-03-16T01:20:58.189', 10, NULL, NULL, NULL);

-- House 11-owned
INSERT INTO "ExpenseTemplate" (id, name, suggested_amount, is_recurring, applies_first_fortnight, applies_second_fortnight, is_subscription, due_day, cutoff_day, active, category_id, house_id, created_at, user_id, wallet_id, due_day_first_fortnight, due_day_second_fortnight)
VALUES
  (38, 'Renta',            8500,    true, false, true,  false, 15, 1,  true, 35, 11, '2026-03-16T05:04:41.067', NULL, 32, NULL, 15),
  (39, 'TELMEX',           658,     true, false, true,  false, 23, 1,  true, 35, 11, '2026-03-16T05:07:23.063', NULL, 32, NULL, 23),
  (40, 'AT&T Carmen',      400.99,  true, false, true,  false, 23, 1,  true, 35, 11, '2026-03-16T05:08:50.52',  NULL, 32, NULL, 23),
  (43, 'AT&T Jorge',       453.06,  true, false, true,  false, 19, 1,  true, 35, 11, '2026-03-16T05:11:16.238', NULL, 32, NULL, 19),
  (44, 'Mercado pago',     823.16,  true, false, true,  false, 17, 1,  true, 37, 11, '2026-03-16T05:13:46.949', NULL, 32, NULL, 17),
  (45, 'CFE',              450,     true, false, true,  false, 17, 1,  true, 35, 11, '2026-03-16T05:16:36.795', NULL, 31, NULL, 17),
  (46, 'Super',            2000,    true, true,  true,  false, 15, 1,  true, 39, 11, '2026-03-16T05:17:26.187', NULL, 31, 15,   15),
  (47, 'Fonacot Carmen',   1243.68, true, true,  true,  false, 15, 1,  true, 46, 11, '2026-03-16T05:19:29.948', NULL, 31, 15,   15),
  (48, 'Fonacot Jorge',    2792.73, true, true,  true,  false, 15, 1,  true, 46, 11, '2026-03-16T05:20:21.814', NULL, 32, 15,   15),
  (49, 'Carne',            800,     true, true,  true,  false, 15, 1,  true, 39, 11, '2026-03-16T05:22:18.725', NULL, 31, 15,   15),
  (50, 'Agua',             200,     true, true,  true,  false, 13, 1,  true, 39, 11, '2026-03-16T05:23:06.449', NULL, 31, 13,   13),
  (51, 'Transporte Carmen',400,     true, true,  true,  false, 1,  1,  true, 43, 11, '2026-03-16T05:24:01.476', NULL, 31, 1,    1),
  (52, 'Credito Banamex',  2500,    true, true,  true,  false, 15, 1,  true, 46, 11, '2026-03-16T05:25:58.08',  NULL, 32, 15,   15),
  (53, 'Liverpool Carmen', 531.67,  true, true,  false, false, 5,  4,  true, 38, 11, '2026-03-16T05:29:47.753', NULL, 31, 5,    NULL),
  (54, 'Liverpool Jorge',  1,       true, true,  false, false, 12, 1,  true, 38, 11, '2026-03-16T05:30:51.19',  NULL, 32, 12,   NULL),
  (55, 'AT&T Jorge',       1160,    true, true,  false, false, 7,  1,  true, 35, 11, '2026-03-16T05:32:52.086', NULL, 32, 7,    NULL),
  (56, 'Spotify',          189,     true, true,  false, false, 30, 1,  true, 41, 11, '2026-03-16T05:34:09.104', NULL, 31, 30,   NULL),
  (57, 'Sky',              269,     true, true,  false, false, 30, 1,  true, 41, 11, '2026-03-16T05:34:58.062', NULL, 31, 30,   NULL),
  (58, 'C&A efectivo ',    928,     true, true,  false, false, 10, 15, true, 37, 11, '2026-03-16T05:43:23.054', NULL, 32, 10,   NULL),
  (59, 'C&A departamental',250,     true, true,  false, false, 3,  10, true, 38, 11, '2026-03-16T05:44:29.189', NULL, 32, 3,    NULL),
  (60, 'Paula',            300,     true, false, true,  false, 1,  1,  true, 42, 11, '2026-03-16T05:46:11.864', NULL, 31, NULL, 1),
  (61, 'Concerta',         2400,    true, true,  false, false, 1,  1,  true, 42, 11, '2026-03-16T05:46:48.837', NULL, 31, 1,    NULL),
  (62, 'Quetiapina',       250,     true, true,  false, false, 11, 1,  true, 42, 11, '2026-03-16T05:47:22.611', NULL, 32, 11,   NULL),
  (63, 'Lamotriglina',     160,     true, true,  false, false, 1,  1,  true, 42, 11, '2026-03-16T05:48:02.589', NULL, 32, 1,    NULL),
  (64, 'Didi card',        1500,    true, false, true,  false, 18, 3,  true, 37, 11, '2026-03-16T08:02:09.164', NULL, 32, NULL, 18);

-- ── 8. Fortnights ─────────────────────────────────────────────
-- User-owned
INSERT INTO "Fortnight" (id, start_date, end_date, label, month, year, period, closed, house_id, created_at, user_id)
VALUES
  (63, '2026-03-01T06:00:00', '2026-03-14T06:00:00', 'Primera quincena - 3/2026', 3, 2026, 'FIRST',  false, NULL, '2026-03-16T01:20:58.194', 10),
  (64, '2026-03-15T06:00:00', '2026-03-31T06:00:00', 'Segunda quincena - 3/2026', 3, 2026, 'SECOND', false, NULL, '2026-03-16T01:20:58.194', 10),
  (65, '2026-04-01T06:00:00', '2026-04-14T06:00:00', 'Primera quincena - 4/2026', 4, 2026, 'FIRST',  false, NULL, '2026-03-16T01:20:58.194', 10),
  (66, '2026-04-15T06:00:00', '2026-04-30T06:00:00', 'Segunda quincena - 4/2026', 4, 2026, 'SECOND', false, NULL, '2026-03-16T01:20:58.194', 10);

-- House 11-owned
INSERT INTO "Fortnight" (id, start_date, end_date, label, month, year, period, closed, house_id, created_at, user_id)
VALUES
  (71, '2026-03-01T06:00:00', '2026-03-15T06:00:00', 'Primera quincena - Marzo 2026',   3, 2026, 'FIRST',  false, 11, '2026-03-16T05:26:39.503', NULL),
  (72, '2026-03-16T06:00:00', '2026-03-31T06:00:00', 'Segunda quincena - Marzo 2026',   3, 2026, 'SECOND', false, 11, '2026-03-16T05:26:39.551', NULL),
  (73, '2026-04-01T06:00:00', '2026-04-15T06:00:00', 'Primera quincena - Abril 2026',   4, 2026, 'FIRST',  false, 11, '2026-03-16T06:28:03.858', NULL),
  (74, '2026-04-16T06:00:00', '2026-04-30T06:00:00', 'Segunda quincena - Abril 2026',   4, 2026, 'SECOND', false, 11, '2026-03-16T06:28:03.934', NULL),
  (75, '2026-05-01T06:00:00', '2026-05-15T06:00:00', 'Primera quincena - Mayo 2026',    5, 2026, 'FIRST',  false, 11, '2026-03-16T06:41:32.004', NULL),
  (76, '2026-05-16T06:00:00', '2026-05-31T06:00:00', 'Segunda quincena - Mayo 2026',    5, 2026, 'SECOND', false, 11, '2026-03-16T06:41:32.081', NULL);

-- ── 9. Incomes ────────────────────────────────────────────────
-- User-owned (fortnight 63-66)
INSERT INTO "Income" (id, amount, source, received_at, user_id, house_id, fortnight_id, income_template_id, created_at)
VALUES
  (33, 4800, '', '2026-03-01T06:00:00', 10, NULL, 63, 11, '2026-03-16T01:20:58.208'),
  (34, 4800, '', '2026-03-15T06:00:00', 10, NULL, 64, 11, '2026-03-16T01:20:58.208'),
  (35, 4800, '', '2026-04-01T06:00:00', 10, NULL, 65, 11, '2026-03-16T01:20:58.208'),
  (36, 4800, '', '2026-04-15T06:00:00', 10, NULL, 66, 11, '2026-03-16T01:20:58.208');

-- House 11-owned
INSERT INTO "Income" (id, amount, source, received_at, user_id, house_id, fortnight_id, income_template_id, created_at)
VALUES
  (41, 6000,  'Salario', '2026-03-01T06:00:00', NULL, 11, 71, 13, '2026-03-16T05:26:39.546'),
  (42, 15000, 'Salario', '2026-03-01T06:00:00', NULL, 11, 71, 14, '2026-03-16T05:26:39.548'),
  (43, 5500,  'Salario', '2026-03-16T06:00:00', NULL, 11, 72, 13, '2026-03-16T05:26:39.593'),
  (44, 15000, 'Salario', '2026-03-16T06:00:00', NULL, 11, 72, 14, '2026-03-16T05:26:39.595'),
  (49, 5800,  'Salario', '2026-04-01T06:00:00', NULL, 11, 73, 13, '2026-03-16T06:28:33.826'),
  (50, 15000, 'Salario', '2026-04-01T06:00:00', NULL, 11, 73, 14, '2026-03-16T06:28:33.828'),
  (51, 6000,  'Salario', '2026-05-01T06:00:00', NULL, 11, 75, 13, '2026-03-16T06:41:32.073'),
  (52, 15000, 'Salario', '2026-05-01T06:00:00', NULL, 11, 75, 14, '2026-03-16T06:41:32.075'),
  (55, 6000,  'Salario', '2026-04-16T06:00:00', NULL, 11, 74, 13, '2026-03-16T08:03:39.604'),
  (56, 15000, 'Salario', '2026-04-16T06:00:00', NULL, 11, 74, 14, '2026-03-16T08:03:39.607'),
  (57, 6000,  'Salario', '2026-05-16T06:00:00', NULL, 11, 76, 13, '2026-03-16T08:05:18.158'),
  (58, 15000, 'Salario', '2026-05-16T06:00:00', NULL, 11, 76, 14, '2026-03-16T08:05:18.16');

-- ── 10. Expenses ──────────────────────────────────────────────
-- User-owned (fortnight 63-66)
INSERT INTO "Expense" (id, description, amount, is_paid, payment_date, due_day, house_id, fortnight_id, category_id, expense_template_id, created_at, user_id, wallet_id, statement_import_id, credit_msi_current, credit_msi_total)
VALUES
  (72, 'Renta',    0, false, NULL, 14, NULL, 63, NULL, 34, '2026-03-16T01:20:58.214', 10, NULL, NULL, NULL, NULL),
  (73, 'Internet', 0, false, NULL, 14, NULL, 63, NULL, 35, '2026-03-16T01:20:58.214', 10, NULL, NULL, NULL, NULL),
  (74, 'Renta',    0, false, NULL, 31, NULL, 64, NULL, 34, '2026-03-16T01:20:58.214', 10, NULL, NULL, NULL, NULL),
  (75, 'Internet', 0, false, NULL, 31, NULL, 64, NULL, 35, '2026-03-16T01:20:58.214', 10, NULL, NULL, NULL, NULL),
  (76, 'Renta',    0, false, NULL, 14, NULL, 65, NULL, 34, '2026-03-16T01:20:58.214', 10, NULL, NULL, NULL, NULL),
  (77, 'Internet', 0, false, NULL, 14, NULL, 65, NULL, 35, '2026-03-16T01:20:58.214', 10, NULL, NULL, NULL, NULL),
  (78, 'Renta',    0, false, NULL, 30, NULL, 66, NULL, 34, '2026-03-16T01:20:58.214', 10, NULL, NULL, NULL, NULL),
  (79, 'Internet', 0, false, NULL, 30, NULL, 66, NULL, 35, '2026-03-16T01:20:58.214', 10, NULL, NULL, NULL, NULL);

-- House 11 — Fortnight 71 (Primera quincena Marzo 2026)
INSERT INTO "Expense" (id, description, amount, is_paid, payment_date, due_day, house_id, fortnight_id, category_id, expense_template_id, created_at, user_id, wallet_id, statement_import_id, credit_msi_current, credit_msi_total)
VALUES
  (88, 'Super',          2000,    false, NULL, 15, 11, 71, 39, 46, '2026-03-16T05:26:39.516', NULL, 31, NULL, NULL, NULL),
  (89, 'Fonacot Carmen', 1243.68, false, NULL, 15, 11, 71, 46, 47, '2026-03-16T05:26:39.521', NULL, 31, NULL, NULL, NULL),
  (90, 'Fonacot Jorge',  2792.73, false, NULL, 15, 11, 71, 46, 48, '2026-03-16T05:26:39.525', NULL, 32, NULL, NULL, NULL),
  (91, 'Agua',           200,     false, NULL, 13, 11, 71, 39, 50, '2026-03-16T05:26:39.528', NULL, 31, NULL, NULL, NULL),
  (92, 'Transporte Carmen', 400,  false, NULL, 1,  11, 71, 43, 51, '2026-03-16T05:26:39.53',  NULL, 31, NULL, NULL, NULL),
  (93, 'Carne',          800,     false, NULL, 15, 11, 71, 39, 49, '2026-03-16T05:26:39.532', NULL, 31, NULL, NULL, NULL),
  (94, 'Credito Banamex',2500,    false, NULL, 15, 11, 71, 37, 52, '2026-03-16T05:26:39.535', NULL, 32, NULL, NULL, NULL);

-- House 11 — Fortnight 72 (Segunda quincena Marzo 2026)
INSERT INTO "Expense" (id, description, amount, is_paid, payment_date, due_day, house_id, fortnight_id, category_id, expense_template_id, created_at, user_id, wallet_id, statement_import_id, credit_msi_current, credit_msi_total)
VALUES
  (95,  'Renta',          8500,   true,  '2026-03-16T07:34:34.037', 15,   11, 72, 35, 38, '2026-03-16T05:26:39.559', NULL, 32, NULL, NULL, NULL),
  (96,  'TELMEX',         658,    true,  '2026-03-16T07:56:45.753', 23,   11, 72, 35, 39, '2026-03-16T05:26:39.562', NULL, 32, NULL, NULL, NULL),
  (97,  'AT&T Carmen',    400.99, true,  '2026-03-16T07:41:34.866', 23,   11, 72, 35, 40, '2026-03-16T05:26:39.564', NULL, 32, NULL, NULL, NULL),
  (98,  'AT&T Jorge',     453.06, true,  '2026-03-16T07:56:49.677', 19,   11, 72, 35, 43, '2026-03-16T05:26:39.566', NULL, 32, NULL, NULL, NULL),
  (99,  'Mercado pago',   823.16, true,  '2026-03-16T08:00:43.06',  17,   11, 72, 37, 44, '2026-03-16T05:26:39.568', NULL, 32, NULL, NULL, NULL),
  (100, 'CFE',            450,    true,  '2026-03-16T07:41:30.124', 17,   11, 72, 35, 45, '2026-03-16T05:26:39.571', NULL, 31, NULL, NULL, NULL),
  (101, 'Super',          1000,   false, NULL,                      15,   11, 72, 39, 46, '2026-03-16T05:26:39.574', NULL, 31, NULL, NULL, NULL),
  (102, 'Fonacot Carmen', 1243.68,true,  '2026-03-16T05:27:20.016', 15,   11, 72, 46, 47, '2026-03-16T05:26:39.577', NULL, 31, NULL, NULL, NULL),
  (103, 'Fonacot Jorge',  2792.73,true,  '2026-03-16T05:27:10.815', 15,   11, 72, 46, 48, '2026-03-16T05:26:39.578', NULL, 32, NULL, NULL, NULL),
  (104, 'Agua',           200,    false, NULL,                      13,   11, 72, 39, 50, '2026-03-16T05:26:39.58',  NULL, 31, NULL, NULL, NULL),
  (106, 'Carne',          800,    false, NULL,                      15,   11, 72, 39, 49, '2026-03-16T05:26:39.585', NULL, 31, NULL, NULL, NULL),
  (107, 'Credito Banamex',2500,   true,  '2026-03-16T05:27:16.187', 15,   11, 72, 37, 52, '2026-03-16T05:26:39.587', NULL, 32, NULL, NULL, NULL),
  (179, 'Didi Card',      580.04, true,  '2026-03-16T07:32:45.642', NULL, 11, 72, 37, NULL,'2026-03-16T07:30:11.349', NULL, 31, NULL, NULL, NULL);

-- House 11 — Fortnight 73 (Primera quincena Abril 2026)
INSERT INTO "Expense" (id, description, amount, is_paid, payment_date, due_day, house_id, fortnight_id, category_id, expense_template_id, created_at, user_id, wallet_id, statement_import_id, credit_msi_current, credit_msi_total)
VALUES
  (128, 'Super',           2000,    false, NULL,                 15,   11, 73, 39, 46,   '2026-03-16T06:28:33.76',  NULL, 31, NULL, NULL, NULL),
  (129, 'Fonacot Carmen',  1243.68, false, NULL,                 15,   11, 73, 46, 47,   '2026-03-16T06:28:33.774', NULL, 31, NULL, NULL, NULL),
  (130, 'Fonacot Jorge',   2792.73, false, NULL,                 15,   11, 73, 46, 48,   '2026-03-16T06:28:33.777', NULL, 32, NULL, NULL, NULL),
  (131, 'Agua',            200,     false, NULL,                 13,   11, 73, 39, 50,   '2026-03-16T06:28:33.782', NULL, 31, NULL, NULL, NULL),
  (132, 'Transporte Carmen',400,    false, NULL,                 1,    11, 73, 43, 51,   '2026-03-16T06:28:33.785', NULL, 31, NULL, NULL, NULL),
  (133, 'Carne',           800,     false, NULL,                 15,   11, 73, 39, 49,   '2026-03-16T06:28:33.787', NULL, 31, NULL, NULL, NULL),
  (136, 'AT&T Jorge',      1179.43, false, NULL,                 7,    11, 73, 35, 55,   '2026-03-16T06:28:33.795', NULL, 32, NULL, NULL, NULL),
  (137, 'Sky',             269,     false, NULL,                 30,   11, 73, 41, 57,   '2026-03-16T06:28:33.798', NULL, 31, NULL, NULL, NULL),
  (138, 'Spotify',         189,     false, NULL,                 30,   11, 73, 41, 56,   '2026-03-16T06:28:33.8',   NULL, 31, NULL, NULL, NULL),
  (139, 'C&A efectivo ',   900,     false, NULL,                 10,   11, 73, 37, 58,   '2026-03-16T06:28:33.803', NULL, 32, NULL, NULL, NULL),
  (140, 'C&A departamental',220.25, false, NULL,                 3,    11, 73, 38, 59,   '2026-03-16T06:28:33.805', NULL, 32, NULL, NULL, NULL),
  (141, 'Concerta',        2400,    false, NULL,                 1,    11, 73, 42, 61,   '2026-03-16T06:28:33.807', NULL, 31, NULL, NULL, NULL),
  (143, 'Lamotriglina',    160,     false, NULL,                 1,    11, 73, 42, 63,   '2026-03-16T06:28:33.815', NULL, 32, NULL, NULL, NULL),
  (144, 'Credito Banamex', 2500,    false, NULL,                 15,   11, 73, 46, 52,   '2026-03-16T06:28:33.817', NULL, 32, NULL, NULL, NULL),
  (145, 'Renta',           1000,    false, '2026-04-01T00:00:00',NULL, 11, 73, 35, NULL, '2026-03-16T06:40:44.393', NULL, 32, NULL, NULL, NULL);

-- House 11 — Fortnight 74 (Segunda quincena Abril 2026)
INSERT INTO "Expense" (id, description, amount, is_paid, payment_date, due_day, house_id, fortnight_id, category_id, expense_template_id, created_at, user_id, wallet_id, statement_import_id, credit_msi_current, credit_msi_total)
VALUES
  (180, 'Renta',           7500,    false, NULL, 15, 11, 74, 35, 38,   '2026-03-16T08:03:39.537', NULL, 32, NULL, NULL, NULL),
  (181, 'TELMEX',          658,     false, NULL, 23, 11, 74, 35, 39,   '2026-03-16T08:03:39.545', NULL, 32, NULL, NULL, NULL),
  (182, 'AT&T Carmen',     400.99,  false, NULL, 23, 11, 74, 35, 40,   '2026-03-16T08:03:39.548', NULL, 32, NULL, NULL, NULL),
  (183, 'AT&T Jorge',      453.06,  false, NULL, 19, 11, 74, 35, 43,   '2026-03-16T08:03:39.554', NULL, 32, NULL, NULL, NULL),
  (184, 'Mercado pago',    4800,    false, NULL, 17, 11, 74, 37, 44,   '2026-03-16T08:03:39.557', NULL, 32, NULL, NULL, NULL),
  (186, 'Super',           2000,    false, NULL, 15, 11, 74, 39, 46,   '2026-03-16T08:03:39.564', NULL, 31, NULL, NULL, NULL),
  (187, 'Fonacot Carmen',  1243.68, false, NULL, 15, 11, 74, 46, 47,   '2026-03-16T08:03:39.567', NULL, 31, NULL, NULL, NULL),
  (188, 'Fonacot Jorge',   2792.73, false, NULL, 15, 11, 74, 46, 48,   '2026-03-16T08:03:39.571', NULL, 32, NULL, NULL, NULL),
  (189, 'Agua',            200,     false, NULL, 13, 11, 74, 39, 50,   '2026-03-16T08:03:39.573', NULL, 31, NULL, NULL, NULL),
  (190, 'Transporte Carmen',400,    false, NULL, 1,  11, 74, 43, 51,   '2026-03-16T08:03:39.576', NULL, 31, NULL, NULL, NULL),
  (191, 'Carne',           800,     false, NULL, 15, 11, 74, 39, 49,   '2026-03-16T08:03:39.579', NULL, 31, NULL, NULL, NULL),
  (192, 'Paula',           300,     false, NULL, 1,  11, 74, 42, 60,   '2026-03-16T08:03:39.581', NULL, 31, NULL, NULL, NULL),
  (193, 'Credito Banamex', 2500,    false, NULL, 15, 11, 74, 46, 52,   '2026-03-16T08:03:39.584', NULL, 32, NULL, NULL, NULL),
  (194, 'Didi card',       1500,    false, NULL, 18, 11, 74, 37, 64,   '2026-03-16T08:03:39.597', NULL, 32, NULL, NULL, NULL);

-- House 11 — Fortnight 75 (Primera quincena Mayo 2026)
INSERT INTO "Expense" (id, description, amount, is_paid, payment_date, due_day, house_id, fortnight_id, category_id, expense_template_id, created_at, user_id, wallet_id, statement_import_id, credit_msi_current, credit_msi_total)
VALUES
  (146, 'Super',            2000,    false, NULL,                 15,   11, 75, 39, 46,   '2026-03-16T06:41:32.018', NULL, 31, NULL, NULL, NULL),
  (147, 'Fonacot Carmen',   1243.68, false, NULL,                 15,   11, 75, 46, 47,   '2026-03-16T06:41:32.024', NULL, 31, NULL, NULL, NULL),
  (148, 'Fonacot Jorge',    2792.73, false, NULL,                 15,   11, 75, 46, 48,   '2026-03-16T06:41:32.027', NULL, 32, NULL, NULL, NULL),
  (149, 'Agua',             200,     false, NULL,                 13,   11, 75, 39, 50,   '2026-03-16T06:41:32.03',  NULL, 31, NULL, NULL, NULL),
  (150, 'Transporte Carmen',400,     false, NULL,                 1,    11, 75, 43, 51,   '2026-03-16T06:41:32.032', NULL, 31, NULL, NULL, NULL),
  (151, 'Carne',            800,     false, NULL,                 15,   11, 75, 39, 49,   '2026-03-16T06:41:32.034', NULL, 31, NULL, NULL, NULL),
  (152, 'Liverpool Carmen', 531.67,  false, NULL,                 5,    11, 75, 38, 53,   '2026-03-16T06:41:32.037', NULL, 31, NULL, NULL, NULL),
  (153, 'Liverpool Jorge',  1,       false, NULL,                 12,   11, 75, 38, 54,   '2026-03-16T06:41:32.041', NULL, 32, NULL, NULL, NULL),
  (154, 'AT&T Jorge',       1160,    false, NULL,                 7,    11, 75, 35, 55,   '2026-03-16T06:41:32.043', NULL, 32, NULL, NULL, NULL),
  (155, 'Sky',              269,     false, NULL,                 30,   11, 75, 41, 57,   '2026-03-16T06:41:32.049', NULL, 31, NULL, NULL, NULL),
  (156, 'Spotify',          189,     false, NULL,                 30,   11, 75, 41, 56,   '2026-03-16T06:41:32.051', NULL, 31, NULL, NULL, NULL),
  (157, 'C&A efectivo ',    928,     false, NULL,                 10,   11, 75, 37, 58,   '2026-03-16T06:41:32.053', NULL, 32, NULL, NULL, NULL),
  (158, 'C&A departamental',250,     false, NULL,                 3,    11, 75, 38, 59,   '2026-03-16T06:41:32.055', NULL, 32, NULL, NULL, NULL),
  (159, 'Concerta',         2400,    false, NULL,                 1,    11, 75, 42, 61,   '2026-03-16T06:41:32.058', NULL, 31, NULL, NULL, NULL),
  (160, 'Quetiapina',       250,     false, NULL,                 11,   11, 75, 42, 62,   '2026-03-16T06:41:32.06',  NULL, 32, NULL, NULL, NULL),
  (161, 'Lamotriglina',     160,     false, NULL,                 1,    11, 75, 42, 63,   '2026-03-16T06:41:32.062', NULL, 32, NULL, NULL, NULL),
  (162, 'Credito Banamex',  2500,    false, NULL,                 15,   11, 75, 46, 52,   '2026-03-16T06:41:32.065', NULL, 32, NULL, NULL, NULL),
  (177, 'Mercado Pago',     1500,    false, '2026-05-01T00:00:00',NULL, 11, 75, 37, NULL, '2026-03-16T06:42:11.571', NULL, 32, NULL, NULL, NULL),
  (178, 'Renta',            1500,    false, '2026-05-01T00:00:00',NULL, 11, 75, 35, NULL, '2026-03-16T06:45:34.586', NULL, 32, NULL, NULL, NULL);

-- House 11 — Fortnight 76 (Segunda quincena Mayo 2026)
INSERT INTO "Expense" (id, description, amount, is_paid, payment_date, due_day, house_id, fortnight_id, category_id, expense_template_id, created_at, user_id, wallet_id, statement_import_id, credit_msi_current, credit_msi_total)
VALUES
  (195, 'Renta',           7000,    false, NULL, 15, 11, 76, 35, 38, '2026-03-16T08:05:18.111', NULL, 32, NULL, NULL, NULL),
  (196, 'TELMEX',          658,     false, NULL, 23, 11, 76, 35, 39, '2026-03-16T08:05:18.116', NULL, 32, NULL, NULL, NULL),
  (197, 'AT&T Carmen',     400.99,  false, NULL, 23, 11, 76, 35, 40, '2026-03-16T08:05:18.119', NULL, 32, NULL, NULL, NULL),
  (198, 'AT&T Jorge',      453.06,  false, NULL, 19, 11, 76, 35, 43, '2026-03-16T08:05:18.124', NULL, 32, NULL, NULL, NULL),
  (199, 'Mercado pago',    1036.94, false, NULL, 17, 11, 76, 37, 44, '2026-03-16T08:05:18.127', NULL, 32, NULL, NULL, NULL),
  (200, 'CFE',             450,     false, NULL, 17, 11, 76, 35, 45, '2026-03-16T08:05:18.129', NULL, 31, NULL, NULL, NULL),
  (201, 'Super',           2000,    false, NULL, 15, 11, 76, 39, 46, '2026-03-16T08:05:18.132', NULL, 31, NULL, NULL, NULL),
  (202, 'Fonacot Carmen',  1243.68, false, NULL, 15, 11, 76, 46, 47, '2026-03-16T08:05:18.135', NULL, 31, NULL, NULL, NULL),
  (203, 'Fonacot Jorge',   2792.73, false, NULL, 15, 11, 76, 46, 48, '2026-03-16T08:05:18.137', NULL, 32, NULL, NULL, NULL),
  (204, 'Agua',            200,     false, NULL, 13, 11, 76, 39, 50, '2026-03-16T08:05:18.139', NULL, 31, NULL, NULL, NULL),
  (205, 'Transporte Carmen',400,    false, NULL, 1,  11, 76, 43, 51, '2026-03-16T08:05:18.142', NULL, 31, NULL, NULL, NULL),
  (206, 'Carne',           800,     false, NULL, 15, 11, 76, 39, 49, '2026-03-16T08:05:18.144', NULL, 31, NULL, NULL, NULL),
  (207, 'Paula',           300,     false, NULL, 1,  11, 76, 42, 60, '2026-03-16T08:05:18.146', NULL, 31, NULL, NULL, NULL),
  (208, 'Credito Banamex', 2500,    false, NULL, 15, 11, 76, 46, 52, '2026-03-16T08:05:18.149', NULL, 32, NULL, NULL, NULL),
  (209, 'Didi card',       700,     false, NULL, 18, 11, 76, 37, 64, '2026-03-16T08:05:18.152', NULL, 32, NULL, NULL, NULL);

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
