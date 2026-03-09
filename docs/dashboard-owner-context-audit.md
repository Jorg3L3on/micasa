# Dashboard & Tabs – Owner Context Audit

This document confirms that all dashboard and tab data fetches respect the selected owner (user vs house).

## How owner context flows

1. **URL**: When the user selects a house or user in the team switcher, the URL gets `ownerType` and `ownerId` (e.g. `?ownerType=house&ownerId=1`). The sidebar keeps these params on all links via `searchParams` / `queryString`.
2. **Server pages**: Read `searchParams.ownerType` and `searchParams.ownerId`, build `ownerContext`, and pass it to `fetchFromApi(endpoint, ownerContext)`. The API base URL is then built with those query params.
3. **Client pages**: Use `useFinanceContext()` and pass `context` as the third argument to `clientFetchFromApi(endpoint, options, context)` (or to helpers that accept `context`).
4. **Backend**: `getOwnerContext(request)` reads `ownerType`/`ownerId` from the request URL and returns `ownerFilter` used in all Prisma queries. If params are missing, it falls back to the session user.

## Audit results

### Server-rendered pages (owner from `searchParams`)

| Page | Owner context | Notes |
|------|----------------|--------|
| **Dashboard** (`/dashboard`) | ✅ `getDashboardData(params)` builds `ownerContext` from `searchParams`, passes to `fetchFromApi('/api/dashboard?...', ownerContext)` | Dashboard API uses `getOwnerContext(request)` and filters all data by `ownerFilter`. |
| **Transactions** (`/transactions`) | ✅ `getTransactions(searchParams)` builds `ownerContext`, passes to `fetchFromApi(endpoint, ownerContext)` | Transactions API uses `getOwnerContext` and filters by `ownerFilter`. |
| **Monthly** (`/monthly/[year]/[month]`) | ✅ Resolves `ownerContext` from `searchParams`, passes to `getFortnightInfo`, `getTransactions`, `getSummary` | Fortnights, transactions, and reports APIs all use owner context. |
| **Fortnight** (`/fortnight/[year]/[month]/[period]`) | ✅ Same as monthly; `ownerContext` passed to all data fetches | Same APIs; owner-scoped. |

### Client-rendered pages (owner from `useFinanceContext()`)

| Page | Owner context | Notes |
|------|----------------|--------|
| **Categories** | ✅ `context` passed to GET and to create/update/delete helpers | Fixed earlier. |
| **Expenses** | ✅ `context` passed to expense-templates, categories, getPaymentMethodOptions; mutations use context | Fixed earlier. |
| **Expense templates** (list, new, edit) | ✅ `context` passed to list, categories, wallets, and all mutations | List and edit already had context; new/edit categories fixed earlier. |
| **Income templates** (list, new, edit) | ✅ `context` passed to list fetch and mutations | Already correct. |
| **Wallets** | ✅ `context` passed to list and create/update/delete | Already correct. |
| **Fortnights** | ✅ `context` passed to GET `/api/fortnights` | Fixed earlier. |

### Dashboard components (data from server + client actions)

| Component | Owner context | Notes |
|-----------|----------------|--------|
| **DashboardTabs** | ✅ Receives `data` from server; server already fetched with `ownerContext` | No extra fetch. |
| **CurrentPeriodSummaryCard** | ✅ Uses `data` from props | No fetch. |
| **AvailableVsCommittedCard** | ✅ Uses `data` from props | No fetch. |
| **UpcomingObligationsCard** | ✅ **Fixed**: `handleMarkPaid` now uses `updateExpensePaidStatus(id, true, context)` with `useFinanceContext()` | Previously PATCH was sent without owner params. |
| **RecentActivityCard** | ✅ Uses `data` from props | No fetch. |
| **IncomeBreakdownCard** | ✅ Uses `data` from props | No fetch. |
| **ExpenseHealthCheckCard** | ✅ Uses `data` from props | No fetch. |
| **FixedVsVariableCard** | ✅ Uses `data` from props | No fetch. |
| **PeriodComparisonCard** | ✅ Uses `data` from props | No fetch. |
| **AlertsWarningsCard** | ✅ Uses `data` from props | No fetch. |
| **QuickActionsCard** | ✅ Uses `data` from props; links use `queryString` | No fetch. |

### Shared / layout components

| Component | Owner context | Notes |
|-----------|----------------|--------|
| **App sidebar** | ✅ Fortnights fetch uses `context` from `useFinanceContext()` | Fixed earlier. |
| **CreateMonthForm** | ✅ `getCreatedMonths(context)`, `createMonthFortnights(y, m, context)`; `useEffect` deps include `context` | Refetches created months when owner changes. |
| **FortnightColumn** | ✅ Transactions/summary and fortnight fetch use `context`; `refreshData` deps include `context` | Already correct. |
| **AddExpenseDialog** | ✅ Categories and payment methods fetched with `context` | Fixed earlier. |
| **ExpenseTable** | ✅ `updateExpensePaidStatus(expenseId, newPaidStatus, context)` | Already correct. |

### Backend APIs (all use `getOwnerContext(request)`)

- `/api/dashboard` – ✅ ownerFilter on fortnights, expenses, income, recentActivity
- `/api/transactions` – ✅ ownerFilter on fortnights and expenses
- `/api/reports` – ✅ ownerFilter for summary and other report types
- `/api/categories` – ✅ ownerFilter for GET; in-scope checks for PUT/DELETE
- `/api/fortnights` (list + single) – ✅ ownerFilter
- `/api/fortnights/created-months` – ✅ ownerFilter
- `/api/fortnights/create-month` – ✅ ownerFilter + ownerType/ownerId for create
- `/api/fortnights/[id]/override-amount` – ✅ ownerFilter
- `/api/expense-templates` – ✅ ownerFilter
- `/api/income-templates` – ✅ ownerFilter
- `/api/wallets` – ✅ ownerFilter
- `/api/expenses/[id]/paid` – ✅ ownerFilter

## Changes made in this audit

1. **UpcomingObligationsCard**: Use `useFinanceContext()` and `updateExpensePaidStatus(id, true, context)` so “mark as paid” is sent with the current owner (user or house).
2. **CreateMonthForm**: Add `context` to the `useEffect` dependency array that fetches created months, so the list refetches when the selected owner changes.

## Summary

All dashboard tabs and related pages now:

- Pass owner context (from URL/searchParams or from `useFinanceContext()`) into every API call that returns owner-scoped data.
- Rely on backend routes that use `getOwnerContext(request)` and filter by `ownerFilter`.

Selecting a house in the team switcher keeps the URL in sync and ensures all fetches and mutations use that house’s data.
