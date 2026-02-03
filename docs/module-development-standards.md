# Module Development Standards — MiCasa

This document defines the **established development standards** for building catalog-style modules in the MiCasa application.

These rules are **not theoretical best practices**. They are **inferred from existing, accepted modules** (`categories`, `expenses`, `expense-templates`, `income-templates`) and must be followed to ensure consistency, maintainability, and predictable structure across the codebase.

---

## 1. Layout & Route Structure

### 1.1 Layout requirement

Every dashboard catalog **must** include a `layout.tsx` file.

**Location**
`src/app/(dashboard)/<catalog>/layout.tsx`

**Rules**

- Export `metadata` using Next.js `Metadata`
- Include:
  - `title`
  - short `description`
- The default export **must render `children` only**
- No UI, logic, or side effects inside layouts

---

## 2. Types & Data Shapes

### 2.1 Catalog list/entity types

Types representing:

- list rows
- table items
- GET responses used in pages

**must live in**
`src/types/catalog.ts`

**Rules**

- Pages **must not define inline types** for catalog entities
- Pages import types from `@/types/catalog`
- Follow existing naming patterns:
  - `CategoryOption`
  - `ExpenseTemplateListItem`
  - `IncomeTemplateListItem`

**Correct**

```ts
import { WalletListItem } from '@/types/catalog';
```

**Incorrect**

```ts
type Wallet = { ... };
```

---

## 3. User Feedback & Notifications

### 3.1 Success feedback

After **create**, **update**, or **delete** operations:

- Use **Sonner**

- Call `toast.success(...)`

- Messages must be **short and in Spanish**

**Examples**

- “Creado correctamente”

- “Actualizado”

- “Eliminado”

### 3.2 Error feedback

- Inline error banners are valid

- For user-visible failures (e.g. delete conflicts), also use:

```ts
toast.error(...)
```

---

## 4. Formatting & Shared Utilities

### 4.1 Currency formatting

All money values **must** be formatted using the shared utility:

```ts
import { formatCurrency } from '@/lib/utils';
```

**Rules**

- No local `Intl.NumberFormat`

- No `formatAmount` helpers in pages

- Currency formatting must be centralized

---

## 5. Schemas & Validation (Zod)

### 5.1 Create vs Update schemas

When update behavior differs or allows partial input:

- Use separate schemas

  - `createXSchema`

  - `updateXSchema`

**Rules**

- `POST` → create schema

- `PUT` → update schema

- Update schemas may have optional fields

❌ Do not reuse create schemas for PUT handlers

---

## 6. API Route Conventions

### 6.1 ID handling

For routes using query parameters:

```ts
const id = searchParams.get('id');

if (!id || isNaN(Number(id))) {
  // return 400
}

const numericId = Number(id);
```

This pattern must be consistent across all catalog APIs.

### 6.2 Error handling

API handlers must map errors explicitly:

| Error type              | HTTP status         |
| ----------------------- | ------------------- |
| ZodError                | 400                 |
| Prisma P2025            | 404                 |
| Prisma P2002            | 409                 |
| Related record conflict | 409                 |
| Unknown error           | 500 + console.error |

### 6.3 DELETE with related records

Before calling `prisma.<model>.delete()`:

- Explicitly check for related records

- Example: `findFirst` on referencing tables

- If found:

  - Return 409

  - Provide a clear Spanish message

❌ Do not rely solely on Prisma foreign-key errors

---

## 7. Forms (Dialog-based CRUD)

### 7.1 Submit behavior

All forms must:

- Disable submit while submitting

```ts
disabled={form.formState.isSubmitting}
```

- Show loading state:

  - `Loader2`

  - Text: “Creando…”, “Actualizando…”, or “Guardando…”

### 7.2 Submit button copy

Primary action button text:

| Mode   | Label          |
| ------ | -------------- |
| Create | **Crear**      |
| Edit   | **Actualizar** |

Dialog titles may still use:

- “Agregar …”

- “Editar …”

---

## 8. Page Structure (List + CRUD)

Catalog pages follow this structure:

- Primary action button aligned top-right

- Error banner visible when `error` exists

- Main content wrapped in a **Card**

- Content is either:

  - Table

  - EmptyState

- Loading state shows “Cargando…”

---

## 9. Accessibility

### 9.1 Action buttons

Edit and delete buttons **must** include aria-label.

**Example**

```tsx
aria-label={`Editar ${item.name}`}
aria-label={`Eliminar ${item.name}`}
```

This is required for screen readers.

## 10. Copy & Text Consistency

- Destructive confirmations should use:

> “Esta acción no puede deshacerse”

- Avoid variant spellings unless intentionally standardized

**Enforcement**

New modules **must comply** with this document

Existing modules should be incrementally aligned

AI agents are expected to **read and apply this file**
