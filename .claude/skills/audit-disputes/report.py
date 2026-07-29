#!/usr/bin/env python3
"""Assemble the findings report for one slice from the manifest + Tier-0 + Tier-1
outputs, and update the durable re-audit queue.

The report is a thin, regenerable projection (gitignored). The re-audit queue is
DURABLE state (committed): it records, per not-in-corpus / incomplete-source
paper, which loci could not be fully verified — so that when the paper lands in
the corpus (or a truncated markdown is repaired), exactly those genera/clades can
be re-audited rather than re-running the whole slice.

Usage:
    python3 report.py <slice-work-dir>
        # expects <dir>/manifest.json, <dir>/tier0.json, <dir>/tier1/*.json
        # writes  reports/audit/<slice>.md  and updates reports/audit/reaudit-queue.yml
"""

import argparse
import glob
import json
import os

import yaml

from _paths import audit_dir, reaudit_queue_path, condensed_dir

SEVERITY_ORDER = {"high": 0, "medium": 1, "low": 2}


def load_tier1(work_dir):
    """Return (loci_results, findings) from the per-locus Tier-1 JSON files."""
    results, findings = [], []
    for path in sorted(glob.glob(os.path.join(work_dir, "tier1", "*.json"))):
        result = json.load(open(path))
        results.append(result)
        for finding in result.get("findings", []):
            finding = dict(finding)
            finding["_locus"] = result["locus"]
            finding["_kind"] = result["kind"]
            finding["_file"] = result.get("file")
            findings.append(finding)
    return results, findings


def update_reaudit_queue(slice_root, tier0, tier1_results, run_date):
    """Merge this run's unverifiable references into the durable queue, keyed by
    ref-id, accumulating the loci that depend on each. Append-only per ref-id;
    an entry is meant to be removed by hand once its paper lands and the loci
    re-audit clean. Two reasons: not-in-corpus (paper missing) and
    source-incomplete (markdown present but truncated/partial)."""
    path = reaudit_queue_path()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    queue = {}
    if os.path.exists(path):
        queue = yaml.safe_load(open(path)) or {}
    pending = queue.setdefault("pending", {})

    def add(ref_id, reason, loci):
        entry = pending.get(ref_id)
        if entry is None:
            entry = {"reason": reason, "first_seen": run_date, "slices": [], "loci": []}
            pending[ref_id] = entry
        entry["reason"] = reason
        entry["last_seen"] = run_date
        if slice_root not in entry["slices"]:
            entry["slices"].append(slice_root)
        for locus in loci:
            if locus not in entry["loci"]:
                entry["loci"].append(locus)

    # not-in-corpus references (Tier-0 class 4, medium)
    for finding in tier0:
        if finding.get("problem_class") == 4 and finding.get("severity") == "medium":
            add(finding["ref_id"], "not-in-corpus", finding.get("cited_by", []))

    # source-incomplete: any Tier-1 finding whose evidence flags a truncated /
    # partial source is a re-audit-when-repaired case, not a settled error.
    for result in tier1_results:
        for finding in result.get("findings", []):
            evidence = (finding.get("evidence") or "").lower()
            if "truncat" in evidence or "incomplete" in evidence or "partial source" in evidence:
                add(finding.get("ref_id"), "source-incomplete", [result["locus"]])

    yaml.safe_dump(queue, open(path, "w"), allow_unicode=True, sort_keys=True, default_flow_style=False)
    return path, pending


def render(slice_root, manifest, tier0, tier1_results, findings, queue_pending):
    papers = manifest["papers"]
    condensed = [p for p in papers if p["in_corpus"] and p["classification"] != "reference-work"]
    ref_works = [p for p in papers if p["classification"] == "reference-work"]
    not_in_corpus = [p for p in papers if not p["in_corpus"] and p["classification"] != "reference-work"]
    total_taxa = sum(len(json.load(open(os.path.join(condensed_dir(), f"{p['ref_id']}.json"))).get("taxa_treated", []))
                     for p in condensed if os.path.exists(os.path.join(condensed_dir(), f"{p['ref_id']}.json")))
    total_claims = sum(r.get("claims_checked", 0) for r in tier1_results)
    clean = sum(1 for r in tier1_results if not r.get("findings"))
    findings.sort(key=lambda f: SEVERITY_ORDER.get(f.get("severity", "low"), 3))

    lines = []
    lines.append(f"# Dispute/description citation audit — {slice_root}")
    lines.append("")
    lines.append("Findings only — no dataset edits made. Every evidence line traces to a paper")
    lines.append("condensation (`$corpus/condensed/<ref_id>.json`), a firewall read of the primary")
    lines.append("paper. Fixes are a separate, human-gated step.")
    lines.append("")
    lines.append("## Coverage")
    lines.append("")
    lines.append("| | |")
    lines.append("|---|---|")
    lines.append(f"| Loci audited | {len(tier1_results)} |")
    lines.append(f"| Distinct papers cited | {len(papers)} |")
    lines.append(f"| Condensed (in-corpus primary) | {len(condensed)} — {total_taxa} taxon positions |")
    lines.append(f"| Reference-works (not condensed) | {len(ref_works)} — {', '.join(p['ref_id'] for p in ref_works) or '—'} |")
    lines.append(f"| Cited but not in corpus | {len(not_in_corpus)} — {', '.join(p['ref_id'] for p in not_in_corpus) or '—'} |")
    lines.append(f"| Load-bearing claims checked (Tier-1) | {total_claims} |")
    lines.append(f"| Loci clean | {clean} / {len(tier1_results)} |")
    lines.append(f"| Findings | {len(tier0) + len(findings)} ({len(tier0)} Tier-0 + {len(findings)} Tier-1) |")
    lines.append("")

    lines.append("## Tier-0 — bibliographic")
    lines.append("")
    if tier0:
        for finding in tier0:
            lines.append(f"- **[{finding['severity'].upper()}] class{finding['problem_class']} {finding['ref_id']}** "
                         f"(cited by {', '.join(finding.get('cited_by', []))}): {finding['detail']}")
    else:
        lines.append("_none_")
    lines.append("")

    lines.append("## Tier-1 — semantic (per load-bearing claim)")
    lines.append("")
    if findings:
        for finding in findings:
            lines.append(f"### [{finding.get('severity', '?').upper()}] {finding['_locus']} — "
                         f"{finding.get('verdict')} (class {finding.get('problem_class')})")
            lines.append(f"- file: `{finding.get('_file')}` · field: `{finding.get('field')}` · ref: `{finding.get('ref_id')}`")
            lines.append(f"- cited as: {finding.get('cited_as', '')}")
            lines.append(f"- evidence: {finding.get('evidence', '')}")
            lines.append("")
    else:
        lines.append("_no findings — all load-bearing claims consistent_")
        lines.append("")

    lines.append("## Re-audit queue (this slice's contributions)")
    lines.append("")
    lines.append("Durable backlog at `reports/audit/reaudit-queue.yml`. When one of these papers")
    lines.append("lands in the corpus (or a truncated source is repaired), re-audit its loci.")
    lines.append("")
    contributed = {rid: e for rid, e in queue_pending.items() if slice_root in e.get("slices", [])}
    if contributed:
        for ref_id, entry in sorted(contributed.items()):
            lines.append(f"- **{ref_id}** ({entry['reason']}) → {', '.join(entry['loci'])}")
    else:
        lines.append("_none_")
    lines.append("")
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Assemble the audit findings report + update the re-audit queue")
    parser.add_argument("work_dir", help="the per-slice work dir holding manifest.json, tier0.json, tier1/")
    parser.add_argument("--date", required=True, help="run date YYYY-MM-DD (pass explicitly; scripts have no clock)")
    args = parser.parse_args()

    manifest = json.load(open(os.path.join(args.work_dir, "manifest.json")))
    tier0 = json.load(open(os.path.join(args.work_dir, "tier0.json")))
    tier1_results, findings = load_tier1(args.work_dir)
    # A clades-only run shares its slice_root with the full-subtree run, so the
    # report and the queue's slice labels key off the WORK DIR name instead —
    # otherwise "Dinosauria --clades-only" would silently overwrite a later
    # full "Dinosauria" report and blur which pass covered which loci.
    slice_root = os.path.basename(os.path.normpath(args.work_dir)) or manifest["slice_root"]

    queue_path, pending = update_reaudit_queue(slice_root, tier0, tier1_results, args.date)
    report_text = render(slice_root, manifest, tier0, tier1_results, findings, pending)

    report_path = os.path.join(audit_dir(), f"{slice_root}.md")
    os.makedirs(os.path.dirname(report_path), exist_ok=True)
    open(report_path, "w").write(report_text)
    print(f"report -> {report_path}")
    print(f"re-audit queue -> {queue_path} ({len([e for e in pending.values() if slice_root in e.get('slices', [])])} entries for this slice)")
    print(f"findings: {len(tier0)} Tier-0 + {len(findings)} Tier-1")


if __name__ == "__main__":
    main()
