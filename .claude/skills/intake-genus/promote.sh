#!/usr/bin/env bash
# Promote staged per-genus intake into the repository.
# Usage: bash .claude/skills/intake-genus/promote.sh <Genus>
set -euo pipefail

if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <Genus>" >&2
    exit 2
fi

genus="$1"
staging_dir="staging/intake/$genus"
final_yml="$staging_dir/final.yml"

if [ ! -f "$final_yml" ]; then
    echo "Missing $final_yml — run intake-apply first." >&2
    exit 1
fi

letter="${genus:0:1}"
target_dir="genera/$letter"
target_path="$target_dir/$genus.yml"

if [ -f "$target_path" ]; then
    echo "Refusing to overwrite existing $target_path." >&2
    echo "Either remove it (intentional re-intake / stub replacement) or" >&2
    echo "rename the staged genus." >&2
    exit 1
fi

mkdir -p "$target_dir"
cp "$final_yml" "$target_path"
echo "Promoted $final_yml → $target_path"
