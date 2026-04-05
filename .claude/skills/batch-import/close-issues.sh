#!/usr/bin/env bash
# Close intake issues listed in staging/report.json.
# Usage: bash .claude/skills/batch-import/close-issues.sh
set -euo pipefail

report="staging/report.json"

if [ ! -f "$report" ]; then
    echo "Error: $report not found." >&2
    exit 1
fi

issues=$(node -e "
    const report = JSON.parse(require('fs').readFileSync('$report', 'utf8'));
    console.log(report.genera.map((genus) => genus.issueNumber).join(' '));
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
