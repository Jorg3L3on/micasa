## Parent

#93

## What to build

On **Plan de quincena (Dashboard)**, Préstamos must never present wallet cash-outflow and nómina income deductions as a single undifferentiated “pendiente de préstamo.”

End-to-end behavior:

- Dashboard API exposes an explicit **wallet-only** pending loan total (derived from the same partition rules as Panel financiero: `walletDue` for SCHEDULED wallet loan payments, not payroll).
- **`planningLoanPayments.pendingTotal` must not drive UI** for the headline Préstamos metric when it mixes both sources; either rename semantics or add `planningWalletLoanDue` on the Dashboard DTO and consume that in UI.
- Stat **“Préstamos”** shows wallet pending only (or two labeled lines: billetera / nómina)—aligned with Stat **“Pendiente”** and **Efectivo neto en cuentas**.
- **Préstamos del periodo** card splits wallet pending vs deducción de nómina (mirror Panel financiero footnotes).
- **Próximas obligaciones** (data layer, even if not yet mounted): description uses payment source:
  - `WALLET` → `Pago préstamo: {loanName}`
  - `PAYROLL_DEDUCTION` → `Deducción nómina: {loanName}`
- **Overdue alerts** that include loan payments use the same label distinction in description text.
- Balance, percent committed, and funding net formulas unchanged; only presentation and DTO fields.

Partition shape (from PRD prototype):

```
PlanningLoanPartition {
  walletDue: { total, count }
  payrollDeduction: { total, count }
  walletPaidWithoutExpense: number
}
```

## Acceptance criteria

- [ ] With one SCHEDULED wallet loan and one SCHEDULED payroll loan in the same fortnight, Dashboard Stat “Préstamos” amount equals **wallet due only**, not the sum of both.
- [ ] `planningPayrollLoanDeduction` remains exposed and visible in Préstamos del periodo card (or equivalent split UI).
- [ ] Upcoming obligation entries for payroll loans show “Deducción nómina” in description; wallet loans show “Pago préstamo”.
- [ ] Overdue alert copy distinguishes payroll vs wallet when both are overdue in the period.
- [ ] `dashboard.service.test.ts` covers mixed-type fortnight: wallet pending ≠ mixed total; payroll in deduction field only.
- [ ] `npm test` passes for touched test files; no change to balance/fundingNet math regressions.

## Blocked by

None - can start immediately.
