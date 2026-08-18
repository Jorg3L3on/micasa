# Agent configuration

| File | Purpose |
| ---- | ------- |
| [workflow.md](./workflow.md) | End-to-end flow |
| [deployment.md](./deployment.md) | `main` = prod; `feat/<slug>` integration |
| [issue-tracker.md](./issue-tracker.md) | GitHub + `gh` |
| [triage-labels.md](./triage-labels.md) | Labels |
| [domain.md](./domain.md) | Micasa glossary & checks |
| [`../../DESIGN.md`](../../DESIGN.md) | Orion UI tokens, glass, CTAs (do not commit vendor mockups) |

Finance deep-dives (humans): [`../finance-architecture.md`](../finance-architecture.md), [`../finance-invariants.md`](../finance-invariants.md). App UI skill: [`.claude/skills/dashboard-ui/SKILL.md`](../../.claude/skills/dashboard-ui/SKILL.md).

```bash
bash scripts/create-github-labels.sh   # once, after gh auth login
```
