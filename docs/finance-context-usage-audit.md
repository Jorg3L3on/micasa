# Finance Context Usage — Full Audit

**Date:** 2026-03-08  
**Scope:** Identify every place where the selected finance context (`ownerType`, `ownerId`) should be used but is not. No implementation.

The app has `FinanceContext` (user vs house) in React state and localStorage. The backend supports scoping via `getOwnerContext(request)` reading `ownerType` and `ownerId` from request searchParams. Most API calls and server-rendered pages do not pass this context, so selecting a house does not change the data shown.

---

## Summary

| Category | Count |
|----------|--------|
| Client API helpers (lib/api.ts) | 1 file, many functions |
| Server-side fetch (api-server) | 1 file |
| Server components / pages | 6 pages |
| Client components / pages | 14 components/pages |
| Excluded (no context needed) | account, auth/register, houses, onboarding (optional) |

---

## 1. Client API layer — `src/lib/api.ts`

All helpers use `clientFetchFromApi` with fixed URLs and never append `ownerType` or `ownerId`. Callers cannot pass context because the helpers do not accept it.

| Function or export | Current behavior | What is missing | What should be added |
|--------------------|------------------|-----------------|----------------------|
| **clientFetchFromApi** | Generic fetch; no query params added. | No awareness of finance context. | Either: (a) Accept optional `context?: FinanceContextType` and append `ownerType`/`ownerId` to URLs when present, or (b) Leave as-is and have every caller build URLs with context (duplicated logic). Prefer (a) or a small wrapper that appends context params. |
| **createCategory** | POST `/api/categories` with no query params. | ownerType, ownerId. | Append `?ownerType=&ownerId=` (or in body if API supports). Categories are global; passing context is for consistency and auth. |
| **updateCategory** | PUT `/api/categories?id=${id}` only. | ownerType, ownerId. | Append owner params. |
| **deleteCategory** | DELETE `/api/categories?id=${id}` only. | ownerType, ownerId. | Append owner params. |
| **getPaymentMethodOptions** | GET `/api/wallets` with no params. | ownerType, ownerId. | Append owner params so wallets list is scoped to current context (user or house). |
| **createExpenseTemplate** | POST `/api/expense-templates` with body only. | ownerType, ownerId. | Append as query params (or body if API accepts). |
| **updateExpenseTemplate** | PUT `/api/expense-templates?id=${id}` only. | ownerType, ownerId. | Append owner params. |
| **deleteExpenseTemplate** | DELETE `/api/expense-templates?id=${id}` only. | ownerType, ownerId. | Append owner params. |
| **createIncomeTemplate** | POST `/api/income-templates` with body only. | ownerType, ownerId. | Append owner params. |
| **updateIncomeTemplate** | PUT `/api/income-templates?id=${id}` only. | ownerType, ownerId. | Append owner params. |
| **deleteIncomeTemplate** | DELETE `/api/income-templates?id=${id}` only. | ownerType, ownerId. | Append owner params. |
| **getCreatedMonths** | GET `/api/fortnights/created-months` with no params. | ownerType, ownerId. | Append owner params so list is scoped to current owner (user or house). |
| **createMonthFortnights** | POST `/api/fortnights/create-month` with body `{ year, month }` only. | ownerType, ownerId. | Send context (query or body) so the created fortnights belong to the selected entity. |
| **createWallet** | POST `/api/wallets` with body only. | ownerType, ownerId. | Append owner params so wallet is created for current context (user or house). |
| **updateWallet** | PUT `/api/wallets?id=${id}` only. | ownerType, ownerId. | Append owner params and enforce ownership on server. |
| **deleteWallet** | DELETE `/api/wallets?id=${id}` only. | ownerType, ownerId. | Append owner params. |
| **updateExpensePaidStatus** | PATCH `/api/expenses/${id}/paid` with body only. | ownerType, ownerId. | Append owner params so the expense paid toggle is scoped. |
| **updateFortnightOverrideAmount** | PUT `/api/fortnights/${id}/override-amount` with body only. | ownerType, ownerId. | Append owner params so override is for the correct fortnight owner. |
| **updateExpenseAmount** | PUT `/api/transactions?id=${id}` with body only. | ownerType, ownerId. | Append owner params. |
| **deleteTransaction** | DELETE `/api/transactions?id=${id}` only. | ownerType, ownerId. | Append owner params. |
| **createExpenseTransaction** | POST `/api/transactions` with body only. | ownerType, ownerId. | Append owner params (or ensure API reads from body); backend already uses getOwnerContext for POST. |

**Implementation approach:** Either add an optional `context?: FinanceContextType` (or `ownerType`/`ownerId`) to every function and append to URL/body, or introduce a single helper that builds the query string from context and use it in all helpers. Callers that use these functions would then need to pass context from `useFinanceContext()` unless the helpers read context from a shared source (e.g. a wrapper that injects context from a React context consumer).

---

## 2. Server-side API fetcher — `src/lib/api-server.ts`

| Function | Current behavior | What is missing | What should be added |
|----------|------------------|-----------------|----------------------|
| **fetchFromApi** | Accepts only `endpoint: string`; no way to add owner params. | No way for server code to pass ownerType/ownerId. | Either: (a) Add optional second parameter or options object with `ownerType` and `ownerId` and append to `endpoint`, or (b) Require callers to pass the full URL including owner params (callers must receive context from somewhere, e.g. page searchParams). |

Server components cannot use `useFinanceContext()`. So the server must get the selection from URL searchParams (or a cookie). The dashboard and other server pages should read `ownerType` and `ownerId` from searchParams and pass them into `fetchFromApi` (or build the URL with them).

---

## 3. Server components and pages

### 3.1 Dashboard page

| File | Function or component | Current behavior | What is missing | What should be added |
|------|------------------------|------------------|-----------------|----------------------|
| **src/app/(dashboard)/dashboard/page.tsx** | **getDashboardData** | Calls `fetchFromApi(\`/api/dashboard?${query}\`)` with only view/month/year/period. | ownerType, ownerId. | Page must receive owner context (e.g. from searchParams: `ownerType`, `ownerId`). Append them to the dashboard URL so GET /api/dashboard returns data for the selected entity. |
| **src/app/(dashboard)/dashboard/page.tsx** | **DashboardPage** (default export) | Uses `session.user.id` and checks for a **personal** wallet only (`user_id: userId`, `house_id: null`); redirects to onboarding if none. | Consideration of house context. | When owner context is house, either: (a) require a house wallet for that house and redirect if missing, or (b) allow dashboard without a wallet in house mode (product decision). Ensure redirect/onboarding logic is consistent with selected entity. |

### 3.2 Monthly plan page

| File | Function or component | Current behavior | What is missing | What should be added |
|------|------------------------|------------------|-----------------|----------------------|
| **src/app/(dashboard)/monthly/[year]/[month]/page.tsx** | **getFortnightInfo** | Calls `fetchFromApi(\`/api/fortnights?year=...&month=...&period=...\`)` with no owner params. | ownerType, ownerId. | Page must receive owner context (e.g. searchParams). Append to fortnight URL so the returned fortnight is for the selected entity. |
| **src/app/(dashboard)/monthly/[year]/[month]/page.tsx** | **getTransactions** | Calls `fetchFromApi(\`/api/transactions?year=...&month=...&period=...\`)` with no owner params. | ownerType, ownerId. | Append owner params so transactions are for current context. |
| **src/app/(dashboard)/monthly/[year]/[month]/page.tsx** | **getSummary** | Calls `fetchFromApi(\`/api/reports?type=summary&year=...&month=...&period=...\`)` with no owner params. | ownerType, ownerId. | Append owner params so report is for current context. |

The monthly page is a server component; it has no access to React context. So the app must pass owner context from client to server (e.g. URL searchParams on the monthly route, or a cookie). Then this page should read those params and pass them into every `fetchFromApi` call.

### 3.3 Transactions page

| File | Function or component | Current behavior | What is missing | What should be added |
|------|------------------------|------------------|-----------------|----------------------|
| **src/app/(dashboard)/transactions/page.tsx** | **getTransactions** | Builds endpoint from month/year/type/is_paid only; calls `fetchFromApi(endpoint)`. | ownerType, ownerId. | Page must receive owner context (searchParams). Append to endpoint so transactions list is scoped. |

### 3.4 Fortnight detail page (by period)

| File | Function or component | Current behavior | What is missing | What should be added |
|------|------------------------|------------------|-----------------|----------------------|
| **src/app/(dashboard)/fortnight/[year]/[month]/[period]/page.tsx** | **getFortnightLabel** | Fetches `/api/fortnights?year=&month=&period=` with no owner params. | ownerType, ownerId. | Receive owner context (searchParams); append to URL. |
| **src/app/(dashboard)/fortnight/[year]/[month]/[period]/page.tsx** | **getTransactions** | Fetches `/api/transactions?year=&month=&period=` with no owner params. | ownerType, ownerId. | Append owner params. |
| **src/app/(dashboard)/fortnight/[year]/[month]/[period]/page.tsx** | **getSummary** | Fetches `/api/reports?type=summary&...` with no owner params. | ownerType, ownerId. | Append owner params. |

---

## 4. Client components and pages

### 4.1 FortnightColumn

| File | Function or component | Current behavior | What is missing | What should be added |
|------|------------------------|------------------|-----------------|----------------------|
| **src/components/FortnightColumn.tsx** | **refreshData** (useCallback) | Calls `clientFetchFromApi(\`/api/transactions?year=...&month=...&period=...\`)` and `clientFetchFromApi(\`/api/reports?type=summary&...\`)` with no owner params. | useFinanceContext(); ownerType, ownerId on both URLs. | Use `useFinanceContext()`; append `ownerType` and `ownerId` to the transactions and reports URLs in refreshData. |
| **src/components/FortnightColumn.tsx** | **getOtherFortnightId** (inner helper) | Calls `clientFetchFromApi(\`/api/fortnights?year=...&month=...&period=...\`)` with no owner params. | ownerType, ownerId. | Append owner params so the "other" fortnight is for the same entity. |
| **src/components/FortnightColumn.tsx** | **handleOverrideAmount** | Calls `updateFortnightOverrideAmount(fortnightId, { amount, year, month })` from lib/api; that helper does not send context. | useFinanceContext(); context passed to API. | Either use context in FortnightColumn and pass it to a context-aware helper, or fix lib/api.ts so the helper accepts/appends context (and call it from here; context can be read inside a wrapper that uses useFinanceContext). |
| **src/components/FortnightColumn.tsx** | **handleAddExpense** | Calls `createExpenseTransaction`, `createExpenseTemplate` from lib/api; neither sends owner context. | useFinanceContext(); context sent with create calls. | Ensure createExpenseTransaction and createExpenseTemplate receive or use current context (via lib/api accepting context and component calling useFinanceContext). |

### 4.2 App sidebar

| File | Function or component | Current behavior | What is missing | What should be added |
|------|------------------------|------------------|-----------------|----------------------|
| **src/components/app-sidebar.tsx** | **fetchFortnights** (inside useEffect) | Calls `clientFetchFromApi<Fortnight[]>('/api/fortnights')` with no params. | useFinanceContext(); ownerType, ownerId. | Use `useFinanceContext()`; append owner params to `/api/fortnights` so the sidebar shows only the current entity’s fortnights. |

### 4.3 Wallets page

| File | Function or component | Current behavior | What is missing | What should be added |
|------|------------------------|------------------|-----------------|----------------------|
| **src/app/(dashboard)/wallets/page.tsx** | **fetchWallets** | Calls `clientFetchFromApi<WalletListItem[]>('/api/wallets')` with no params. | useFinanceContext(); ownerType, ownerId. | Use `useFinanceContext()`; append owner params to the wallets URL (or use a helper that does). |
| **src/app/(dashboard)/wallets/page.tsx** | **createWallet** / **updateWallet** / **deleteWallet** (handlers) | Call lib/api createWallet, updateWallet, deleteWallet; those do not send context. | Context passed to API. | Ensure wallet mutations include context (via context-aware lib/api helpers and useFinanceContext here). |

### 4.4 Categories page

| File | Function or component | Current behavior | What is missing | What should be added |
|------|------------------------|------------------|-----------------|----------------------|
| **src/app/(dashboard)/categories/page.tsx** | Data fetch (useEffect) | Calls `clientFetchFromApi<CategoryOption[]>('/api/categories')` with no params. | ownerType, ownerId (optional; categories are global). | For consistency and so backend auth uses the same context, append owner params when calling the API (or use a helper that adds context). |

### 4.5 Expense templates pages

| File | Function or component | Current behavior | What is missing | What should be added |
|------|------------------------|------------------|-----------------|----------------------|
| **src/app/(dashboard)/expense-templates/page.tsx** | Data fetch | Calls `clientFetchFromApi<ExpenseTemplateListItem[]>('/api/expense-templates')` with no params. | useFinanceContext(); ownerType, ownerId. | Use `useFinanceContext()`; append owner params so templates list is scoped. |
| **src/app/(dashboard)/expense-templates/page.tsx** | **deleteExpenseTemplate** (handler) | Calls lib/api deleteExpenseTemplate(id); no context. | Context passed to API. | Use context and ensure deleteExpenseTemplate sends it (via updated lib/api). |
| **src/app/(dashboard)/expense-templates/new/page.tsx** | **createExpenseTemplate** (submit) | Calls lib/api createExpenseTemplate(data); no context. | useFinanceContext(); context in request. | Use `useFinanceContext()`; pass context to createExpenseTemplate or ensure the helper adds it. |
| **src/app/(dashboard)/expense-templates/new/page.tsx** | Categories fetch | Calls `clientFetchFromApi<CategoryOption[]>('/api/categories')` with no params. | ownerType, ownerId (optional). | Append for consistency. |
| **src/app/(dashboard)/expense-templates/[id]/edit/page.tsx** | Data fetch | Fetches expense-templates and categories with no owner params. | useFinanceContext(); ownerType, ownerId on both. | Use context; append to template and category requests. |
| **src/app/(dashboard)/expense-templates/[id]/edit/page.tsx** | **updateExpenseTemplate** (handler) | Calls lib/api updateExpenseTemplate(id, data); no context. | Context passed to API. | Ensure update sends context. |

### 4.6 Income templates pages

| File | Function or component | Current behavior | What is missing | What should be added |
|------|------------------------|------------------|-----------------|----------------------|
| **src/app/(dashboard)/income-templates/page.tsx** | Data fetch | Calls `clientFetchFromApi<IncomeTemplateListItem[]>('/api/income-templates')` with no params. | useFinanceContext(); ownerType, ownerId. | Use `useFinanceContext()`; append owner params. |
| **src/app/(dashboard)/income-templates/page.tsx** | **deleteIncomeTemplate** (handler) | Calls lib/api deleteIncomeTemplate(id); no context. | Context passed to API. | Ensure delete sends context. |
| **src/app/(dashboard)/income-templates/[id]/edit/page.tsx** | Data fetch | Fetches `/api/income-templates` with no owner params. | useFinanceContext(); ownerType, ownerId. | Use context; append to request. |
| **src/app/(dashboard)/income-templates/[id]/edit/page.tsx** | **updateIncomeTemplate** (handler) | Calls lib/api updateIncomeTemplate(id, data); no context. | Context passed to API. | Ensure update sends context. |
| **src/app/(dashboard)/income-templates/new/page.tsx** | **createIncomeTemplate** (handler) | Calls lib/api createIncomeTemplate(...); no context. | useFinanceContext(); context in request. | Use context; ensure create sends it. |

### 4.7 Expenses page

| File | Function or component | Current behavior | What is missing | What should be added |
|------|------------------------|------------------|-----------------|----------------------|
| **src/app/(dashboard)/expenses/page.tsx** | Data fetch | Fetches `/api/expense-templates` and `/api/categories` with no owner params. | useFinanceContext(); ownerType, ownerId. | Use `useFinanceContext()`; append owner params to both requests. |
| **src/app/(dashboard)/expenses/page.tsx** | **createExpenseTemplate** / **updateExpenseTemplate** / **deleteExpenseTemplate** (handlers) | Call lib/api; no context. | Context passed to API. | Ensure template mutations include context. |

### 4.8 Fortnights page

| File | Function or component | Current behavior | What is missing | What should be added |
|------|------------------------|------------------|-----------------|----------------------|
| **src/app/(dashboard)/fortnights/page.tsx** | Data fetch | Calls `clientFetchFromApi<FortnightListItem[]>('/api/fortnights')` with no params. | useFinanceContext(); ownerType, ownerId. | Use `useFinanceContext()`; append owner params so list is scoped. |

### 4.9 Create month form and button

| File | Function or component | Current behavior | What is missing | What should be added |
|------|------------------------|------------------|-----------------|----------------------|
| **src/components/CreateMonthForm.tsx** | **fetchCreated** (useEffect) | Calls `getCreatedMonths()` from lib/api; no context. | useFinanceContext(); context passed to getCreatedMonths. | Use `useFinanceContext()`; ensure getCreatedMonths receives and sends context (via lib/api). |
| **src/components/CreateMonthForm.tsx** | **handleSubmit** | Calls `createMonthFortnights(y, m)`; no context. | useFinanceContext(); context sent to create-month API. | Use context; ensure createMonthFortnights sends it. |
| **src/components/CreateNextMonthButton.tsx** | Create month handler | Calls `createMonthFortnights(nextYear, nextMonth)`; no context. | useFinanceContext(); context sent to API. | Use `useFinanceContext()`; ensure createMonthFortnights sends context. |

### 4.10 Expense table

| File | Function or component | Current behavior | What is missing | What should be added |
|------|------------------------|------------------|-----------------|----------------------|
| **src/components/ExpenseTable.tsx** | **updateExpensePaidStatus** (handler) | Calls lib/api updateExpensePaidStatus(id, paid); no context. | Context passed to API. | Ensure the API helper sends owner context (component or lib/api must use context). |
| **src/components/ExpenseTable.tsx** | **updateExpenseAmount** (handler) | Calls lib/api updateExpenseAmount(id, amount); no context. | Context passed to API. | Same as above. |
| **src/components/ExpenseTable.tsx** | **deleteTransaction** (handler) | Calls lib/api deleteTransaction(id); no context. | Context passed to API. | Same as above. |

### 4.11 Add expense dialog

| File | Function or component | Current behavior | What is missing | What should be added |
|------|------------------------|------------------|-----------------|----------------------|
| **src/components/AddExpenseDialog.tsx** | Categories fetch | Calls `clientFetchFromApi<CategoryOption[]>('/api/categories')` with no params. | ownerType, ownerId (optional). | Append for consistency. |
| **src/components/AddExpenseDialog.tsx** | **getPaymentMethodOptions** | Uses lib/api getPaymentMethodOptions() which GETs `/api/wallets` with no params. | Context so wallet list is scoped. | Ensure getPaymentMethodOptions receives/uses context (via lib/api or caller passing context). |

### 4.12 Upcoming obligations card

| File | Function or component | Current behavior | What is missing | What should be added |
|------|------------------------|------------------|-----------------|----------------------|
| **src/components/dashboard/UpcomingObligationsCard.tsx** | Expense paid update | Calls `clientFetchFromApi(\`/api/expenses/${id}/paid\`, { method: 'PATCH', ... })` with no owner params. | ownerType, ownerId. | Append owner params (or use updateExpensePaidStatus from lib/api once it supports context). |

---

## 5. Endpoints that do not require finance context (excluded)

| File / endpoint | Reason |
|-----------------|--------|
| **src/components/EditAccountDialog.tsx** — `/api/account` | Account is always the current user; no user/house selection. |
| **src/components/register-form.tsx** — `/api/auth/register` | Auth; no finance scope. |
| **src/components/create-house-dialog.tsx** — `/api/houses` | Lists and creates the current user’s houses; not scoped by “selected entity.” |
| **src/components/onboarding/CreateWallet.tsx** — `fetch('/api/onboarding')` | Onboarding creates a **personal** wallet only. If product later adds “house onboarding,” then this would need context. |

---

## 6. Passing context from client to server

Server components (dashboard, monthly, transactions, fortnight page) cannot call `useFinanceContext()`. To scope their data by the selected entity:

1. **URL searchParams:** Add `ownerType` and `ownerId` to the URLs of dashboard, monthly, transactions, and fortnight pages (e.g. `/dashboard?ownerType=house&ownerId=2`). The client (e.g. layout or links) must set these from `useFinanceContext()` when navigating or when the selection changes. Server components read searchParams and pass them into `fetchFromApi`.
2. **Cookie:** Alternatively, persist the selection in a cookie so every server request carries it; then `fetchFromApi` or a middleware can append it to API URLs. This requires syncing FinanceContext with a cookie when it changes.
3. **Client-side data for some routes:** Alternatively, move data loading for those pages to client components that use `useFinanceContext()` and call the API with context in the URL. Then server components would not need to receive context.

---

## 7. Checklist of required changes

- [ ] **lib/api.ts:** Add support for owner context (optional param or shared builder) and use it in every helper that hits scopeable endpoints (categories, wallets, expense-templates, income-templates, fortnights, transactions, expenses/paid, override-amount).
- [ ] **lib/api-server.ts:** Support appending ownerType/ownerId to the endpoint (or accept full URL built by caller that includes them).
- [ ] **Dashboard page:** Receive owner context (searchParams); pass to getDashboardData; adjust onboarding redirect logic for house mode if needed.
- [ ] **Monthly page:** Receive owner context; pass to getFortnightInfo, getTransactions, getSummary.
- [ ] **Transactions page:** Receive owner context; pass to getTransactions.
- [ ] **Fortnight [year]/[month]/[period] page:** Receive owner context; pass to getFortnightLabel, getTransactions, getSummary.
- [ ] **FortnightColumn:** useFinanceContext(); append context to refreshData, getOtherFortnightId, and to all mutation calls (override, create expense, create template).
- [ ] **app-sidebar:** useFinanceContext(); append context to /api/fortnights.
- [ ] **wallets page:** useFinanceContext(); append context to fetch and to create/update/delete.
- [ ] **categories page:** Append context for consistency (data is global).
- [ ] **expense-templates (list, new, edit):** useFinanceContext(); append context to all fetches and mutations.
- [ ] **income-templates (list, new, edit):** useFinanceContext(); append context to all fetches and mutations.
- [ ] **expenses page:** useFinanceContext(); append context to fetches and template mutations.
- [ ] **fortnights page:** useFinanceContext(); append context to /api/fortnights.
- [ ] **CreateMonthForm:** useFinanceContext(); pass context to getCreatedMonths and createMonthFortnights.
- [ ] **CreateNextMonthButton:** useFinanceContext(); pass context to createMonthFortnights.
- [ ] **ExpenseTable:** Ensure updateExpensePaidStatus, updateExpenseAmount, deleteTransaction receive or use context (via lib/api or context in component).
- [ ] **AddExpenseDialog:** Categories and getPaymentMethodOptions: ensure context is used (lib/api or caller).
- [ ] **UpcomingObligationsCard:** Append owner params to PATCH /api/expenses/:id/paid.
- [ ] **Client → server context:** Implement one of: URL searchParams for dashboard/monthly/transactions/fortnight, or cookie, or move those data loads to client with context.

This list is the complete set of places that must be updated so the selected finance context consistently scopes all financial data across the application.
