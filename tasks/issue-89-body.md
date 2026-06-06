## Parent

#86

## What to build

Match the **right column** of the reference mock on `/monthly/[year]/[month]`.

### Data (`getOwnerContext`, month/year route params)

New read API or server loader field, e.g. `GET /api/monthly/[year]/[month]/budget-panel`:

- `totalBudget`, `spent`, `available` (calendar month, owner-scoped)
- `categories[]`: `id`, `name`, `icon?`, `spent`, `percentOfBudget` (0–100), ordered by spent desc (top 5–6)
- Empty state when no active budgets

Align **spent** with budgets page logic; document in service.

### UI — `MonthlyBudgetSidebar`

1. **Presupuesto del mes** (section title)
   - Prominent **total** (e.g. $17,800.00)
   - **Horizontal progress bar** with gradient fill (spent portion)
   - Caption row: **$X usado** · **$Y disponible** (exact amounts, not % only)

2. **Top categorías** (section title)
   - One row per category: **icon**, name, **spent amount**, **% del presupuesto**, thin **horizontal progress bar** (per-category accent color)
   - Show categories from API (mock lists Alimentos, Transporte, Servicios, Entretenimiento, Otros)

3. **Ver reporte completo** — button with chart icon → `/budgets` or monthly report route

### Page layout

- **xl+:** CSS grid `2fr` main (wallets, controls, single fortnight, tabs) + `1fr` sidebar aligned with summary/transactions column
- **< xl:** sidebar **below** main column

No regression to wallet strip or fortnight tabs.

## Acceptance criteria

- [ ] Sidebar visible on desktop right of main content (mock proportions)
- [ ] Presupuesto del mes shows total + gradient bar + $ usado / $ disponible labels
- [ ] Top categorías lists rows with icon, amount, percentage, and mini progress bar each
- [ ] “Ver reporte completo” navigates to appropriate budgets/report page
- [ ] Empty state when no budgets (clear copy, no broken layout)
- [ ] Owner context (user vs house) respected in API
- [ ] Service test for aggregate payload
- [ ] `npm run build` passes

## Blocked by

None - can start immediately
