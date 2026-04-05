#!/usr/bin/env bash
# Promote staged batch-import files into the repository.
# Usage: bash .claude/skills/batch-import/promote.sh
set -euo pipefail

staging="staging"

# Genus files
for file in "$staging"/genera/*/*.yml; do
    [ -f "$file" ] || continue
    letter=$(basename "$(dirname "$file")")
    mkdir -p "genera/$letter"
    cp "$file" "genera/$letter/"
done
echo "Promoted genus files."

# Clade files (skip existing)
for file in "$staging"/clades/*.yml; do
    [ -f "$file" ] || continue
    name=$(basename "$file")
    if [ -e "clades/$name" ]; then
        echo "  Skip (exists): $name"
    else
        cp "$file" "clades/$name"
    fi
done
echo "Promoted clade files."

# Tree file (always overwrite)
if [ -f "$staging/tree.yml" ]; then
    cp "$staging/tree.yml" tree.yml
    echo "Promoted tree.yml."
fi
