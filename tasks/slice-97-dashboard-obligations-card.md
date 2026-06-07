## Parent

#93

## What to build

Resolve orphaned **Dashboard** components related to obligations and disponible vs comprometido so the Plan de quincena layout does not drift from maintained code paths.

End-to-end behavior (choose one coherent outcome and implement fully):

**Preferred:** Mount **Próximas obligaciones** (`UpcomingObligationsCard`) on Dashboard with split semantics from the parent PRD—payroll items labeled as deducción nómina, wallet items as pago préstamo, actions route to `/loans` for loan payments.

**Also:** Either mount **AvailableVsCommittedCard** with correct payroll footnotes (libre / pagado / pendiente aligned with DTO) **or** remove it from the dashboard barrel export and delete dead code if redundant with current Stat cards + FundingNetCard.

Do not leave exported components that contradict mounted Dashboard UI.

## Acceptance criteria

- [ ] Dashboard page renders an obligations section OR documents intentional omission in code comment on DashboardPanel—no orphaned export-only components.
- [ ] If mounted, Próximas obligaciones uses split loan descriptions (depends on dashboard service slice).
- [ ] If AvailableVsCommitted is mounted, payroll deduction footnote appears when `planningPayrollLoanDeduction` > 0; if removed, export cleaned up.
- [ ] Layout follows ui-consistency rules (one primary CTA per block, calm shells).
- [ ] Manual smoke: Dashboard loads without duplicate obligation UX.

## Blocked by

- https://github.com/Jorg3L3on/micasa/issues/94 (Dashboard split metrics and obligation labels must land first)
