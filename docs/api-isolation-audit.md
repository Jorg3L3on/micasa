# API cross-tenant isolation audit

**Phase:** 1.3 · Security & data integrity  
**Issue:** [#108](https://github.com/Jorg3L3on/micasa/issues/108)  
**Date:** 2026-07-24  
**Scope:** All `src/app/api/**/route.ts` handlers (76 files).

## Response policy

| Situation | Status |
|-----------|--------|
| Unauthenticated | `401` |
| Invalid owner context (e.g. non-member house, `ownerId` ≠ session user) | `403` |
| Resource id exists under another owner | `404` (hide existence; no enumeration) |

Isolation is application-layer only (`getOwnerContext` + `ownerFilter` / equivalent). There is no Postgres RLS backstop yet (stretch).

## Summary

| Status | Count |
|--------|------:|
| `ok` | 70 |
| `n/a` | 6 |
| `gap` (HTTP routes) | 0 |

**Service-layer note (defense-in-depth):** `updateExpense` / `toggleExpensePaid` / `deleteExpense` historically looked up by id only after the route gate. Hardened in 1.3 to require `ownerFilter`. Legacy unused `updateWalletMetadata` / `deleteWalletIfUnused` (id-only) removed in favor of `*ForOwner` variants.

## Legend

- **getOwnerContext:** route calls `getOwnerContext(request)` and early-returns on error
- **By-id ownership:** lookups/mutations use `ownerFilter`, `*ForOwner`, or pantry `pantryReceiptOwnerWhere` / cart owner where
- **Status:** `ok` | `gap` | `n/a`

## Inventory

| Path | Methods | getOwnerContext | By-id ownership | Status | Notes |
|------|---------|-----------------|-----------------|--------|-------|
| `/api/account` | PATCH | no | session user | n/a | Own profile via `auth()` |
| `/api/auth/[...nextauth]` | POST | no | — | n/a | NextAuth |
| `/api/auth/register` | POST | no | — | n/a | Public registration |
| `/api/budget-templates` | GET | yes | list scoped | ok | |
| `/api/budgets` | GET, POST | yes | ownerFilter | ok | |
| `/api/budgets/[id]` | PATCH, DELETE | yes | ownerFilter in service | ok | |
| `/api/budgets/[id]/active` | PATCH | yes | ownerFilter | ok | |
| `/api/budgets/[id]/allocations` | PUT | yes | ownerFilter | ok | |
| `/api/budgets/history` | GET | yes | ownerFilter | ok | |
| `/api/budgets/periods/[periodId]/expenses` | GET | yes | ownerFilter | ok | |
| `/api/categories` | GET, POST, PUT, DELETE | yes | ownerFilter | ok | Owner-scoped (not global) |
| `/api/credit-cards` | GET, POST | yes | ownerFilter | ok | |
| `/api/credit-cards/[id]` | GET, PATCH | yes | `*ByOwner` / `*ForOwner` | ok | |
| `/api/credit-cards/[id]/payment` | POST | yes | ownerFilter | ok | |
| `/api/credit-cards/[id]/payment-plan` | GET | yes | ownerFilter | ok | |
| `/api/credit-cards/[id]/payments` | GET | yes | ownerFilter | ok | |
| `/api/credit-cards/[id]/payments/[paymentId]` | DELETE | yes | ownerFilter | ok | |
| `/api/credit-cards/[id]/purchase` | POST | yes | ownerFilter | ok | |
| `/api/credit-cards/[id]/statement` | GET | yes | ownerFilter | ok | |
| `/api/credit-cards/[id]/statement-imports` | GET, POST | yes | ownerFilter | ok | |
| `/api/credit-cards/[id]/statement-imports/[importId]` | DELETE | yes | ownerFilter | ok | |
| `/api/credit-cards/[id]/statement-imports/[importId]/file` | GET | yes | ownerFilter | ok | |
| `/api/credit-cards/installment-projection` | GET | yes | ownerFilter | ok | |
| `/api/credit-cards/reconciliation` | GET, POST | yes | ownerFilter | ok | |
| `/api/dashboard` | GET | yes | ownerFilter | ok | |
| `/api/dashboard/monthly-summary` | GET | yes | ownerFilter | ok | |
| `/api/expense-templates` | GET, POST, PUT, DELETE | yes | ownerFilter | ok | |
| `/api/expenses` | POST | yes | ownerFilter | ok | |
| `/api/expenses/[id]/paid` | PATCH | yes | route gate + service `ownerFilter` | ok | |
| `/api/expenses/duplicate` | POST | yes | ownerFilter | ok | |
| `/api/expenses/recent` | GET | yes | ownerFilter | ok | |
| `/api/fortnights` | GET | yes | ownerFilter | ok | |
| `/api/fortnights/[id]/card-payment-plans` | PUT, DELETE | yes | ownerFilter | ok | |
| `/api/fortnights/[id]/override-amount` | PUT | yes | findFirst + ownerFilter | ok | |
| `/api/fortnights/[id]/regenerate-from-templates` | POST | yes | ownerFilter | ok | |
| `/api/fortnights/create-month` | POST | yes | ownerFilter | ok | |
| `/api/fortnights/created-months` | GET | yes | ownerFilter | ok | |
| `/api/house-users` | GET, POST | yes | house membership | ok | |
| `/api/house-users/[userId]` | DELETE | yes | house membership | ok | |
| `/api/houses` | GET, POST | no | session user | n/a | List/create houses for caller |
| `/api/income-templates` | GET, POST, PUT, DELETE | yes | ownerFilter | ok | |
| `/api/incomes` | GET, PUT, POST | yes | ownerFilter | ok | |
| `/api/loans` | GET, POST | yes | ownerFilter | ok | |
| `/api/loans/[id]` | PATCH, DELETE | yes | `*ForOwner` | ok | Not-found mapped to `404` |
| `/api/loans/payments/[id]` | PATCH | yes | `*ForOwner` | ok | |
| `/api/loans/planner` | GET | yes | ownerFilter | ok | |
| `/api/monthly/[year]/[month]/budget-panel` | GET | yes | ownerFilter | ok | |
| `/api/onboarding` | POST | no | session user | n/a | |
| `/api/onboarding/complete` | POST | no | session user | n/a | |
| `/api/pantry/insights` | GET | yes | owner where | ok | |
| `/api/pantry/products` | GET, POST | yes | owner where | ok | |
| `/api/pantry/products/[id]` | PATCH, DELETE | yes | owner where | ok | |
| `/api/pantry/receipts` | GET, POST | yes | pantryReceiptOwnerWhere | ok | |
| `/api/pantry/receipts/[id]` | GET, PATCH, DELETE | yes | pantryReceiptOwnerWhere | ok | |
| `/api/pantry/receipts/[id]/expense` | POST | yes | owner where | ok | |
| `/api/pantry/receipts/[id]/file` | GET | yes | owner where | ok | |
| `/api/pantry/receipts/[id]/reconcile` | POST | yes | owner where | ok | |
| `/api/pantry/shopping-carts` | GET, POST | yes | owner where | ok | |
| `/api/pantry/shopping-carts/[id]` | GET, PATCH, DELETE | yes | owner where | ok | |
| `/api/pantry/shopping-carts/[id]/activity` | GET | yes | owner where | ok | |
| `/api/pantry/shopping-carts/[id]/check-all` | PATCH | yes | owner where | ok | |
| `/api/pantry/shopping-carts/[id]/items` | POST | yes | owner where | ok | |
| `/api/pantry/shopping-carts/[id]/items/[itemId]` | PATCH, DELETE | yes | owner where | ok | |
| `/api/pantry/shopping-carts/[id]/items/bulk` | POST | yes | owner where | ok | |
| `/api/pantry/shopping-carts/[id]/items/check-all` | PATCH | yes | owner where | ok | |
| `/api/pantry/shopping-carts/[id]/status` | PATCH | yes | owner where | ok | |
| `/api/reports` | GET | yes | ownerFilter | ok | |
| `/api/transactions` | GET, POST, PUT, DELETE | yes | findFirst + ownerFilter; service `ownerFilter` | ok | |
| `/api/transfers` | GET, POST | yes | ownerFilter | ok | |
| `/api/wallets` | GET, POST, PUT, DELETE, PATCH | yes | `*ForOwner` | ok | |
| `/api/wallets/[id]` | GET | yes | findFirst + ownerFilter | ok | |
| `/api/wallets/[id]/import` | POST | yes | ownerFilter | ok | |
| `/api/wallets/[id]/incomes` | POST | yes | ownerFilter | ok | |
| `/api/wallets/[id]/movements` | GET | yes | ownerFilter | ok | |
| `/api/wallets/due-payments` | GET | yes | ownerFilter | ok | |
| `/api/wallets/liquidity-projection` | GET | yes | ownerFilter | ok | |

## Priority domains covered by isolation suite

Vitest suite under `src/test/isolation/` (`npm run test:isolation`):

1. Expenses / transactions  
2. Wallets  
3. Fortnights  
4. Loans  
5. Budgets  
6. Pantry  
7. Credit cards  

Plus `getOwnerContext` house non-member → `403`.

## Review checklist (new routes)

When adding an API route:

1. Call `getOwnerContext(request)` (unless intentionally session-only — document as `n/a` here).
2. Scope every list and by-id query with `ownerFilter` (or domain equivalent).
3. Prefer `404` when the id exists under another owner.
4. Add or extend an isolation test if the route is by-id mutate/read on financial data.
5. Update this inventory.

## Stretch (out of v1 / not implemented)

- Postgres RLS policies on financial tables (defense-in-depth).
- Move `ownerType` / `ownerId` from query params + `localStorage` into server-validated JWT claims.
