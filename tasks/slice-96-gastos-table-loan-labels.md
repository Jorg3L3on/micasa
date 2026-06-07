## Parent

#93

## What to build

In Panel financiero **Gastos** table, synthetic **loan payment** planning rows must be visually distinguishable so users do not read a **deducción de nómina** as a billetera outflow.

End-to-end behavior:

- Scheduled loan payments injected via planning transactions keep appearing in the Gastos list (no removal).
- Rows for `PAYROLL_DEDUCTION` loans use distinct badge/label copy (e.g. “Deducción nómina” vs “Préstamo billetera” or similar)—not the generic “Préstamo” badge alone.
- Wallet-sourced loan rows remain clearly wallet-oriented (existing HandCoins / billetera context).
- If `TransactionRow` lacks payment-source metadata today, extend the planning transaction mapping end-to-end (API → table) with the minimum field needed—prefer reusing description/paymentMethod only if sufficient without ambiguity.
- Paid-toggle, edit, and delete remain disabled for planning-derived loan rows (regression guard).

## Acceptance criteria

- [ ] Side-by-side SCHEDULED wallet and payroll loan rows in the same fortnight are visually distinct in Gastos table (badge or label text).
- [ ] Payroll row does not imply a funding wallet outflow in the wallet column when no wallet applies.
- [ ] Wallet loan row still shows source wallet name when configured.
- [ ] Planning loan row actions remain non-mutating from Gastos table.
- [ ] Test coverage for transaction row mapping or ExpenseTable rendering contract (unit level acceptable).
- [ ] `npm test` passes.

## Blocked by

None - can start immediately.
