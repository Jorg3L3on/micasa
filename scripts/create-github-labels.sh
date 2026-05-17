#!/usr/bin/env bash
# Create GitHub labels for Micasa agent workflow. Requires: gh auth login
set -euo pipefail

REPO="${GITHUB_REPOSITORY:-Jorg3L3on/micasa}"

create_label() {
  local name="$1" color="$2" description="$3"
  if gh label list --repo "$REPO" --json name --jq ".[].name" 2>/dev/null | grep -qx "$name"; then
    echo "exists: $name"
  else
    gh label create "$name" --repo "$REPO" --color "$color" --description "$description"
    echo "created: $name"
  fi
}

echo "Creating labels on $REPO ..."
create_label "needs-triage" "ededed" "Maintainer needs to evaluate"
create_label "needs-info" "d4c5f9" "Waiting on reporter"
create_label "ready-for-agent" "0e8a16" "Ready for AFK agent"
create_label "ready-for-human" "fbca04" "Requires human implementation"
create_label "wontfix" "ffffff" "Will not be actioned"
create_label "type:feature" "a2eeef" "New feature"
create_label "type:bug" "d73a4a" "Bug fix"
create_label "type:chore" "cfd3d7" "Chore / refactor"
create_label "type:docs" "0075ca" "Documentation"
create_label "status:in-progress" "1d76db" "In progress"
echo "Done."
