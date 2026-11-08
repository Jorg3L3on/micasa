# Deployment (Vercel)

**`main` is production.** Merging to `main` deploys production.

Slice work from **`ship-feature`** uses **`feat/<feature-slug>`** so incomplete PRDs do not hit prod.

| Step | Branch | Deploy |
| ---- | ------ | ------ |
| Slice PRs | `feat/<slug>` | Preview |
| Release | PR `feat/<slug>` → `main` | Production (once) |

Agents open slice PRs into `feat/<slug>`, **merge those slice PRs** once CI is green, and open the final PR to `main`. **You merge only** the final PR to `main` (production).

## Per PRD

~1 preview per slice merge on `feat/<slug>`; **1** prod deploy when you merge the feature PR to `main`.

## Before prod merge

- Run `npm run ci` on the feature branch when possible
- Apply Prisma migrations to production DB if schema changed (`npx prisma migrate deploy` per your hosting runbook)

## Vercel

Keep **Production Branch = `main`**.

Unexpected API failures log a JSON line (`event: api.unexpected_error`) with `route`, `owner_type`, and `owner_id`. User id only — no email in the line. Vercel runtime logs are the place to read them.

## Database host (Neon)

Production runs on Vercel with `@prisma/adapter-neon` (`src/lib/prisma.ts`), which opens a pool per serverless instance. `DATABASE_URL` should use Neon's **pooled** host (`<endpoint>-pooler.<region>.aws.neon.tech`) so many short-lived instances share PgBouncer connections instead of each opening its own.

Migrations read the same `DATABASE_URL` (`prisma.config.ts`). PgBouncer in transaction mode does not keep the session advisory lock `prisma migrate deploy` takes, so run migrations with the **direct** host (same URL without `-pooler`), e.g. `DATABASE_URL=<direct url> npx prisma migrate deploy`.

## Server timings

`measure()` (`src/features/monthly/server/monthly.performance.ts`) prints `[perf] <step> <ms>` lines only when `MICASA_PERF_LOG=1`. Leave it unset on Vercel; set it locally when measuring the Panel.
