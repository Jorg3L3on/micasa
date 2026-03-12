# Onboarding Flow Audit

**Purpose:** Codebase analysis of the onboarding process. No code was modified.

**Date:** 2026-03-08

---

## 1. Identify All Onboarding-Related Files

| File | Role |
|------|------|
| **Signup / Register flow** | |
| `src/app/(auth)/register/page.tsx` | Renders the register page; wraps `RegisterForm` in a centered layout. |
| `src/components/register-form.tsx` | Client form: collects name, email, password, confirmPassword; POSTs to `/api/auth/register`; on success calls `signIn('credentials', ...)` then `router.push('/dashboard')`. Does not create House/Wallet—that is done by the register API and later by onboarding. |
| `src/app/api/auth/register/route.ts` | Register API: validates body, checks duplicate email, hashes password; in a transaction creates **User**, **House** (`Casa de ${name}`), and **HouseMember** (OWNER). Returns 201 with user + house. Does **not** set `onboarding_completed` or create a wallet. |
| **Onboarding page** | |
| `src/app/onboarding/page.tsx` | Server component: requires session; loads user’s `onboarding_completed`; if already completed redirects to `/dashboard`; otherwise renders `CreateWallet`. |
| **Onboarding API** | |
| `src/app/api/onboarding/route.ts` | POST only: requires session; validates user; checks for existing **personal** wallet (`user_id`, `house_id: null`); if exists, sets `onboarding_completed` and returns `completed: true, walletCreated: false`; otherwise calls `createWalletForUser` with name `"Cash"`, amount 0, type `CASH`, then sets `onboarding_completed` and returns `completed: true, walletCreated: true`. |
| **Dashboard guard** | |
| `src/app/(dashboard)/layout.tsx` | Dashboard layout: requires session; loads user’s `onboarding_completed`; if **not** completed redirects to `/onboarding`. So any route under `(dashboard)` is protected by this guard. |
| `src/app/(dashboard)/dashboard/page.tsx` | Dashboard page: requires session; looks up a **personal** wallet (`user_id: userId`, `house_id: null`); if **no** wallet redirects to `/onboarding`; otherwise loads dashboard data and renders. |
| **Wallet creation during onboarding** | |
| `src/components/onboarding/CreateWallet.tsx` | Client component: “Bienvenido a MiCasa” UI with a single button that POSTs to `/api/onboarding`; on success redirects to `/dashboard` (preserving query string). |
| `src/lib/finance/wallet.service.ts` | Defines `createWalletForUser(userId, data)`: creates a `Wallet` with `user_id: userId`, `house_id: null`, plus name, amount, type, active, cutoff_day, due_day. Used by the onboarding API. |
| **Schema / DB** | |
| `prisma/schema.prisma` | `User.onboarding_completed` (Boolean, default false); `Wallet` model with `user_id`, `house_id`, etc. |
| **Other** | |
| `src/proxy.ts` | If user is logged in and visits `/login` or `/register`, redirects to `/dashboard`. Does not implement onboarding logic. |

---

## 2. Describe the Full Onboarding Flow

What happens for a **new user** from signup to first use of the dashboard:

1. **User registers**  
   User submits the form in `register-form.tsx` → POST `/api/auth/register` with `name`, `email`, `password`.  
   **Register API** (`api/auth/register/route.ts`): in one transaction creates **User**, **House** (“Casa de {name}”), **HouseMember** (user as OWNER). User is created with `onboarding_completed: false` (schema default). No wallet is created.

2. **User is logged in**  
   After 201, `register-form.tsx` calls `signIn('credentials', { email, password, redirect: false })` then `router.push('/dashboard')` (with optional query string). So the user is sent to `/dashboard`.

3. **Dashboard layout runs**  
   For any request under `(dashboard)`, `(dashboard)/layout.tsx` runs: `auth()` → get user by `session.user.id` → `user.onboarding_completed`. For a new user it is `false`, so the layout does `redirect('/onboarding')`. The user never reaches the dashboard page component.

4. **User is on onboarding page**  
   `onboarding/page.tsx` runs: requires session; loads `onboarding_completed`; if true would redirect to `/dashboard` (not the case here); otherwise renders `CreateWallet`.

5. **User clicks “Crear mi primera billetera”**  
   `CreateWallet` calls `fetch('/api/onboarding', { method: 'POST' })`. No body; session cookie identifies the user.

6. **Onboarding API runs**  
   - Auth: `auth()` → `session.user.id` → numeric `userId`.  
   - User exists check: `prisma.user.findUnique({ where: { id: userId } })`.  
   - Existing wallet check: `prisma.wallet.findFirst({ where: { user_id: userId, house_id: null } })`.  
   - If a personal wallet exists: update user `onboarding_completed: true`, return `{ completed: true, walletCreated: false }`.  
   - If not: `createWalletForUser(userId, { name: 'Cash', amount: 0, type: 'CASH', active: true, cutoff_day: null, due_day: null })`, then set `onboarding_completed: true`, return `{ completed: true, walletCreated: true }`.

7. **Redirect to dashboard**  
   If the POST is OK, `CreateWallet` does `router.push('/dashboard' + queryString)`. On the next request, layout sees `onboarding_completed: true` and allows access; dashboard page finds the personal wallet and renders the panel.

**Summary:** Register → sign in → redirect to `/dashboard` → layout redirects to `/onboarding` → user sees CreateWallet → POST `/api/onboarding` → wallet created (or already exists) and `onboarding_completed` set → redirect to `/dashboard` → user sees dashboard.

---

## 3. What Onboarding Creates in the Database

**Signup (register) creates:**

- **User**  
  - `name`, `email`, `password` (hashed), `active: true`, `onboarding_completed: false` (default).

- **House**  
  - `name: "Casa de {name}"`, `owner_id: user.id`.

- **HouseMember**  
  - `house_id`, `user_id`, `role: OWNER`.

**Onboarding (POST `/api/onboarding`) creates or updates:**

- **Wallet** (only if the user has no personal wallet yet):  
  - `name: 'Cash'`  
  - `amount: 0`  
  - `type: 'CASH'`  
  - `active: true`  
  - `cutoff_day: null`  
  - `due_day: null`  
  - `user_id: userId` (session user)  
  - `house_id: null` (personal wallet)

- **User** (update):  
  - `onboarding_completed: true`

No other records are created by the onboarding API (no House, HouseMember, Category, etc.).

---

## 4. Redirect Logic

**If user has no wallet**

- **Layout:** `src/app/(dashboard)/layout.tsx` does **not** check wallet; it checks `onboarding_completed`. If `!user?.onboarding_completed` → `redirect('/onboarding')`. So a new user (who has no wallet and has not completed onboarding) is sent to onboarding by the layout before the dashboard page runs.
- **Dashboard page:** `src/app/(dashboard)/dashboard/page.tsx` also checks for a personal wallet: `prisma.wallet.findFirst({ where: { user_id: userId, house_id: null } })`. If `!wallet` → `redirect('/onboarding')`. This covers the case where `onboarding_completed` is true but the personal wallet was deleted or never created.

**If user already has a wallet**

- **Onboarding page:** `src/app/onboarding/page.tsx` loads `onboarding_completed`. If `user?.onboarding_completed` → `redirect('/dashboard')`. So a user who already completed onboarding (and thus already has a personal wallet) cannot stay on the onboarding page; they are sent to the dashboard.

**Summary:** No wallet / not completed → redirect to `/onboarding`. Has completed onboarding (and in practice a wallet) → redirect to `/dashboard`. The logic lives in `(dashboard)/layout.tsx` (onboarding_completed), `(dashboard)/dashboard/page.tsx` (wallet existence), and `onboarding/page.tsx` (onboarding_completed).

---

## 5. Idempotency

**Can onboarding accidentally create multiple wallets?**

- **No.** In `src/app/api/onboarding/route.ts`, before creating a wallet the API does:
  - `prisma.wallet.findFirst({ where: { user_id: userId, house_id: null } })`.
- If `existingWallet` is found, it **does not** call `createWalletForUser`. It only updates `onboarding_completed` and returns `{ completed: true, walletCreated: false }`.
- The wallet is created only when no personal wallet exists. So repeated POSTs to `/api/onboarding` (e.g. double-clicks or multiple tabs) do not create duplicate personal wallets; the second and subsequent calls just set `onboarding_completed` and return.

**Conclusion:** The API is idempotent with respect to wallet creation for the authenticated user’s personal wallet.

---

## 6. Security

**Uses the authenticated session user**

- **Onboarding page:** `auth()` then `session.user.id`; redirects to `/login` if no session.
- **Onboarding API:** `auth()` then `session.user.id`; returns 401 if no session; validates `userId` and that the user exists in DB. All operations use this `userId`.

**Does not create wallets for other users**

- The only `userId` used is from `session.user.id`. There is no request body or query parameter that selects a user. So wallets are created only for the authenticated user.

**Does not expose other users’ wallets**

- The onboarding API does not return any wallet list or wallet details. It returns only `{ completed: true, walletCreated: true|false }`.
- The wallet is created with `user_id: userId` (session user) and `house_id: null`. Listing or accessing wallets elsewhere in the app is not part of this route; the route only creates one wallet for the current user and marks onboarding complete.

**Conclusion:** Onboarding is scoped to the authenticated user, creates only that user’s personal wallet, and does not expose other users’ data.

---

## 7. Final Summary

**Current onboarding behavior**

- **What happens:** After signup, the user is logged in and sent to `/dashboard`. The dashboard layout redirects to `/onboarding` because `onboarding_completed` is false. The user sees the “Bienvenido a MiCasa” screen and clicks “Crear mi primera billetera”. A POST to `/api/onboarding` either finds an existing personal wallet or creates one, then sets `onboarding_completed: true`. The client then redirects to `/dashboard`, and the user sees the dashboard.
- **What is created:** At most one **Wallet** per user for onboarding: personal (`house_id: null`), name `"Cash"`, type `CASH`, amount 0. The **User** row is updated with `onboarding_completed: true`. No House, HouseMember, or other entities are created by onboarding.
- **What the user sees:** One onboarding screen with a single button; after clicking, a redirect to the dashboard with no extra steps.

**Does onboarding only create a single default wallet named “Cash”?**

- **Yes.** The code path that creates a wallet during onboarding is a single call to `createWalletForUser(userId, { name: 'Cash', amount: 0, type: 'CASH', active: true, cutoff_day: null, due_day: null })`, and it is executed only when there is no existing personal wallet. So:
  - Only one personal wallet is created for onboarding.
  - That wallet is always named `"Cash"`, type `CASH`, amount 0.

This is **intentional** (first-time setup of a default wallet) and **safe**: creation is guarded by the “existing personal wallet” check, and the API is scoped to the session user only.

---

## 8. No Code Changes

This audit is analysis only. No code was added, refactored, or removed.
