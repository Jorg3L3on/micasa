## Parent

#86

## What to build

Update `scripts/playwright-panel-financiero.sh` (or equivalent) to validate the v2 Panel financiero after slices #87–#89 (and #91 when merged): login, open current month, assert **no “Ambas”** control, **Quincena** group present, collapsed summary shows **“del ingreso”** on gauge when income > 0, sidebar shows **Presupuesto del mes**, **Top categorías**, and **Ver reporte completo**, header shows **Cambiar periodo** and **Filtros** when #91 is done.

Capture desktop + mobile screenshots to `output/playwright/`.

Script must fail clearly when assertions fail (no false-positive pass on Playwright errors).

## Acceptance criteria

- [ ] Script passes against local dev with seed credentials when PostgreSQL and `npm run dev` are up
- [ ] Asserts absence of “Ambas” / “Una quincena” period toggle
- [ ] Asserts gauge copy “del ingreso” when gauge visible
- [ ] Asserts sidebar headings “Presupuesto del mes” and “Top categorías”
- [ ] Asserts “Ver reporte completo” control present
- [ ] Asserts “Cambiar periodo” and “Filtros” in header (after #91)
- [ ] Writes `panel-financiero-desktop.png` and `panel-financiero-mobile.png`
- [ ] README or PRD note on how to run the script (one line in issue comment acceptable)

## Blocked by

- #87
- #88
- #89
- #91
