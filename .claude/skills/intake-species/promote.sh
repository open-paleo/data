#!/usr/bin/env bash
# Promote staged per-species intake into the repository: replace the
# live genus YAML with the proposed merged version.
# Usage: bash .claude/skills/intake-species/promote.sh <Genus> <species>
set -euo pipefail

if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <Genus> <species>" >&2
    exit 2
fi

genus="$1"
species="$2"
staging_dir="staging/intake-species/${genus}-${species}"
proposed_yml="$staging_dir/genus-proposed.yml"

if [ ! -f "$proposed_yml" ]; then
    echo "Missing $proposed_yml — run intake-species-apply first." >&2
    exit 1
fi

letter="${genus:0:1}"
target_path="genera/${letter}/${genus}.yml"

if [ ! -f "$target_path" ]; then
    # Try lower-case directory (case-insensitive filesystems).
    letter_lower=$(printf '%s' "$letter" | tr '[:upper:]' '[:lower:]')
    target_path="genera/${letter_lower}/${genus}.yml"
fi

if [ ! -f "$target_path" ]; then
    echo "No existing genus YAML found at genera/${letter}/${genus}.yml." >&2
    echo "Use intake-genus first if this is a new genus." >&2
    exit 1
fi

cp "$proposed_yml" "$target_path"
echo "Promoted $proposed_yml → $target_path"
