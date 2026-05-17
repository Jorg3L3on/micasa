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
