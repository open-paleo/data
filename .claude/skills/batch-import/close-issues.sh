#!/usr/bin/env bash
# Close intake issues listed in staging/report.json.
# Usage: bash .claude/skills/batch-import/close-issues.sh [--skip genus1,genus2,...] [--disputed genus3,genus4,...]
#
# The --skip flag accepts a comma-separated list of genus names whose
# issues should NOT be closed (e.g. genera the user chose to omit).
#
# The --disputed flag accepts a comma-separated list of genus names whose
# issues should be labeled "Intake: Disputed" instead of closed.
set -euo pipefail

report="staging/report.json"
skipGenera=""
disputedGenera=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --skip) skipGenera="$2"; shift 2 ;;
        --disputed) disputedGenera="$2"; shift 2 ;;
        *) echo "Unknown option: $1" >&2; exit 1 ;;
    esac
done

if [ ! -f "$report" ]; then
    echo "Error: $report not found." >&2
    exit 1
fi

issues=$(node -e "
    const report = JSON.parse(require('fs').readFileSync('$report', 'utf8'));
    const skip = new Set('$skipGenera'.split(',').filter(Boolean).map((name) => name.trim().toLowerCase()));
    const disputed = new Set('$disputedGenera'.split(',').filter(Boolean).map((name) => name.trim().toLowerCase()));
    const kept = report.genera.filter((genus) => !skip.has(genus.name.toLowerCase()) && !disputed.has(genus.name.toLowerCase()));
    console.log(kept.map((genus) => genus.issueNumber).join(' '));
")

disputedIssues=$(node -e "
    const report = JSON.parse(require('fs').readFileSync('$report', 'utf8'));
    const disputed = new Set('$disputedGenera'.split(',').filter(Boolean).map((name) => name.trim().toLowerCase()));
    const matched = report.genera.filter((genus) => disputed.has(genus.name.toLowerCase()));
    console.log(matched.map((genus) => genus.issueNumber).join(' '));
")

# Label disputed issues
disputedCount=0
if [ -n "$disputedIssues" ]; then
    disputedTotal=$(echo "$disputedIssues" | wc -w | tr -d ' ')
    echo "Labeling $disputedTotal disputed issues..."
    for number in $disputedIssues; do
        gh issue edit "$number" --repo open-paleo/data --add-label "Intake: Disputed" 2>&1
        disputedCount=$((disputedCount + 1))
    done
    echo "Labeled $disputedCount issues as disputed."
    echo ""
fi

closed=0
total=$(echo "$issues" | wc -w | tr -d ' ')

for number in $issues; do
    gh issue close "$number" --repo open-paleo/data --comment "Added via batch import." 2>&1
    closed=$((closed + 1))

    if [ $((closed % 10)) -eq 0 ]; then
        echo "Closed $closed/$total issues so far."
    fi
done

echo "Done. Closed $closed issues."

# Spot-check a few
echo ""
echo "Verifying sample..."
sample=$(echo "$issues" | tr ' ' '\n' | head -3)
for number in $sample; do
    state=$(gh issue view "$number" --repo open-paleo/data --json state --jq '.state')
    echo "  #$number: $state"
done

# Clean up staging directory
echo ""
echo "Cleaning up staging/..."
rm -rf staging/
echo "staging/ deleted."
