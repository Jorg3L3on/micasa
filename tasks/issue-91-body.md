## Parent

#86

## What to build

Align the **month header row** on Panel financiero with the reference mock (above wallet strip).

Add or reposition:

1. **Cambiar periodo** — labeled button opening month navigation (reuse existing prev/next month targets or a compact month picker; same owner context).
2. **Filtros** — labeled button opening a menu for view options currently in the fortnight options menu where appropriate (e.g. mostrar resumen, densidad tabla) and any other monthly filters already supported.

Keep existing: month title, “Panel financiero mensual”, badge **Actual** when current month, prev/next month controls.

Optional if trivial: breadcrumb `Inicio > {Mes año}` consistent with other dashboard pages.

Do not change month card full-width behavior (stays full container width).

## Acceptance criteria

- [ ] “Cambiar periodo” and “Filtros” visible in header area per mock (Spanish labels)
- [ ] Cambiar periodo changes month (navigates or picks month correctly)
- [ ] Filtros menu works; existing preferences still persist
- [ ] No regression to owner context in month URLs
- [ ] `npm run build` passes

## Blocked by

None - can start immediately
