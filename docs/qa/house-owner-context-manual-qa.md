# Manual QA — Personal vs house owner context

Use this script before releasing owner-context changes (Phase 1.4 / #109).
Requires a user with **personal wallets/expenses** and membership in a **house that has its own wallets/expenses**.

Seed accounts (dev): Jorge / Carmen — see `AGENTS.md`.

## Setup

1. Log in.
2. Confirm the team switcher shows both **Personal** and at least one **House**.
3. Have Prisma Studio or SQL ready if you want to verify `user_id` / `house_id` on rows.

## Script

### A. Personal context

1. Select **Personal** in the team switcher.
2. Open **Wallets** — note the wallet count and names.
3. Open **Gastos / Transactions** for the current month — note expense count.
4. Open **Fortnights / Monthly** — note which fortnights appear.
5. Confirm: no wallets that you only created under the house appear in this list.

### B. House context

1. Switch to the **House** in the team switcher.
2. Open **Wallets** again — count and names must differ from personal (or be a subset that is house-owned only).
3. Confirm: personal-only wallets do **not** appear.
4. Open **Gastos / Transactions** — expense set must be house-scoped (not the personal list).
5. Open fortnights / monthly — house fortnights only.

### C. Create month in house context

1. Stay in **House** context.
2. Create the current (or next allowed) month via the create-month flow.
3. Verify in DB (or network response) that new `Fortnight` rows have:
   - `house_id` = active house
   - `user_id` = `null`
4. Switch back to **Personal** — the new house month must **not** appear as a personal fortnight.

### D. Transfers (if using `/api/transfers` or house income with transfer-from-user)

1. In house context, record a user→house contribution (or POST `/api/transfers` with `ownerType=house&ownerId=<house>`).
2. Confirm 403 when `user_id` in the body is not the logged-in user.
3. Confirm 403 when the user is not a member of `house_id`.
4. Confirm GET `/api/transfers?ownerType=house&ownerId=<house>` returns only that house’s transfers.

## Pass criteria

| Check | Expected |
|-------|----------|
| Wallet lists | Personal ≠ house; no cross-leak of personal-only wallets into house |
| Expense lists | Scoped to active owner |
| Create month (house) | Fortnights owned by `house_id`, not personal `user_id` |
| Transfers | Auth + membership enforced; lists filtered by active owner |

## Failures to report

- Same wallet/expense counts after switching context when data is known to differ
- House create-month writing `user_id` of the session user (or `defaultUser`)
- Ability to list or create transfers for a house you do not belong to
