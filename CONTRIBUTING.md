# Contributing to Micasa

## Getting started

```bash
npm install
# Create .env in project root (see README.md Environment Variables)
npx prisma generate
npx prisma migrate dev
npm run dev
```

Architecture: [AGENTS.md](AGENTS.md) and [CLAUDE.md](CLAUDE.md).

## Workflow with AI

Details: [docs/agents/workflow.md](docs/agents/workflow.md).

1. **Plan** — `/prd` → `tasks/prd-*.md` or `/to-prd` → parent GitHub issue
2. **Ship** — `/ship-feature tasks/prd-….md` (parent issue + slice issues + `feat/<slug>` branch)
3. **Agent merges** each slice PR into `feat/<slug>` after CI is green (preview on Vercel)
4. **You merge** the final PR `feat/<slug>` → `main` once (production)

**One-time:** `bash scripts/create-github-labels.sh` after `gh auth login`.

**Shared Cursor skills** (optional, install once per machine): see [docs/agents/workflow.md](docs/agents/workflow.md) for the install script path on your machine.

Agents may merge slice PRs into `feat/<slug>`. Agents must **not** merge to `main` or push to production.

## Before you open a PR

```bash
npm run lint
npm test
npm run build
```

Or full CI: `npm run ci`

- Branch: `feat/<issue>-slug` for slices, or `feat/<feature-slug>` integration branch per [docs/agents/deployment.md](docs/agents/deployment.md)
- PR body: `Closes #<issue>`, `Part of #<parent>` when applicable
- Prisma: include migration + `npx prisma generate` when schema changes

## Security

Do not commit `.env` or secrets.
