# Production Prisma migrations

Production schema changes apply during the Vercel **build**, before the new deployment can receive traffic. The build command is `npm run build`, which runs `scripts/vercel-build.ts`.

## How it works

1. Vercel builds only `main` (`vercel.json`: `git.deploymentEnabled` and `ignoreCommand` are unchanged).
2. The script reads `VERCEL_ENV` (set by Vercel, not by us).
3. **`prisma migrate deploy` runs only when `VERCEL_ENV` is exactly `production`.** Preview, development, GitHub Actions, and a local `npm run build` skip the migration and log the skip. A `DATABASE_URL` in those environments is not enough to migrate.
4. The migration uses the first non-blank URL among:
   - `DATABASE_URL_UNPOOLED` (Neon direct)
   - `POSTGRES_URL_NON_POOLING` (Vercel/Neon direct)
   - `DIRECT_URL`
   - `DATABASE_URL` (fallback; the app runtime already uses this)
5. `prisma.config.ts` reads `DATABASE_URL`. The script passes the chosen URL as `DATABASE_URL` **only to the migrate subprocess**. It does not print the URL.
6. If migrate exits non-zero, the script exits non-zero. Vercel does not promote that deployment. The previous production deployment keeps serving.
7. After a successful migrate (or a skip), the script runs `prisma generate` and `next build`.

### Why the build, not a GitHub Actions job

A job that migrates before promote would need the production database URL as a GitHub secret. This repo does not add that secret. GitHub CI also runs on pull requests, in parallel with Vercel, and cannot block Vercel’s promote without extra project settings.

The production build already has the database URL. Failing the build is the gate: no successful build, no new traffic.

## Expand / contract

Migrations that ship in the same release as the code that needs them must be **backward compatible**. The previous deployment keeps running until the new build is promoted, and it keeps running if you roll the deployment back later.

Safe (expand) in the release that introduces a change:

- Add a nullable column, or a column with a default.
- Add a new table.
- Add an index.
- Widen a column in a way old code still accepts.

Unsafe in the same release as the code that depends on the old shape:

- Drop or rename a column the current production code still reads or writes.
- Add a `NOT NULL` column with no default.
- Change a column type the current code does not understand.

Contract in a **later** release, after every running deployment uses the new shape: drop the old column, tighten nullability, remove the compatibility shim.

## If the build fails after migrate

`prisma migrate deploy` commits before `next build` finishes. If generate or `next build` then fails, Vercel does not promote. Production still serves the **previous** deployment, against a schema that may already include the new migration.

That is safe only when the migration is backward compatible (see above). Do not “fix” this by editing the failed migration and pushing a new one with the same name. Add a new migration, or follow the failed-migration steps below if Prisma recorded a failed run.

## Roll back code without rolling back the schema

Use Vercel’s rollback / redeploy of the **previous** deployment. Do not run a down migration as part of that rollback. The previous code must still work with the expanded schema.

## Failed migration (`prisma migrate resolve`)

If `migrate deploy` stops midway, Prisma may mark that migration as failed and refuse later deploys (`P3009`).

1. Read the build log for the migration name. Confirm whether the SQL committed.
2. From a machine that can reach the **production** database with a **direct** URL (not the pooler), with `DATABASE_URL` set to that direct URL:
   - Applied and correct: `npx prisma migrate resolve --applied <migration_name>`
   - Not applied and safe to retry: `npx prisma migrate resolve --rolled-back <migration_name>`
3. Push a new commit (or redeploy) so the production build runs `migrate deploy` again.

Do not use `migrate resolve` against a preview database to paper over a production failure.

## Preview and Development must not use the production database

The script will not migrate unless `VERCEL_ENV` is exactly `production`, including when a preview build is accidentally given the production URL. That is a backstop, not a reason to share databases.

Check in the Vercel project (**Settings → Environment Variables**), per environment:

| Variable | Production | Preview | Development |
| --- | --- | --- | --- |
| `VERCEL_ENV` | Set by Vercel to `production` | Set by Vercel to `preview` | Set by Vercel to `development` |
| `DATABASE_URL` | Production database (may be pooled) | A **different** database | Local or a **different** database |
| `DATABASE_URL_UNPOOLED` or `POSTGRES_URL_NON_POOLING` or `DIRECT_URL` | Direct URL used for migrate | Not required for migrate (migrate does not run) | Not required |

Confirm:

- Preview and Development `DATABASE_URL` values are not the production URL.
- Production has a direct/unpooled URL when `DATABASE_URL` uses a pooler (`-pooler` in the host, or `pgbouncer=true`). The build warns and still migrates if only a pooled URL exists; DDL through a transaction pooler can fail the build.
- The dashboard **Build Command** override is off, so `vercel.json` `buildCommand` (`npm run build`) is what Vercel runs. An override of `next build` would skip migrations.
- GitHub Actions does not set `VERCEL_ENV=production`. `npm run build` there only generates the client and runs `next build`.
