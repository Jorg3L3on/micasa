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

## Rules that fixtures lock

- MSI period cash is `msiInstallment`. `balanceTotal` is never the payment.
- A payment below `minimumDue` is not `pay_minimum`.
- Tier-1 labels (rent, mortgage, utilities, insurance, tuition, payroll) are not cut on the primary route. An alternative may show that cut with `untouchable_conflict`. If every draft touches an untouchable, the primary is the empty route, never that cut.
- Bridge and consolidation run only with caller-supplied APR, term, and fee. They always carry `approval_uncertain`.
- A consolidation APR at or above the balance-weighted APR is not the primary route.
- Missing APR defaults to `exclude_from_apr_rank`. `assume_median` (36%) and `assume_high` (72%) run only when the caller opts in. Missing APR or a card minimum sets `confidence: low` and a data gap. A loan installment is not copied into `minimumDue`.
- The Plan tab opens on **quincena**. Quincena does not split monthly income in half. An MSI installment enters that fortnight only when its schedule has a civil due date inside it. Without a date, the plan records `undated_obligation` and does not invent a day. `balanceTotal` is never the period payment.

## Golden cases

`golden/*.json` plus `build-cash-plan.golden.test.ts`. Labels and amounts are synthetic (`Tarjeta A`, round pesos). Do not put real household names, balances, or owner ids in these files.
