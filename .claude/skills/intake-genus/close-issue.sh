#!/usr/bin/env bash
# Close the GitHub Intake issue for a promoted genus.
#
# This helper does ONLY GitHub-side work:
#
#   1. Look up the issue number from reports/intake-triage.md
#   2. Add a completion comment referencing the commit SHA
#   3. Remove the "Intake: Disputed" / "Intake: Requires Manual
#      Intervention" sub-label
#   4. Close the issue with reason "completed"
#
# Marking the triage row [done <sha>] is NOT done here — that has to
# happen BEFORE the genus push so it lands in the same push and avoids
# racing the GitHub Actions Build workflow. See SKILL.md step 7.
#
# Usage: bash .claude/skills/intake-genus/close-issue.sh <Genus> <commit_sha>
set -euo pipefail

if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <Genus> <commit_sha>" >&2
    exit 2
fi

genus="$1"
commit_sha="$2"
triage_path="reports/intake-triage.md"

if [ ! -f "$triage_path" ]; then
    echo "Missing $triage_path" >&2
    exit 1
fi

# Locate the issue number from the triage table — the row's second
# pipe-separated cell is the issue number.
issue_number=$(awk -F'|' -v g=" $genus " '
    $3 == g { gsub(/[ \t]/, "", $2); print $2; exit }
' "$triage_path")

if [ -z "$issue_number" ]; then
    echo "Could not find $genus in $triage_path" >&2
    exit 1
fi

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
