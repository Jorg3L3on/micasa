# Deployment (Vercel)

**`main` is production.** Merging to `main` deploys production.

Slice work from **`ship-feature`** uses **`feat/<feature-slug>`** so incomplete PRDs do not hit prod.

| Step | Branch | Deploy |
| ---- | ------ | ------ |
| Slice PRs | `feat/<slug>` | Preview |
| Release | PR `feat/<slug>` → `main` | Production (once) |

Agents open slice PRs into `feat/<slug>` and the final PR to `main`. **You merge** all PRs.

## Per PRD

~1 preview per slice merge on `feat/<slug>`; **1** prod deploy when you merge the feature PR to `main`.

## Before prod merge

- Run `npm run ci` on the feature branch when possible
- Apply Prisma migrations to production DB if schema changed (`npx prisma migrate deploy` per your hosting runbook)

## Vercel

Keep **Production Branch = `main`**.

## Error monitoring (Sentry)

Runtime init is env-gated (`NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_DSN`). Without them the app runs normally and does not send events.

After creating a Sentry project for MiCasa:

1. Add on Vercel (**Preview** + **Production**):
   - `NEXT_PUBLIC_SENTRY_DSN` and/or `SENTRY_DSN`
   - `SENTRY_AUTH_TOKEN` (org token with `project:releases` / source maps)
   - `SENTRY_ORG` and `SENTRY_PROJECT`
2. Deploy and confirm source maps under **Sentry → Releases** (build uploads only when `SENTRY_AUTH_TOKEN` is set).
3. Create an alert for an **error-rate spike** (e.g. error count above a threshold in 5–10 minutes) → email or Slack: [Sentry Alerts](https://docs.sentry.io/product/alerts/).

Tags on finance API failures: `owner_type`, `owner_id`, `route` (user id only — no email/PII in titles).

Client events tunnel through `/monitoring` (excluded from auth proxy) to reduce ad-blocker drops.
