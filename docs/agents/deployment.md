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

## Sentry (error monitoring)

SDK is wired for Next.js **server**, **edge/proxy**, and **client** (`instrumentation.ts`, `sentry.*.config.ts`, `instrumentation-client.ts`, `global-error.tsx`). Statement-import and other API failures can attach `owner_type` / `owner_id` / `user.id` (numeric only — no email in titles).

### Env vars (Vercel Production + Preview)

| Variable | Where | Purpose |
| -------- | ----- | ------- |
| `NEXT_PUBLIC_SENTRY_DSN` | Runtime (client + server fallback) | Project DSN |
| `SENTRY_DSN` | Runtime (server/edge preferred) | Same DSN; optional if public DSN is set |
| `SENTRY_ENVIRONMENT` | Runtime | Optional override (`production` / `preview`) |
| `SENTRY_ORG` | Build | Org slug for source map upload |
| `SENTRY_PROJECT` | Build | Project slug for source map upload |
| `SENTRY_AUTH_TOKEN` | Build (secret) | Enables source map upload on `next build` |

Without a DSN, Sentry stays **disabled** and the app runs normally.

### Alerts (Sentry UI — one-time)

1. Create a project (Next.js) and paste the DSN into Vercel env.
2. **Alerts → Create Alert → Issues**: condition **Number of errors** in an environment is above a threshold (e.g. > 20 in 10 minutes) → notify Slack/email.
3. Optionally filter by tag `feature:statement-import` for import-specific noise.
4. Confirm a production deploy uploaded source maps (release artifacts in Sentry) when `SENTRY_AUTH_TOKEN` is set on the Vercel build.
