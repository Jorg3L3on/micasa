# Cash plan engine

Deterministic ranking for the Plan tab (`JOR-247`). Same `PlanInput` always returns the same `PlanResult`. Money is integer cents inside the sims. Narrative copy explains the numbers; it does not invent them.

## Weights

Shortfall composite (`score.ts`):

| Dimension | Weight | Direction |
| --- | --- | --- |
| Hole closed | 0.45 | higher better |
| Cost (interest + fees) | 0.25 | lower better |
| Risk tags | 0.20 | lower better |
| Runway | 0.06 | higher better |
| Credit line left | 0.04 | higher better |

Tie-break after composite: lower risk, then lower cost, then more runway, then id.

Surplus bonuses (not in the table above):

- Runway under 1 period of payments: `buffer_reserve` gets +0.35 so the cushion can be the primary route.
- Known APRs within 1 percentage point and snowball clears more debts in month 1: snowball gets +0.2 (momentum).

Changing weights or bonuses means review the files in `golden/` in the same change.

## Buffer rule

The buffer route keeps cash for the next period, in whole pesos (`bufferAmountCents`):

- Runway under 1 period (cash < one period of payments): `min(extra / 2, need − cash)`.
- Otherwise: `min(extra, need)`.
- Under $100 the buffer route is left out instead of proposing cents. A balanced period has no extra, so it has no `buffer-soft` route.

## Step fields

Each `ActionInstance` may carry:

- `dueDate`: the civil day (`YYYY-MM-DD`, America/Mexico_City) of the obligation it pays, from `Obligation.dueDate` when that obligation is due in the horizon. An undated obligation gives an undated step and, from `planInputFromLiquidity`, an `undated_obligation` gap.
- `fromWalletId`: the funding wallet with the highest balance in `PlanInput.fundingWallets` (ties go to the lower id), on every step that pays money out (not on deferrals, bridge or consolidation).
- `extra_to_debt_avalanche` / `extra_to_debt_snowball`: one step per debt the extra reaches (`obligationId`, amount), in the order the payoff simulation spends it (`extraAllocation`). If every debt reaches $0, what is left stays in cash as a `buffer_reserve` step, under the same buffer rule (whole pesos, at least $100).

Each `RankedPlan` may carry `debtsClosed`: the debts the route leaves at $0 this period (a payoff or consolidation in shortfall; in surplus, the debts the extra clears beyond what minimums alone would).

## Activar este plan

`apply-plan.service.ts` (pure mapping in `apply-plan-mapping.ts`) writes the chosen route to existing models:

- Card steps: one `CreditCardPaymentPlan` per card and quincena (statement + extra, capped at what the card owes). A missing quincena is created as the Panel does.
- Extra abono or payoff on a loan: one unpaid planned `Expense` ("Abono extra · <préstamo>") in that quincena on the source wallet. Scheduled installments are not touched.
- `defer_nonessential`: the unpaid expense moves to the next quincena; a paid one is refused.
- Cushion, MSI, bridge and consolidation write nothing.
- Running it again with the same amounts writes nothing.

## Rules that fixtures lock

- MSI period cash is `msiInstallment`. `balanceTotal` is never the payment.
- A payment below `minimumDue` is not `pay_minimum`.
- Tier-1 labels (rent, mortgage, utilities, insurance, tuition, payroll) are not cut on the primary route. An alternative may show that cut with `untouchable_conflict`. If every draft touches an untouchable, the primary is the empty route, never that cut.
- Bridge and consolidation run only with caller-supplied APR, term, and fee. They always carry `approval_uncertain`.
- A consolidation APR at or above the balance-weighted APR is not the primary route.
- Missing APR defaults to `exclude_from_apr_rank`. `assume_median` (36%) and `assume_high` (72%) run only when the caller opts in. Missing APR or a card minimum sets `confidence: low` and a data gap. A loan installment is not copied into `minimumDue`.
- The Plan tab opens on **quincena**. Quincena does not split monthly income in half: an income counts, whole, when its civil day (`projection.income_dates`: a registered income, or a template on its quincena's payday) falls inside the quincena from today on. A projection without `income_dates` leaves income out and records `income_monthly_only`. An MSI installment enters that fortnight only when its schedule has a civil due date inside it. Without a date, the plan records `undated_obligation` and does not invent a day. `balanceTotal` is never the period payment.

## Golden cases

`golden/*.json` plus `build-cash-plan.golden.test.ts`. Labels and amounts are synthetic (`Tarjeta A`, round pesos). Do not put real household names, balances, or owner ids in these files.
