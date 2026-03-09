# Global Selected Entity Context Pattern — Compatibility Analysis

**Date:** 2026-03-08  
**Scope:** Architectural analysis only. No implementation.

This document evaluates whether a **global selection context pattern** (e.g. a “CompanyProvider” that stores the currently selected entity, persists it to localStorage, and exposes a hook) is compatible with this project. Here the selectable entities are **user (personal)** and **house**.

---

## 1. Current Architecture

### 1.1 Concept of a “current selected entity”

This project **already has** a clear concept of a current selected entity:

- **Entity types:** `user` (personal finances) or `house` (a specific house).
- **Representation:** `FinanceContextType` in `src/types/finance-context.ts` is `{ type: 'user'; id: number } | { type: 'house'; id: number }`. The `id` is either the authenticated user’s id or a house id.

So the “current selected entity” is exactly the **current finance scope**: personal or a specific house.

### 1.2 How that selection is managed today

| Mechanism | Role |
|-----------|------|
| **React Context** | `FinanceProvider` in `src/context/finance-context.tsx` holds the selected entity in React state (`context`). It exposes `useFinanceContext()` which returns `{ context, setUserContext, setHouseContext }`. |
| **Persistence** | The selection is persisted to **localStorage** under the key `finance_context`. On load, the provider reads from localStorage; if missing, it initializes from the session user (personal). |
| **Root layout** | The provider wraps the app in `src/app/layout.tsx`: `SessionProvider` → `FinanceProvider` → `ThemeProvider` → children. So the selected entity is available to all client components. |
| **Session** | `SessionProvider` (NextAuth) provides the authenticated user. The dashboard and onboarding pages use **session only** for server-side checks (e.g. “does this user have a personal wallet?”). They do **not** read the client’s selected entity (user vs house). |
| **URL parameters** | Used for **view options** (e.g. `view`, `month`, `year`, `period`) on dashboard, transactions, and reports. The selected entity (**ownerType**, **ownerId**) is **not** in the URL. Server-side `getOwnerContext(request)` in `src/lib/server/get-owner-context.ts` does read `ownerType` and `ownerId` from the request’s **searchParams**; when those are absent, it defaults to `user` and `session.user.id`. So the backend is prepared to receive the selection via URL, but no client or server code currently passes it. |
| **Global state libraries** | None (no Zustand, Redux, etc.) for this concern. |
| **Props drilling** | No widespread passing of `house_id` or `user_id` as props for “current scope.” The only place that reads the selected entity is the **TeamSwitcher**, which uses `useFinanceContext()` to display and change the selection. |

### 1.3 Where the selection is used (and not used)

- **Used:**  
  - **TeamSwitcher** reads `context` and calls `setUserContext` / `setHouseContext` when the user picks “Personal” or a house. So the UI for choosing the entity and persisting it is in place.

- **Not used for scoping:**  
  - **API calls:** Client helpers in `src/lib/api.ts` (e.g. `clientFetchFromApi`, `createExpenseTransaction`, `getPaymentMethodOptions`, wallet/template/transaction APIs) do **not** append `ownerType` or `ownerId` to requests.  
  - **FortnightColumn** and other client components that call `/api/transactions`, `/api/reports`, `/api/fortnights`, etc. do **not** use `useFinanceContext()` to add query params.  
  - **Server components:** The dashboard page and monthly page use `fetchFromApi` (server-side) and never have access to the client’s React context. They do not pass owner context in the URL, so the dashboard and related APIs always receive the default (user + session user id).  
  - **Onboarding / dashboard redirect:** The dashboard checks for a **personal** wallet only (`user_id: userId`, `house_id: null`) and redirects to onboarding if missing. The selected entity (e.g. “house”) is not considered.

So: the **pattern** (global selected entity in context + localStorage + hook) is already implemented; the **usage** of that selection for scoping API requests and server-rendered data is largely missing.

---

## 2. Compatibility

A **global selection context pattern** (like the CompanyProvider example) is **fully compatible** with this project because:

1. **It is already present.** The project uses a single global “current entity” (user or house), stored in React state, persisted in localStorage, and exposed via a hook (`useFinanceContext`), with the provider in the root layout. This is the same architectural idea as a CompanyProvider.
2. **Backend is ready.** `getOwnerContext(request)` derives `ownerType` and `ownerId` from the request (searchParams). When the client sends these (e.g. on every API request or in the dashboard URL), the server can scope data correctly. No change to the *pattern* is required; only consistent use of the existing context.
3. **No structural conflict.** There is no competing global store or route-based entity selection (e.g. `/house/[id]/...`) that would make a second “selected entity” context redundant or conflicting. The only gap is that most of the app does not read the existing context when fetching or mutating data.

**Conclusion:** The pattern would work; the project already implements it and needs to **use** it consistently (and optionally reinforce it with URL or server-visible persistence for server components).

---

## 3. Benefits

If the existing context is used consistently across the app:

1. **Correct scoping in house mode.** When the user selects a house, all relevant API calls (transactions, reports, wallets, fortnights, templates, etc.) would send `ownerType=house` and `ownerId=<id>`, so the app would show house data instead of always defaulting to personal.
2. **Single source of truth.** One place (FinanceContext) holds the current scope; no need to pass house_id/user_id through props or duplicate “which entity am I in?” logic in many components.
3. **Persistence and UX.** The current choice is already persisted to localStorage, so reloads and revisits keep the same scope; the pattern supports that.
4. **Alignment with backend.** The backend already expects owner context via request params; using the context on the client would complete the loop and fix the “house selected but personal data shown” behavior identified in the multi-owner audit.
5. **Clear extension point.** If later the app adds more entity types (e.g. workspace, tenant), the same pattern can be extended (e.g. `type: 'user' | 'house' | 'workspace'` and a single selected entity).

---

## 4. Risks or Conflicts

1. **Server components cannot read React context.** The dashboard and monthly pages are server components and do not have access to `useFinanceContext()`. So either:  
   - The selection must be **passed to the server** (e.g. via URL searchParams or a cookie), and server-side code must forward it to `fetchFromApi` / `getOwnerContext`, or  
   - Data that depends on the selected entity must be fetched on the **client** (using the context) instead of in the server component.  
   This is an **integration** requirement, not a conflict with the context pattern itself.

2. **Single consumer today.** Only TeamSwitcher uses `useFinanceContext()`. All other client callers (wallets page, FortnightColumn, expense/transaction forms, etc.) would need to be updated to read context and pass `ownerType`/`ownerId` (e.g. in URLs or body). Until that is done, the pattern “exists but is underused,” which can be confusing.

3. **No URL for entity today.** Because the selected entity is not in the URL, deep links or shared links do not encode “which house” or “personal.” If the product needs shareable or bookmarkable URLs per entity, the pattern would need **adaptation**: e.g. sync context to URL (e.g. `?ownerType=house&ownerId=2`) or use path segments (e.g. `/house/2/dashboard`). That would complement, not replace, the context.

4. **Stale or invalid id.** If the user is removed from a house but the stored context still has `type: 'house', id: <that_house>`, subsequent API calls could get 403s. The backend already validates membership in `getOwnerContext` for house; the client could react to 403 by falling back to user context. No architectural conflict.

5. **No competing pattern.** There is no other global “current entity” mechanism (no route-based tenant, no separate store). So there is no conflict with another way of managing the same concept.

---

## 5. Recommendation

**The pattern would work well but needs adaptation.**

- **Would work well:** The project already implements a global selected-entity context (FinanceProvider), persisted to localStorage, with a hook and the provider in the root layout. The backend is designed to scope by `ownerType`/`ownerId` from the request. The same pattern (one selected entity, one context, one hook) fits the architecture and would solve incorrect scoping when a house is selected.
- **Needs adaptation:**  
  1. **Use the context everywhere scope matters.** Every client-side API caller that should respect “personal vs house” (transactions, reports, wallets, fortnights, templates, dashboard data, etc.) should call `useFinanceContext()` and append `ownerType` and `ownerId` to requests (query or body as the API expects).  
  2. **Bridge to the server.** For server-rendered pages that need the current entity (e.g. dashboard, monthly), introduce a way for the server to know the selection: e.g. pass `ownerType` and `ownerId` in the request URL (or cookie) and have the server pass them into `fetchFromApi` and thus into `getOwnerContext`. Alternatively, move that data loading to the client so it can use the context directly.  
  3. **Optional: URL sync.** If shareable or bookmarkable URLs per entity are required, add a sync between context and URL (or path) so the selected entity is encoded in the address bar; the existing context can remain the single source of truth and be hydrated from the URL on load.

The pattern does **not** conflict with the current architecture; it is already the chosen approach and only needs to be applied consistently and connected to the server where needed.
