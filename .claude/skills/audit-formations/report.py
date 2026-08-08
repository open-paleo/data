#!/usr/bin/env python3
"""Assemble the findings report for the formations.yaml citation audit from the
manifest + Tier-0 + Tier-1 outputs, and update the durable re-audit queue.

The report is a thin, regenerable projection under scratch/ (gitignored). The
re-audit queue is DURABLE state (committed): it records which pointers could not
be verified and why, so that when a degraded source is repaired or a paper is
re-filed, exactly those entries can be re-audited rather than re-running the
whole registry.

Usage:
    python3 report.py --date YYYY-MM-DD
        # expects scratch/audit-formations/{manifest,tier0}.json and tier1/*.json
        # writes  scratch/audit-formations/report.md
        # updates this skill's reaudit-queue.yml
"""

import argparse
import glob
import json
import os
from collections import Counter, defaultdict

import yaml

from _paths import audit_dir, reaudit_queue_path

SEVERITY_ORDER = {"high": 0, "medium": 1, "low": 2}

# Tier-0 buckets that are candidates rather than verdicts, in report order, with
# the one-line reading each needs. Kept here so the report explains itself.
TIER0_SECTIONS = (
    (
        "quote_bibliography_only",
        "Quote present only in the cited paper's own reference list",
        "The paper is not asserting this; another work's title is. This is the "
        "systematic defect #2069 was opened on.",
    ),
    (
        "quote_absent",
        "Quoted span not found in the paper",
        "Verify by hand before believing: scanned and pre-1990 sources garble "
        "text, and a failed exact match on one proves nothing.",
    ),
    (
        "unit_absent",
        "Unit never named outside the reference list",
        "Fires correctly on notes that SAY the paper names no such unit — read "
        "the note before calling it a finding.",
    ),
    (
        "title",
        "Reference-store title does not match the paper's title block",
        "Usually an artifact of a translated title, a running head or a "
        "supplement excerpt. Confirm it is a different publication.",
    ),
)


def load_tier1(work_dir):
    """Read the per-entry Tier-1 JSON files.

    @param {str} work_dir - the audit working directory
    @returns {tuple} (results, findings) with each finding tagged by unit
    """
    results, findings = [], []
    for path in sorted(glob.glob(os.path.join(work_dir, "tier1", "*.json"))):
        with open(path) as handle:
            result = json.load(handle)
        results.append(result)
        for finding in result.get("findings", []):
            tagged = dict(finding)
            tagged["unit"] = result["unit"]
            findings.append(tagged)
    return results, findings


def update_reaudit_queue(results, run_date):
    """Merge this run's unverifiable pointers into the durable queue.

    Keyed by ref-id, accumulating the units that depend on each. An entry is
    removed by hand once its source is repaired AND its units re-audit clean; a
    ref-id under the top-level `dismissed` map is adjudicated and is never
    re-added, however many times a run re-detects it.

    @param {list[dict]} results - the per-entry Tier-1 results
    @param {str} run_date - the run date, stamped into the queue
    @returns {int} the number of pending entries after the merge
    """
    path = reaudit_queue_path()
    queue = {}
    if os.path.exists(path):
        with open(path) as handle:
            queue = yaml.safe_load(handle) or {}
    pending = queue.setdefault("pending", {})
    dismissed = queue.get("dismissed") or {}

    for result in results:
        for pointer in result.get("unverifiable_pointers", []):
            ref_id = pointer["ref_id"]
            if ref_id in dismissed:
                continue
            entry = pending.get(ref_id)
            if entry is None:
                entry = {"reason": pointer["reason"], "first_seen": run_date, "units": []}
                pending[ref_id] = entry
            entry["reason"] = pointer["reason"]
            entry["last_seen"] = run_date
            if result["unit"] not in entry["units"]:
                entry["units"].append(result["unit"])

    queue["pending"] = pending
    if dismissed:
        queue["dismissed"] = dismissed
    with open(path, "w") as handle:
        handle.write(
            "# Durable re-audit backlog for the formations.yaml citation audit "
            "(#2069).\n"
            "# `pending` entries are live: remove one by hand once its source is\n"
            "# repaired AND its units re-audit clean. `dismissed` entries are\n"
            "# adjudicated and are never re-added by a later run.\n"
        )
        yaml.safe_dump(queue, handle, allow_unicode=True, sort_keys=True)
    return len(pending)


def render_tier0(tier0, lines):
    """Append the Tier-0 sections to the report.

    @param {dict} tier0 - the parsed tier0.json
    @param {list[str]} lines - the report accumulator, mutated in place
    @returns {None}
    """
    lines.append("## Tier 0 — deterministic\n")
    counts = tier0.get("counts", {})
    lines.append("| check | flags |")
    lines.append("|---|---|")
    for key, title, _ in TIER0_SECTIONS:
        lines.append(f"| {title} | {counts.get(key, 0)} |")
    lines.append(f"| Ref-id with no corpus markdown | {counts.get('no_markdown', 0)} |")
    lines.append("")
    for key, title, reading in TIER0_SECTIONS:
        flags = tier0.get(key) or []
        if not flags:
            continue
        lines.append(f"### {title} ({len(flags)})\n")
        lines.append(f"*{reading}*\n")
        lines.append("| unit | pointer | detail |")
        lines.append("|---|---|---|")
        for flag in flags:
            detail = flag.get("quote") or flag.get("store_title") or ", ".join(flag.get("names", []))
            if flag.get("in_bibliography_only"):
                detail += " *(bibliography only)*"
            lines.append(f"| {flag['unit']} | `{flag['ref_id']}` | {detail} |")
        lines.append("")


def render_tier1(results, findings, lines):
    """Append the Tier-1 sections to the report, grouped by severity.

    @param {list[dict]} results - the per-entry Tier-1 results
    @param {list[dict]} findings - the flattened findings
    @param {list[str]} lines - the report accumulator, mutated in place
    @returns {None}
    """
    lines.append("## Tier 1 — semantic\n")
    if not results:
        lines.append("*Not run yet.*\n")
        return
    pointers = sum(result.get("pointers_checked", 0) for result in results)
    clean = sum(1 for result in results if not result.get("findings"))
    lines.append(
        f"{len(results)} entries audited, {pointers} pointers checked, "
        f"{clean} entries clean, {len(findings)} findings.\n"
    )
    by_verdict = Counter(finding.get("verdict") for finding in findings)
    if by_verdict:
        lines.append("| verdict | count |")
        lines.append("|---|---|")
        for verdict, count in by_verdict.most_common():
            lines.append(f"| `{verdict}` | {count} |")
        lines.append("")

    grouped = defaultdict(list)
    for finding in findings:
        grouped[finding.get("severity", "low")].append(finding)
    for severity in ("high", "medium", "low"):
        bucket = grouped.get(severity)
        if not bucket:
            continue
        lines.append(f"### {severity.capitalize()} ({len(bucket)})\n")
        for finding in sorted(bucket, key=lambda item: item["unit"]):
            lines.append(
                f"**{finding['unit']}** — `{finding.get('ref_id')}` · "
                f"`{finding.get('field')}` · `{finding.get('verdict')}`\n"
            )
            lines.append(f"- Entry says: {finding.get('cited_as')}")
            lines.append(f"- Paper says: {finding.get('evidence')}")
            if finding.get("suggested_source"):
                lines.append(f"- Candidate source: {finding['suggested_source']}")
            lines.append("")

    unverifiable = [
        (result["unit"], pointer)
        for result in results
        for pointer in result.get("unverifiable_pointers", [])
    ]
    if unverifiable:
        lines.append(f"### Unverifiable ({len(unverifiable)})\n")
        lines.append("| unit | pointer | reason |")
        lines.append("|---|---|---|")
        for unit, pointer in unverifiable:
            lines.append(f"| {unit} | `{pointer['ref_id']}` | {pointer['reason']} |")
        lines.append("")


def main():
    """Assemble the report and update the durable queue."""
    parser = argparse.ArgumentParser(description="Report for the formations citation audit")
    parser.add_argument("--date", required=True, help="run date, YYYY-MM-DD")
    parser.add_argument("--work-dir", default=audit_dir())
    args = parser.parse_args()

    with open(os.path.join(args.work_dir, "manifest.json")) as handle:
        manifest = json.load(handle)
    tier0 = {}
    tier0_path = os.path.join(args.work_dir, "tier0.json")
    if os.path.exists(tier0_path):
        with open(tier0_path) as handle:
            tier0 = json.load(handle)
    results, findings = load_tier1(args.work_dir)

    pointer_count = sum(len(locus["pointers"]) for locus in manifest["loci"])
    with_notes = sum(
        1 for locus in manifest["loci"] for pointer in locus["pointers"] if pointer["notes"]
    )
    condensed = sum(1 for paper in manifest["papers"] if paper["condensed"])

    lines = [
        f"# formations.yaml citation audit — {args.date} (#2069)",
        "",
        "Read-only. Findings go to a human gate; nothing here has been applied.",
        "",
        "## Coverage",
        "",
        "| | |",
        "|---|---|",
        f"| registry entries | {manifest['entries_total']} |",
        f"| entries carrying references | {len(manifest['loci'])} |",
        f"| pointers | {pointer_count} ({with_notes} carrying a notes claim) |",
        f"| distinct papers cited | {len(manifest['papers'])} |",
        f"| papers condensed | {condensed} |",
        f"| papers not in corpus | {sum(1 for paper in manifest['papers'] if not paper['in_corpus'])} |",
        "",
    ]
    misfiled = [paper for paper in manifest["papers"] if paper["filed_under"]]
    if misfiled:
        lines.append(
            "Filed in the corpus under a reverse-suffixed twin (a corpus filing "
            "lag, not a coverage gap): "
            + ", ".join(f"`{paper['ref_id']}` = `{paper['filed_under']}`" for paper in misfiled)
            + ".\n"
        )
    render_tier0(tier0, lines)
    render_tier1(results, findings, lines)

    pending = update_reaudit_queue(results, args.date)
    lines.append("## Re-audit queue\n")
    lines.append(f"{pending} pending entries in `.claude/skills/audit-formations/reaudit-queue.yml`.\n")

    out = os.path.join(args.work_dir, "report.md")
    with open(out, "w") as handle:
        handle.write("\n".join(lines))
    print(f"report -> {out}")
    print(f"tier-1 findings: {len(findings)}  |  re-audit queue pending: {pending}")


if __name__ == "__main__":
    main()
