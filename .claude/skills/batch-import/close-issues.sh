#!/usr/bin/env bash
# Close intake issues listed in staging/report.json.
# Usage: bash .claude/skills/batch-import/close-issues.sh [--skip genus1,genus2,...]
#
# The --skip flag accepts a comma-separated list of genus names whose
# issues should NOT be closed (e.g. genera the user chose to omit).
set -euo pipefail

report="staging/report.json"
skipGenera=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --skip) skipGenera="$2"; shift 2 ;;
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
    const kept = report.genera.filter((genus) => !skip.has(genus.name.toLowerCase()));
    console.log(kept.map((genus) => genus.issueNumber).join(' '));
")

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
