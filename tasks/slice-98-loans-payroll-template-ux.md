## Parent

#93

## What to build

On **`/loans`**, improve soft UX for **payroll loans** (`PAYROLL` + `PAYROLL_DEDUCTION`) when **income template** is optional—without schema enforcement or migration.

End-to-end behavior:

- Create form: explain that linking **Ingreso relacionado** improves labels in Panel financiero (“Nómina: {plantilla}”) but remains optional.
- Edit form: same guidance; show honest fallback copy when no template linked.
- Loan detail / list: when `paymentSource === PAYROLL_DEDUCTION` and `incomeTemplateId` is null, show generic **Deducción de nómina** label—not wallet language.
- No change to create schema required fields; no Prisma migration.

## Acceptance criteria

- [ ] Creating payroll loan without income template still succeeds.
- [ ] UI copy on create/edit explains optional template benefit in Spanish, matching existing tone.
- [ ] Loan list/detail distinguishes missing template vs linked template for payroll loans.
- [ ] Planning surfaces continue to show generic deducción copy when template absent (regression guard via existing mapping tests or snapshot of label helper).
- [ ] `npm test` passes; no schema changes.

## Blocked by

None - can start immediately.
