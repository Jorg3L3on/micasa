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
