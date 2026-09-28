---
name: responsive-overlay
description: Build or migrate a MiCasa modal/sheet/confirm onto the shared overlay standard (Dialog on desktop, bottom Sheet on mobile, grouped-row body). Use when adding a form overlay, restyling a dialog or sheet, replacing an AlertDialog, or when a dialog "looks different" from Panel financiero.
---

# /responsive-overlay

Spec: `DESIGN.md` → **Overlays (Dialog / Sheet)**. Rule: `.cursor/rules/responsive-overlays.mdc`. Reference: `src/components/quick-capture/QuickExpenseSheet.tsx` (Agregar gasto).

## 1. Audit the target

```bash
rg -n 'type="date"|<FormLabel>|mr-\[2.5rem\]|w-\[5rem\]|AlertDialog|isMobile|grid-cols-2|bg-destructive/15' <file>
```

Every hit is a candidate for replacement with a kit primitive.

## 2. Shell

```tsx
<ResponsiveOverlay
  open={open}
  onOpenChange={onOpenChange}
  title="Agregar ingreso"
  description="Una frase para lectores de pantalla."
  busy={submitting}
>
  {({ handleSelectOpenChange }) => (open ? body(handleSelectOpenChange) : null)}
</ResponsiveOverlay>
```

No `Dialog`, `Sheet`, header, or Cancelar of your own. Do not read `useIsMobile()` to size fields.

## 3. Body skeleton

```tsx
<form onSubmit={handleSubmit} className="flex flex-col gap-3">
  <OverlayHint role="status">{contextLine}</OverlayHint>        {/* optional */}
  {error ? <OverlayErrorBanner>{error}</OverlayErrorBanner> : null}

  <div className={OVERLAY_GROUPED_CARD_CLASS}>
    <FormField control={form.control} name="walletId" render={({ field }) => (
      <FormGroupedRow label="Billetera">
        <Select value={...} onValueChange={...} onOpenChange={handleSelectOpenChange}>
          <FormControl>
            <SelectTrigger className={OVERLAY_ROW_TRIGGER_CLASS}>
              <SelectValue placeholder="Selecciona" />
            </SelectTrigger>
          </FormControl>
          <SelectContent>…</SelectContent>
        </Select>
      </FormGroupedRow>
    )} />
    <FormField control={form.control} name="amount" render={({ field }) => (
      <FormAmountRow value={field.value} onChange={field.onChange} />
    )} />
    <FormField control={form.control} name="name" render={({ field }) => (
      <FormGroupedRow label="Nombre">
        <FormControl><Input className={OVERLAY_ROW_INPUT_CLASS} {...field} /></FormControl>
      </FormGroupedRow>
    )} />
    <FormField control={form.control} name="date" render={({ field }) => (
      <FormGroupedRow label="Fecha">
        <DateStepper value={field.value} onChange={field.onChange} />
      </FormGroupedRow>
    )} />
  </div>

  <OverlayHint>{hint}</OverlayHint>                              {/* below the card */}

  <ToggleField layout="row" className="px-3" label="¿Ya se pagó?" … />

  <Button type="submit" disabled={submitting} className={OVERLAY_PRIMARY_BUTTON_CLASS}>
    {submitting ? 'Guardando…' : 'Guardar'}
  </Button>
</form>
```

Without react-hook-form use `GroupedRow` (`htmlFor` + `id`) and `AmountRow`.

## 4. Field mapping

| You have | Use |
| --- | --- |
| Stacked `FormLabel` + `Input` | `FormGroupedRow` + `OVERLAY_ROW_INPUT_CLASS` |
| Stacked label + `Select` | `FormGroupedRow` + `OVERLAY_ROW_TRIGGER_CLASS` |
| `CurrencyInput` with `$` | `FormAmountRow` / `AmountRow` |
| Secondary money field (e.g. límite, comisión) | `AmountRow` in its own card under `OverlaySectionLabel`, or `GroupedRow` + `CurrencyInput hideSymbol` with `OVERLAY_ROW_NUMBER_INPUT_CLASS` |
| `<input type="date">` required | `DateStepper` |
| `<input type="date">` nullable | `OptionalDateStepper` |
| `type="number"` | `GroupedRow` + `Input` with `OVERLAY_ROW_NUMBER_INPUT_CLASS` |
| `Textarea` | `GroupedRow` + `Textarea` with `OVERLAY_ROW_TEXTAREA_CLASS` |
| Member picker | `MemberAssigneeSelect hideLabel triggerClassName={OVERLAY_ROW_TRIGGER_CLASS}` in a "Miembro" row (house context only) |
| Error box | `OverlayErrorBanner` |
| Helper `<p>` | `OverlayHint` below the card |
| Section heading | `OverlaySectionLabel` + second `OVERLAY_GROUPED_CARD_CLASS` |
| Extra action buttons | ghost `OVERLAY_SECONDARY_BUTTON_CLASS` under the primary |
| `AlertDialog` confirm | `ConfirmDeleteDialog` (`tone="default"` when not destructive) |

Missing primitive? Add it to `src/components/overlay/overlay-form.tsx` and document it in the DESIGN.md size table.

## 5. Verify

1. Open the overlay at **390px** (sheet) and **1280px** (dialog) in dark mode.
2. Open Agregar gasto (Panel financiero → plus) at the same widths and compare row height, label column, amount size, hint placement, and the primary.
3. Open every Select inside the sheet, close it, and confirm the sheet does not dismiss.
4. `npx tsc --noEmit` and `npx eslint <touched files>`.
