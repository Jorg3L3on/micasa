-- LoanPayment.due_date becomes a civil day (PostgreSQL DATE).
--
-- Backfill rule (timestamp without time zone; the clock is the UTC
-- components Prisma stored):
--   * 00:00:00 → that calendar date. Legacy UTC-midnight rows. Do not shift
--     them to the previous America/Mexico_City day.
--   * 06:00:00 → that same calendar date. This is midnight in
--     America/Mexico_City, which the write shim stored for a UTC-noon civil day.
--   * Any other clock time → that same calendar date as well. Loan due dates
--     are civil days encoded in the timestamp's date part, not instants.
--     Do not apply a timezone conversion (an 18:00 value stays on that date).
--
-- Old application code can keep writing a timestamp after this migration.
-- PostgreSQL casts timestamp without time zone to date using the timestamp's
-- calendar date, so 00:00 and 06:00 of the same day still land on that day.

ALTER TABLE "LoanPayment"
  ALTER COLUMN "due_date" TYPE DATE
  USING (
    CASE
      WHEN "due_date"::time = TIME '00:00:00' THEN "due_date"::date
      WHEN "due_date"::time = TIME '06:00:00' THEN "due_date"::date
      ELSE "due_date"::date
    END
  );
