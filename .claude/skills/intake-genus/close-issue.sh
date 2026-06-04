#!/usr/bin/env bash
# Close the GitHub Intake issue for a promoted genus.
#
# This helper does ONLY GitHub-side work:
#
#   1. Add a completion comment referencing the commit SHA
#   2. Remove the "Intake: Disputed" / "Intake: Requires Manual
#      Intervention" sub-label
#   3. Close the issue with reason "completed"
#
# The issue number is passed explicitly (bulk intake from a triage
# table has been retired; intake is now one genus at a time).
#
# Usage: bash .claude/skills/intake-genus/close-issue.sh <Genus> <issue_number> <commit_sha>
set -euo pipefail

if [ "$#" -ne 3 ]; then
    echo "Usage: $0 <Genus> <issue_number> <commit_sha>" >&2
    exit 2
fi

genus="$1"
issue_number="$2"
commit_sha="$3"

echo "Genus:        $genus"
echo "Issue:        #$issue_number"
echo "Commit SHA:   $commit_sha"

gh issue comment "$issue_number" --body \
"Closing — \`${genus}\` promoted in ${commit_sha} via the per-genus intake pipeline (bootstrap → paper extraction → apply)."

labels=$(gh issue view "$issue_number" --json labels --jq '.labels[].name')

while IFS= read -r label; do
    case "$label" in
        "Intake: Disputed"|"Intake: Requires Manual Intervention")
            echo "Removing label: $label"
            gh issue edit "$issue_number" --remove-label "$label"
            ;;
    esac
done <<< "$labels"

# `gh issue close` is a no-op when the issue is already closed; treat
# that as success rather than an error so we don't trip set -e on the
# subset of repos that auto-close issues on label removal.
gh issue close "$issue_number" --reason completed 2>&1 || \
    gh issue view "$issue_number" --json state --jq '.state' | grep -q CLOSED
