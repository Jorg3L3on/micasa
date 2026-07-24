# Multi-Owner Finance System — Full Audit & Migration Plan

**Date:** 2026-03-08  
**Last status update:** 2026-07-24 (Phase 1.4 / #109)  
**Scope:** Originally analysis only. Implementation status below.

## Implementation status (2026-07-24)

| Item | Status |
|------|--------|
| Wallets API `getOwnerContext` + `listWalletsByOwner` / create-for-owner | ✅ Resolved |
| Reports API auth + `ownerFilter` | ✅ Resolved |
| Income / expense templates `getOwnerContext` | ✅ Resolved |
| Fortnights create-month / catalog / override-amount via request owner | ✅ Resolved |
| Transactions GET via `listPlanningTransactions(ownerFilter)` | ✅ Resolved |
| Expense paid toggle ownership check | ✅ Resolved |
| **Transfers** `getOwnerContext` + membership / caller checks | ✅ Resolved (#109) |
| `getOwnerContext` rejects `ownerType=user` when `ownerId` ≠ session user | ✅ Resolved (#109) |
| House-mode regression tests (wallets, expenses, fortnights) | ✅ Resolved (#109) |
| Manual QA script personal vs house | ✅ `docs/qa/house-owner-context-manual-qa.md` |
| Onboarding / account / houses (personal-only by design) | N/A — intentional |

Historical findings in §§1–8 below are kept for reference; treat the table above as source of truth for what’s left.

---

The system supports two contexts:
- **PERSONAL MODE:** `ownerType = "user"`, `ownerId = session.user.id`
- **HOUSE MODE:** `ownerType = "house"`, `ownerId = house.id`

Shared helper: `src/lib/server/get-owner-context.ts` returns `{ ownerType, ownerId, ownerFilter, role }` where `ownerFilter` is either `{ user_id: ownerId }` or `{ house_id: ownerId }`.

Many endpoints, server actions, and queries still scope only by `user_id = session.user.id`, causing incorrect behavior when a house is selected.

---

## 1. User-scoped queries found

Every file and location that uses `user_id` or `session.user.id` for data scoping (excluding auth/register and type definitions):

| File | Line(s) | Usage |
|------|---------|--------|
| **src/lib/house/house.service.ts** | 20, 31, 48 | `user_id: userId` in createHouse, listUserHouses (expected — houses are listed by user). |
| **src/lib/fortnights.ts** | 37–38, 68 | Owner-aware: `user_id`/`house_id` from `ownerType`/`ownerId`. |
| **src/app/api/account/route.ts** | 28 | `userId = session.user.id` — updates current user account (PERSONAL only; correct). |
| **src/app/api/fortnights/create-month/route.ts** | 80, 89 | `user_id: defaultUser.id` — creates fortnights for first active user only; **ignores request context**. |
| **src/app/api/reports/route.ts** | 117, 158, 163, 185 | Income grouped by `user_id`; **no owner/house filter** — returns all data. |
| **src/components/team-switcher.tsx** | 71 | `userId = session.user.id` for listing user’s houses (expected). |
| **src/app/api/income-templates/route.ts** | 35, 64, 87, 153, 179 | GET returns all templates; POST/PUT use `user_id`; **no house filter**. |
| **src/app/api/transfers/route.ts** | 9, 22, 34, 87, 111, 136, 141, 152, 158, 173, 175, 186, 188, 197, 211 | Transfer API uses `user_id`/`house_id` from body; GET filters by query params; **no getOwnerContext**. |
| **src/app/api/wallets/route.ts** | 23, 49 | GET/POST use `userId = session.user.id` only; **no house context** — lists/creates only personal wallets. |
| **src/lib/finance/expense.service.ts** | 68, 74, 79, 129, 134–135, 149, 157, 160–161, 190, 239, 265, 270–271, 288, 297–298, 306, 364 | `listExpenses(userId, …)` uses user + user’s house memberships (all houses); other logic uses fortnight/wallet ownership. |
| **src/lib/finance/transfer.service.ts** | 37, 49, 61 | Creates transfer/expense/income with fixed `user_id`/`house_id` from input (correct for USER_TO_HOUSE). |
| **src/app/api/transactions/route.ts** | 18, 36, 49–50 | **GET:** uses `session.user.id` and house memberships, then `listExpenses(userId, …)` — returns **all** user + all houses data; **not current-context-only**. POST/PUT/DELETE use getOwnerContext. |
| **src/app/onboarding/page.tsx** | 12, 15 | Server: `user_id: userId` — checks personal wallet only; **house mode not considered**. |
| **src/lib/finance/template.service.ts** | 22, 39, 58, 74, 87, 150, 199, 206, 209, 211, 236 | Templates filtered/created by `user_id`/fortnight; **house_id** used in template but expansion logic is user/defaultUser centric. |
| **src/app/api/onboarding/route.ts** | 12, 33 | Creates personal wallet only; **no house context**. |
| **src/app/(dashboard)/dashboard/page.tsx** | 51, 54 | Server: `user_id: userId`, `house_id: null` — **only personal wallet**; redirect to onboarding if no personal wallet; **ignores house context**. |
| **src/app/api/houses/route.ts** | 17, 40 | `userId = session.user.id` for listing/creating houses (expected). |
| **src/lib/finance/wallet.service.ts** | 10, 21, 52, 70 | `listWallets(userId)` returns user + user’s houses; `createWalletForUser`/`createWalletForDefaultUser` only set `user_id`; **no createWalletForHouse** usage from wallets API. |
| **src/app/api/fortnights/[id]/override-amount/route.ts** | 76 | `user_id: firstUser.id` — override income tied to first active user; **ignores fortnight owner (user vs house)**. |
| **src/context/finance-context.tsx** | 67 | Initializes context from `session.user.id` (expected). |
| **src/lib/server/get-owner-context.ts** | 5, 29, 57, 80 | Defines OwnerFilter and uses session for auth (expected). |
| **src/lib/auth.ts** | 75 | Session token (expected). |

---

## 2. API routes missing owner context

Routes that do **not** call `getOwnerContext(request)` and therefore are **NOT context-aware**:

| Route | Methods | Notes |
|-------|---------|--------|
| **src/app/api/account/route.ts** | PATCH | Account is user-only; context N/A. |
| **src/app/api/wallets/route.ts** | GET, POST, PUT, DELETE | Uses only `session.user.id`; no `ownerType`/`ownerId`; lists/creates personal wallets only. |
| **src/app/api/onboarding/route.ts** | POST | Personal wallet creation only. |
| **src/app/api/reports/route.ts** | GET | No auth/context; returns all expenses/income for given month/year/period (no user/house filter). |
| **src/app/api/income-templates/route.ts** | GET, POST, PUT, DELETE | No getOwnerContext; GET returns all templates; create/update use body `userId` only. |
| **src/app/api/transfers/route.ts** | GET, POST | No getOwnerContext; filters from query/body only; no verification that caller is allowed for that user/house. |
| **src/app/api/fortnights/route.ts** | GET | No owner filter; finds first fortnight by year/month/period (any owner). |
| **src/app/api/fortnights/create-month/route.ts** | POST | Uses `defaultUser`; creates fortnights for first active user only. |
| **src/app/api/fortnights/created-months/route.ts** | GET | Returns all created months (all owners mixed). |
| **src/app/api/fortnights/[id]/override-amount/route.ts** | PUT | No getOwnerContext; does not check fortnight ownership. |
| **src/app/api/expense-templates/route.ts** | GET, POST, PUT, DELETE | No getOwnerContext; returns/creates all templates (no user/house filter). |
| **src/app/api/expenses/[id]/paid/route.ts** | PATCH | No getOwnerContext; calls `toggleExpensePaid(id, paid)` with no ownership check. |
| **src/app/api/houses/route.ts** | GET, POST | User-scoped by design (list/create houses for session user); context N/A. |

**Routes that ARE context-aware (call getOwnerContext):**

- `src/app/api/categories/route.ts` — GET (auth only; categories are global).
- `src/app/api/dashboard/route.ts` — GET.
- `src/app/api/transactions/route.ts` — POST, PUT, DELETE (GET does **not** use getOwnerContext).

---

## 3. Server actions / services ignoring context

There are no `"use server"` server action files. The following **services** use `user_id` (or no owner) and are used by routes that don’t pass owner context:

| Service / function | File | Issue |
|--------------------|------|--------|
| **listWallets(userId)** | wallet.service.ts | Only accepts userId; used by GET /api/wallets with session user — no house support. |
| **createWalletForUser(userId, data)** | wallet.service.ts | Creates user wallet only; no house variant used by API. |
| **listExpenses(userId, options)** | expense.service.ts | Returns expenses for user + all user’s houses (by wallet); no “current owner only” mode. |
| **toggleExpensePaid({ id, paid })** | expense.service.ts | Finds expense by `id` only; **no ownerFilter** — security/consistency risk in multi-tenant. |
| **updateWalletMetadata(id, data)** / **deleteWalletIfUnused(id)** | wallet.service.ts | No ownership check; any authenticated user could target any wallet by id. |
| **listFortnightsForCatalog()** | fortnight.service.ts | Returns **all** fortnights (all users + all houses); no owner filter. |
| **expandExpenseTemplatesForFortnight** / **expandIncomeTemplatesForFortnight** | template.service.ts | Template selection uses user_id/house_id on templates but create-month calls with defaultUser only. |
| **createMonth (POST create-month)** | fortnights/create-month/route.ts | Uses `defaultUser`; does not accept ownerType/ownerId from request. |
| **override-amount** | fortnights/[id]/override-amount/route.ts | Uses `firstUser` for override income; does not use fortnight’s owner. |

---

## 4. Prisma model ownership table

| Model | user_id | house_id | Both | Neither | Notes |
|-------|---------|----------|------|---------|--------|
| **User** | — | — | — | ✓ | Identity. |
| **Fortnight** | ✓ optional | ✓ optional | ✓ | — | One of (user_id, house_id) set. |
| **Category** | — | — | — | ✓ | Global; no ownership. |
| **ExpenseTemplate** | ✓ optional | ✓ optional | ✓ | — | Can be user or house. |
| **Expense** | ✓ optional | ✓ optional | ✓ | — | Matches fortnight/wallet owner. |
| **Income** | ✓ optional | ✓ optional | ✓ | — | Same. |
| **IncomeTemplate** | ✓ optional | ✓ optional | ✓ | — | Same. |
| **House** | — | — | — | ✓ | Has owner_id (user). |
| **HouseMember** | ✓ | — | — | — | Links user to house. |
| **Wallet** | ✓ optional | ✓ optional | ✓ | — | User or house wallet. |
| **Transfer** | ✓ | ✓ | ✓ | — | USER_TO_HOUSE: both required. |

All finance entities that need scoping already have `user_id` and/or `house_id` where appropriate. **No new columns required** for ownership; gaps are in **query and API usage** of owner context.

---

## 5. Feature ownership matrix

Target behavior per domain:

| Domain | Should be | Current state |
|--------|-----------|----------------|
| **Transactions / expenses** | BOTH (user or house) | POST/PUT/DELETE context-aware; GET returns user + all houses; listExpenses(userId) is not “current context only”. |
| **Expense templates** | BOTH | API returns/creates all; no owner filter. |
| **Income templates** | BOTH | Same; GET all; POST/PUT use body userId. |
| **Wallets** | BOTH | Only user wallets in API; wallet.service has user+house in list but API doesn’t use context. |
| **Accounts (profile)** | PERSONAL ONLY | Correct. |
| **Categories** | GLOBAL | Correct; no ownership. |
| **Dashboard analytics** | BOTH | API uses getOwnerContext; server dashboard page and fetchFromApi do not pass ownerType/ownerId, so default to user. |
| **Fortnights** | BOTH | Model supports both; catalog returns all; create-month and override-amount ignore context. |
| **Transfers** | USER_TO_HOUSE | API uses body params; no getOwnerContext; no authz check that session user is allowed for that user/house. |
| **Reports** | BOTH | No owner filter; returns all data for filters. |
| **Onboarding** | PERSONAL ONLY (first wallet) | Currently personal only; house onboarding could be defined later. |
| **Houses** | User’s list / create | Correct. |

---

## 6. Required database changes

- **No schema changes required** for multi-owner support. All relevant models already have `user_id` and/or `house_id`.
- Optional future: if “Budget” or other domains are added, they should include ownership (user_id/house_id) as needed.

---

## 7. Step-by-step migration plan

### Phase 1 — Context propagation (frontend → API)

1. **Ensure all client and server calls that depend on scope include owner context when house is selected.**
   - Add a shared helper (e.g. in `lib/api.ts` or context) that builds query string or body from `useFinanceContext()`: `ownerType`, `ownerId`.
   - **Dashboard:** Either pass `ownerType`/`ownerId` in URL for server-rendered dashboard (e.g. searchParams or cookie) or make dashboard data client-fetched with context in URL so GET /api/dashboard receives context.
   - **Monthly page:** Server component cannot read client finance context; either pass context via URL (e.g. `?ownerType=house&ownerId=2`) or refactor to client fetch with context for transactions/reports.
   - **FortnightColumn / client fetches:** Append `ownerType` and `ownerId` to all calls to `/api/transactions`, `/api/reports`, `/api/fortnights`, `/api/wallets`, etc., when context is house.

### Phase 2 — API routes

2. **Wallets**
   - **GET /api/wallets:** Call `getOwnerContext(request)`; if user, use `ownerFilter` with `listWallets(ownerId)` scoped to owner (today listWallets already returns user + houses — change to accept ownerType + ownerId and filter to that owner only).
   - **POST /api/wallets:** Use context; create house wallet when `ownerType === 'house'` (add `createWalletForHouse(houseId, data)` in wallet.service and use it here).
   - **PUT/DELETE:** Resolve wallet by id and enforce `ownerFilter` (wallet must belong to current context).

3. **Transactions**
   - **GET /api/transactions:** Call `getOwnerContext(request)`. Replace current logic with: resolve fortnights for **that** owner only (using ownerFilter on Fortnight), then list expenses for those fortnights (or use ownerFilter on Expense). Prefer a `listExpensesByOwner(ownerFilter, options)` (or pass ownerFilter into existing service) so only current context’s data is returned.

4. **Reports**
   - **GET /api/reports:** Add auth and `getOwnerContext`. Apply ownerFilter to Expense and Income (and Fortnight) so summary, by-category, and by-payment-method are scoped to one owner.

5. **Fortnights**
   - **GET /api/fortnights:** Use getOwnerContext; filter fortnights by ownerFilter (user or house). For catalog list, return only current owner’s fortnights.
   - **GET /api/fortnights?year=&month=&period=:** Return fortnight for current owner only.
   - **POST /api/fortnights/create-month:** Read ownerType/ownerId from request (query or body); create fortnights for that owner (user or house); remove defaultUser for creation.
   - **GET /api/fortnights/created-months:** Filter by ownerFilter so only current owner’s months are returned.
   - **PUT /api/fortnights/[id]/override-amount:** Use getOwnerContext; verify fortnight belongs to owner (where: { id, ...ownerFilter }); create override income with correct user_id/house_id for that fortnight’s owner.

6. **Expense templates**
   - **GET/POST/PUT/DELETE /api/expense-templates:** Use getOwnerContext; filter list and create/update/delete by ownerFilter (ExpenseTemplate has user_id and house_id).

7. **Income templates**
   - **GET/POST/PUT/DELETE /api/income-templates:** Same; scope by ownerFilter.

8. **Expenses [id]/paid**
   - **PATCH /api/expenses/[id]/paid:** Call getOwnerContext; pass ownerFilter into expense.service (e.g. `toggleExpensePaid(id, paid, ownerFilter)`) and ensure expense is found with `where: { id, ...ownerFilter }` before toggling.

9. **Transfers**
   - **GET /api/transfers:** Add auth; optionally use getOwnerContext to restrict to transfers where user is the user_id or member of house_id.
   - **POST /api/transfers:** Verify session user is the same as body user_id and is member of body house_id (or has permission).

### Phase 3 — Services

10. **wallet.service**
    - Add `listWalletsByOwner(ownerFilter)` or `listWallets(ownerType, ownerId)` that returns only that owner’s wallets.
    - Add `createWalletForHouse(houseId, data)` and use from POST /api/wallets when context is house.
    - In updateWalletMetadata and deleteWalletIfUnused, require ownerFilter and check wallet ownership before update/delete.

11. **expense.service**
    - Add overload or option to `listExpenses` that accepts `ownerFilter` (or ownerType + ownerId) and returns only that owner’s expenses (via Expense.user_id / Expense.house_id and/or via fortnight ownership).
    - `toggleExpensePaid`: add optional ownerFilter; when provided, find expense with `where: { id, ...ownerFilter }` and then toggle.

12. **fortnight.service**
    - Add `listFortnightsForCatalog(ownerFilter)` or (ownerType, ownerId) and use from GET /api/fortnights so sidebar and catalog are scoped.

13. **template.service**
    - Ensure expandExpenseTemplatesForFortnight and expandIncomeTemplatesForFortnight are called with the owner of the fortnight being created (from create-month with context), not defaultUser.

### Phase 4 — Pages and data loading

14. **Dashboard page (server)**
    - Pass owner context to GET /api/dashboard: e.g. read from searchParams (ownerType, ownerId) or cookie set by client, and append to fetchFromApi URL so dashboard API returns data for selected context.
    - Adjust onboarding redirect: if context is house, consider whether to require a house wallet or keep onboarding as “first personal wallet” only (product decision).

15. **Onboarding**
    - Keep as personal-only unless product specifies house onboarding; then add house path and use context.

16. **Monthly page**
    - Either make it context-aware via URL (ownerType, ownerId in searchParams) and pass to fetchFromApi for transactions, reports, fortnights, or move those fetches to client with useFinanceContext and append context to all API URLs.

17. **FortnightColumn and all client callers**
    - Use useFinanceContext(); when calling APIs, append `ownerType` and `ownerId` to every request that should be scoped (transactions, reports, fortnights, wallets, expense/income templates, etc.).

### Phase 5 — Consistency and security

18. **Authorization**
    - Every route that mutates or returns scoped data must use getOwnerContext (or equivalent) and enforce ownerFilter so users cannot access or modify another user’s or another house’s data (except where explicitly allowed, e.g. house members).

19. **Double-check**
    - No Prisma query should use only `session.user.id` for finance data without considering house context where the feature is “BOTH”.
    - Ensure expense paid, wallet delete, and transfer creation all validate ownership or membership.

---

## 8. Risk analysis

| Risk | Description | Mitigation |
|------|-------------|------------|
| **Mixed scopes in one response** | GET transactions/reports/fortnights return both personal and house data in one list when context is not applied. | Use getOwnerContext and filter all reads by ownerFilter; single-owner responses only. |
| **Missing house_id in flows** | Create wallet, create month, override amount, onboarding assume user only. | Add house paths and pass ownerType/ownerId from context; create-month and override-amount must set fortnight’s owner. |
| **Data duplication** | Same logical “month” could exist per user and per house. | By design; no duplication risk if UI always passes context and APIs filter by one owner. |
| **Security: cross-tenant access** | toggleExpensePaid(id), updateWalletMetadata(id), deleteWalletIfUnused(id), and similar accept only id; no owner check. | Add ownerFilter (or ownership check) to all such operations; verify resource belongs to current context. |
| **Reports expose all data** | GET /api/reports has no auth and no owner filter. | Add auth and getOwnerContext; apply ownerFilter to expenses and income. |
| **Fortnight catalog shows all** | listFortnightsForCatalog returns every user’s and house’s fortnights. | Filter by ownerFilter so each context sees only its own fortnights. |
| **Server components lack context** | Dashboard and monthly page use fetchFromApi without ownerType/ownerId; server has no access to client’s finance context. | Pass context via URL (searchParams) or cookie, or move data loading to client with context in query string. |
| **Default user / first user** | create-month and override-amount use “first active user”. | Remove; use request context (ownerType/ownerId) for creation and override. |
| **Income template expansion** | expandIncomeTemplatesForFortnight uses defaultUser when template has no user_id. | When creating months for a house, use house context and house’s templates only; avoid defaultUser for ownership. |

---

## Summary

- **User-scoped queries:** Listed in §1; main gaps are transactions GET, reports, wallets, fortnights, expense/income templates, and expense paid.
- **API routes missing context:** §2 lists 14 route files that do not use getOwnerContext where they should.
- **Services ignoring context:** §3 lists wallet, expense, fortnight, and template services that need ownerFilter or owner-aware signatures.
- **Database:** No model changes needed (§4).
- **Target behavior:** §5 defines BOTH vs PERSONAL vs GLOBAL per domain.
- **Migration:** §7 gives a phased plan (context propagation → APIs → services → pages → security).
- **Risks:** §8 calls out mixed scopes, missing house_id, and missing ownership checks as the main issues to address.

No code was modified in this audit; the next step is to implement the migration plan in the order above.
