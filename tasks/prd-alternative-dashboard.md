# PRD: Alternative Dashboard Rebuild

## Problem Statement

The home dashboard (“Plan de quincena / Resumen mensual”) hides the information users need most. Wallet balances sit at the bottom of the page, the KPI strip omits total expenses and disponible cash, and existing insight cards for income breakdown, expense health, and fixed-vs-variable spending are implemented but not mounted. Users must leave Inicio for `/wallets`, `/fortnight`, or `/expenses` to see context the API already returns in `DashboardData`.

## Solution

Rebuild `DashboardPanel` with a wallet-first, scannable hierarchy: period chrome → wallets hero → period KPIs (ingresos, gastos, presupuesto libre, disponible) → committed-cash bar + budget summary → income/expense insight cards → category pie / period comparison → obligations, loans, alerts, and recent activity. Reuse the existing `DashboardData` payload and remount orphan dashboard cards. Align accents with the fintech design system (orange wallets, emerald income, violet expenses, sky budget).

## User Stories

1. As a household planner, I want to see my wallet balances near the top of Inicio, so that I know cash and card position before scrolling.
2. As a user, I want “Efectivo neto en cuentas” next to my cards strip, so that funding net and card mosaics are one glance.
3. As a planner, I want a Gastos KPI for the selected period, so that spending is as visible as income.
4. As a planner, I want a Disponible KPI from available vs committed, so that I know what cash is still free.
5. As a planner, I want Presupuesto libre in the KPI strip, so that budget headroom is always visible.
6. As a planner, I want a segmented bar of pagado / pendiente / libre, so that commitment is easy to scan.
7. As a planner, I want the budget summary card with category bars near the top, so that budget health is not buried.
8. As a house member, I want income breakdown by person, so that I see who contributed this period.
9. As a planner, I want expense health (committed %, overdue, largest expense), so that I spot pressure early.
10. As a planner, I want fixed vs variable expense mix, so that I understand structural vs discretionary spend.
11. As a planner, I want category pie and period comparison, so that mix and deltas are available without leaving home.
12. As a planner, I want upcoming obligations and loan summary below insights, so that I can act after I understand the period.
13. As a planner, I want alerts only when present, so that quiet periods stay calm.
14. As a planner, I want recent activity at the bottom, so that I can audit latest movements.
15. As a planner, I want Mes / Quincena toggle preserved, so that period scope stays familiar.
16. As a mobile user, I want sections to stack cleanly with readable money typography, so that the rebuild works on small screens.
17. As a dark-mode user, I want semantic accents with dark variants, so that contrast stays correct.
18. As a house-context user, I want owner-scoped data unchanged, so that switching user/house still works.
19. As a product owner, I want no new dashboard API for v1, so that the rebuild ships on existing DTO fields.
20. As a developer, I want metric strips to pass `validate:dashboard-ui`, so that CI keeps the calm-shell rule.

## Implementation Decisions

- Direct rebuild of `DashboardPanel` on branch `cursor/alternative-dashboard-6a2f` (no layout toggle / A-B flag).
- No changes to `getDashboardData` / `/api/dashboard` contracts for v1; all UI reads existing `DashboardData`.
- Section order: chrome → wallets hero (FundingNet + MyCardsPanel) → KPI strip → committed cash bar → budget summary → income/expense insights → analysis (pie + comparison) → obligations + loans → alerts → recent activity.
- Hero KPIs: Ingresos, Gastos, Presupuesto libre, Disponible. Demote Pendiente and Préstamos out of the hero strip (loans remain in `DashboardLoanSummaryCard`).
- Remount orphan components: `IncomeBreakdownCard`, `ExpenseHealthCheckCard`, `FixedVsVariableCard`, `PeriodComparisonCard`, `RecentActivityCard`.
- New `DashboardCommittedCashBar` renders `availableVsCommitted` with the fintech segmented-bar pattern and `DASHBOARD_METRIC_STRIP_CLASS` / left-border accents.
- Surface `creditWalletDebtTotal` and `creditWalletAvailableTotal` as compact metric strips in the wallets hero row.
- Color mapping: orange wallets/cash, emerald income/disponible, violet expenses, sky budget, amber loans.
- Out of band for this PRD: LiquidityTeaserCard, QuickActionsCard, MonthlyOverviewChart, per-wallet income/expense grouping APIs.

## Testing Decisions

- Prefer external behavior: existing `dashboard.service.test.ts` must still pass (no service regression).
- Run `npm run validate:dashboard-ui` so metric strips stay free of forbidden tinted fills.
- Manual QA on `/dashboard` with seed user Jorge: Mes/Quincena toggle, wallet strip above KPIs, four hero KPIs including Gastos and Disponible, budget + insight cards visible, obligations/loans still present.
- Do not add brittle snapshot tests of Tailwind class lists; prefer service tests and UI validation scripts already in CI.

## Out of Scope

- Layout toggle / dual dashboards
- New API fields for per-wallet income or expense grouping
- Remounting LiquidityTeaserCard or QuickActionsCard
- Moving MonthlyOverviewChart onto Inicio
- Changing funding-net math, balance formulas, or loan partition calculation rules (presentation only for loans card placement)

## Acceptance Criteria

- [ ] Branch `cursor/alternative-dashboard-6a2f` contains the rebuilt panel
- [ ] MyCardsPanel appears above the period KPI strip
- [ ] KPI strip shows Ingresos, Gastos, Presupuesto libre, Disponible (not Préstamos / Pendiente as hero KPIs)
- [ ] DashboardCommittedCashBar renders pagado / pendiente / libre from `availableVsCommitted`
- [ ] Budget summary, income breakdown, expense health, fixed vs variable, category pie, period comparison, obligations, loan summary, alerts (when any), and recent activity are mounted in the planned order
- [ ] No `bg-*-500/5` fills on dashboard metric strips (`validate:dashboard-ui` passes)
- [ ] `npm test` passes for dashboard service tests
- [ ] Mes / Quincena URL toggle still works

## Further Notes

Parent workflow: local PRD → optional `/ship-feature` for GitHub parent + slice issues. Slice order in the implementation plan: branch/PRD → layout skeleton → KPI strip → committed bar → remount cards → polish/validate.
