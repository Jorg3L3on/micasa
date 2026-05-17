# Development workflow (humans + AI)

## Overview

```text
Idea → PRD → Issues → feat/<slug> → implement → you merge slices → final PR → main (prod)
```

| Step | Tool |
| ---- | ---- |
| Plan | `prd` or `to-prd` |
| Orchestrate | `ship-feature` |
| Merge PRs | **You** |

Shared skills: `~/.cursor/skills/` (`prd`, `to-prd`, `to-issues`, `implement-issue`, `ship-feature`, `validate-issues`).

Install skills once (from Zigzag or any repo with the kit):

```bash
bash /Users/jorgeleon/Developer/Projects/zigzag/docs/agent-workflow/scripts/install-shared-agent-skills.sh
```

## Quick start

```text
/ship-feature tasks/prd-my-feature.md
```

1. Parent PRD issue on GitHub
2. Slice issues
3. `feat/my-feature` + slice PRs (you merge each; `continue`)
4. Agent opens final PR to `main` (you merge once)

See [deployment.md](./deployment.md) and [CONTRIBUTING.md](../../CONTRIBUTING.md).

Porting guide (other repos): [Zigzag PORT-AGENT-WORKFLOW.md](https://github.com/Jorg3L3on/zigzag/blob/main/docs/agent-workflow/PORT-AGENT-WORKFLOW.md)
