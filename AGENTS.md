# AGENTS.md

## Cursor Cloud specific instructions

### Services overview

MiCasa is a monolithic Next.js 16 app (App Router + React 19) with PostgreSQL via Prisma 7. There is **one** process to run: `npm run dev` (port 3000). No Redis, S3, Docker, or external services required.

### Environment

PostgreSQL 16 runs locally. The `.env` file must contain:
- `DATABASE_URL` — connection string (local default: `postgresql://micasa:micasa123@localhost:5432/micasa`)
- `NEXTAUTH_SECRET` — any random string for JWT signing
- `NEXTAUTH_URL` — `http://localhost:3000`

### Starting PostgreSQL

```bash
sudo pg_ctlcluster 16 main start
```

PostgreSQL must be running before the dev server or any Prisma command.

### Running the app

See `CLAUDE.md` and `README.md` for standard commands (`npm run dev`, `npm run lint`, `npm test`, `npm run build`, `npm run ci`).

### Test accounts (from seed data)

| Name   | Email                            | Password  |
|--------|----------------------------------|-----------|
| Jorge  | jorgeleon983@gmail.com           | temp1234  |
| Carmen | Consepcionsolorzano39@gmail.com  | temp1234  |

To re-seed: `npx prisma db seed` (destructive — clears all data first).

### Gotchas

- **Lint exits with code 1** due to pre-existing warnings/errors in the codebase (React hooks violations, unused vars). This is expected; do not treat lint failure as a blocker for CI unless you introduced new errors.
- **Prisma client output** is `src/generated/prisma` (non-default). Always import from there or via `src/lib/prisma.ts`.
- After schema changes, run `npx prisma generate` before starting the dev server.
- The `npm run ci` script runs: `validate:dashboard-ui` → `prisma generate` → `vitest run` → `next build`.
- The dev server uses `--webpack` mode by default (`npm run dev`). Turbopack mode is available via `npm run dev:turbo`.
