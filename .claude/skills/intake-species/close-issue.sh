#!/usr/bin/env bash
# Close the GitHub Intake: Species issue for a promoted species.
#
# The issue number must be passed explicitly.
#
# Usage:
#   bash .claude/skills/intake-species/close-issue.sh <Genus> <species> <issue> <commit_sha>
set -euo pipefail

if [ "$#" -ne 4 ]; then
    echo "Usage: $0 <Genus> <species> <issue> <commit_sha>" >&2
    exit 2
fi

genus="$1"
species="$2"
issue_number="$3"
commit_sha="$4"

echo "Genus:      $genus"
echo "Species:    $species"
echo "Issue:      #$issue_number"
echo "Commit SHA: $commit_sha"

gh issue comment "$issue_number" --body \
"Closing — \`${genus} ${species}\` added in ${commit_sha} via the per-species intake pipeline (bootstrap → paper extraction → apply)."

labels=$(gh issue view "$issue_number" --json labels --jq '.labels[].name')

while IFS= read -r label; do
    case "$label" in
        "Intake: Disputed"|"Intake: Requires Manual Intervention")
            echo "Removing label: $label"
            gh issue edit "$issue_number" --remove-label "$label"
            ;;
    esac
done <<< "$labels"

gh issue close "$issue_number" --reason completed 2>&1 || \
    gh issue view "$issue_number" --json state --jq '.state' | grep -q CLOSED
