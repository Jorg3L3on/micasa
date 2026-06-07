## Parent

#93

## What to build

On **Panel financiero** (quincena summary via report API + SummaryBlock + FortnightSummaryHero), counters and hero copy must match how Préstamos appear in planning—especially **deducciones de nómina** that reduce ingreso disponible but are not wallet pendiente.

End-to-end behavior:

- Report summary API (`exclude_credit_installment=true`, scoped fortnight) returns counts consistent with the Gastos table policy: **Option A**—scheduled payroll loan synthetic rows remain visible in Gastos; summary counters reconcile so users trust `pagado/pendiente` X/Y labels.
- Include scheduled payroll loan rows in planning row counts (with footnote/sub-label distinguishing them from wallet loan due and ordinary gastos), or document equivalent breakdown in SummaryBlock—**without changing balance math**.
- **FortnightSummaryHero** “Libre del ingreso” subtitle mentions deducciones de nómina when payroll deduction total > 0 (prop-driven from summary).
- **FortnightColumn** / monthly Summary TypeScript types include `planningWalletLoanDue` and `planningPayrollLoanDeduction` (API already returns them).
- Dual fortnight monthly view: each column’s summary still reflects only that fortnight’s wallet due and payroll deduction (regression guard).

## Acceptance criteria

- [ ] Fortnight with wallet + payroll SCHEDULED loans: `balance` unchanged from current correct formula; footnotes still break out wallet due and nómina separately.
- [ ] Summary gasto counters no longer under-count vs visible Gastos table rows when payroll synthetic loan rows are present (document policy in UI footnote if needed).
- [ ] FortnightSummaryHero subtitle references nómina deductions when applicable.
- [ ] TypeScript Summary types in FortnightColumn/monthly path include loan planning fields.
- [ ] `report-summary.service` test (or extended parity test) asserts count policy with mixed loan types in one fortnight.
- [ ] `npm test` passes.

## Blocked by

None - can start immediately.
