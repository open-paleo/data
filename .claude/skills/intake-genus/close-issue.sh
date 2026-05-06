#!/usr/bin/env bash
# Close the GitHub Intake issue for a promoted genus.
#
# Steps:
#   1. Find the issue number from reports/intake-triage.md
#   2. Add a completion comment referencing the commit SHA
#   3. Remove the "Intake: Disputed" / "Intake: Requires Manual
#      Intervention" sub-label
#   4. Mark the triage row as [done] <SHA>
#   5. Close the issue with reason "completed"
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

# 1. Add completion comment.
gh issue comment "$issue_number" --body \
"Closing — \`${genus}\` promoted in ${commit_sha} via the per-genus intake pipeline (bootstrap → paper extraction → apply)."

# 2. Strip the Intake sub-label, if any.
labels=$(gh issue view "$issue_number" --json labels --jq '.labels[].name')

while IFS= read -r label; do
    case "$label" in
        "Intake: Disputed"|"Intake: Requires Manual Intervention")
            echo "Removing label: $label"
            gh issue edit "$issue_number" --remove-label "$label"
            ;;
    esac
done <<< "$labels"

# 3. Mark the triage row as [done] <SHA>. Append after the label cell
#    when not already marked.
sed_inplace() {
    if [[ "$(uname)" == "Darwin" ]]; then
        sed -i "" "$@"
    else
        sed -i "$@"
    fi
}

if ! grep -q "| $issue_number | $genus |.*\[done" "$triage_path"; then
    sed_inplace -E "s|^(\| ${issue_number} \| ${genus} \| [^|]+\|)([^|]+)\|\$|\1\2[done ${commit_sha}] \||" "$triage_path"
fi

# 4. Close the issue.
gh issue close "$issue_number" --reason completed
