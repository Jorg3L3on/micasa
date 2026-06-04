## Parent

#86

## What to build

Match the **Resumen de la 1ª quincena** card in the reference mock (Jun 2026).

Replace the full-circle ring with a **semi-circular (180°) gauge** (purple/blue gradient stroke). Center: `{n}%` + **del ingreso** (mock says “del presupuesto usado” — product uses **ingreso comprometido**). Hide gauge when ingresos ≤ 0.

**Collapsed layout — one outer card:**
- **Left:** semi-circular gauge (compact height, minimal empty space).
- **Right column:**
  - **Disponible para gastar** — largest amount on the card; gradient emphasis on the value (sky/emerald per fintech tokens).
  - **Below:** two **compact sub-boxes** (mock dark tiles), side by side on desktop:
    - **Ingresos del periodo** — amount + accent dot (violet).
    - **Dinero en cuentas** — amount + accent dot (emerald); existing funding-net rules when calendar fortnight applies.
- **Not** three equal columns; **not** heavy bordered mini-cards like v1.

**Mobile:** gauge between title/date and hero block; same hierarchy.

**Expanded** chevron: keep existing detailed breakdown (colored blocks) unchanged.

Wire via `FortnightIncomeGauge` + `FortnightSummaryHero` (or equivalent) through `SummaryBlock` on the monthly panel.

## Acceptance criteria

- [ ] Layout visually matches mock: gauge left, hero Disponible right, two sub-boxes underneath
- [ ] Semi-circular gauge with “del ingreso” when income > 0
- [ ] Disponible para gastar is the dominant typographic element
- [ ] Ingresos and Dinero en cuentas in compact sub-boxes with dot accents
- [ ] Tighter padding than v1 (no large empty gauge margins)
- [ ] Expanded summary unchanged functionally
- [ ] Unit tests for commitment % + gauge accessibility label
- [ ] `npm run build` passes

## Blocked by

- #87
