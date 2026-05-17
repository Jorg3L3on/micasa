# Issue tracker: GitHub

Issues and PRDs live as **GitHub Issues** on [Jorg3L3on/micasa](https://github.com/Jorg3L3on/micasa). Use the [`gh`](https://cli.github.com/) CLI from a clone of this repo.

## Conventions

- **Create**: `gh issue create --title "..." --body "..." --label "ready-for-agent"`
- **Read**: `gh issue view <number> --comments`
- **List**: `gh issue list --state open --label "ready-for-agent"`
- **Labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`

`gh` infers the repo from `git remote` when run inside the clone.

## Linking

- **Parent PRD**: `## Parent` in child issues
- **Slice PR**: base **`feat/<feature-slug>`**, not `main` — `Closes #N`, `Part of #<parent>`
- **Feature PR**: `feat/<slug>` → `main` when PRD complete
- **Local PRDs**: `tasks/prd-*.md` via `prd` skill

## Publish / fetch

Create issues with labels from [triage-labels.md](./triage-labels.md). Fetch with `gh issue view <number> --comments`.
