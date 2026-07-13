# Dispute-Citation Audit — Data-Quality & Missing-Papers Report

Cross-slice summary of corpus problems surfaced while building the
paper-condensation ground-truth cache for the dispute/description
citation audit (#1968). Its purpose is to let corpus materials be
**gathered and repaired ahead of the per-clade audits**, so each
`/audit-disputes <Clade>` pass runs against complete sources.

**Scope of this report:** the seven slices assembled/condensed so far —
Ankylosauria (pilot, audited), plus the pre-build set Tyrannosauroidea,
Stegosauria, Ceratosauria, Ceratopsia, Ornithopoda, Sauropoda. Cache
state at generation: **500 condensations / 12,891 taxon positions**.

Two companion files hold the machine-actionable and corpus-side records:
- `reports/audit/reaudit-queue.yml` (this repo) — durable queue keyed by
  ref-id; a missing/repaired paper landing triggers re-audit of exactly
  the dependent loci.
- `corpus-paper-report.md` §1 (corpus repo) — the canonical per-paper
  corpus-quality log; source-quality items below are recorded there too.

---

## 1. Missing cited papers (coverage gaps) — highest priority

Papers **cited directly by a `dispute:` block** in the dataset but absent
from the corpus. Each blocks the semantic (Tier-1) check for the named
locus until fetched. 9 still missing (the fetched-and-condensed ones have been removed).

Fetch these first: they are load-bearing for a specific audit and several
are the *erecting/authority* paper for a contested taxon.

| Notes | Ref-id | Slice → locus | Year | DOI | Title (short) |
|---|---|---|---|---|---|
| | `blows2015a` | Ankylosauria → Horshamosaurus | 2015 | — | British Polacanthid Dinosaurs |
| UW? | `iori2021a` | Ceratosauria → Kurupi | 2021 | 10.1016/j.jsames.2021.103551 | New theropod, Late Cretaceous of Brazil |
| | `bonaparte1996a` | Ceratosauria → Ligabueino; Sauropoda → Rayososaurus | 1996 | — | Cretaceous tetrapods of Argentina |
| UW? | `galton1980a` | Ornithopoda → Callovosaurus | 1980 | 10.1127/njgpa/160/1980/73 | European Jurassic hypsilophodontid/camptosaurid ornithopods |
| | `riabinin1925a` | Ornithopoda → Mandschurosaurus | 1925 | — | Mounted skeleton of *Trachodon amurense* |
| | `lapparent1955a` | Sauropoda → Rhoetosaurus | 1955 | — | Dinosauriens (Traité de Paléontologie V) |
| | `läng2008a` | Sauropoda → Lapparentosaurus | 2008 | — | Les Cétiosaures et les sauropodes du Jurassique moyen |
| | `rich1999a` | Sauropoda → Tehuelchesaurus | 1999 | — | A new sauropod from Chubut province, Argentina |
| Not required, name misprint reference only | `yadagiri1979a` | Sauropoda → Rhoetosaurus | 1979 | — | Sauropod from the Kota Formation, India |
| | `zhao1986a` | Stegosauria → Monkonosaurus | 1986 | — | [Reptiles] (Cretaceous of the Ordos Basin) |

**Notes on priority within this list:**
- The four Ankylosauria entries are already tracked in `reaudit-queue.yml`
  (surfaced by the completed pilot).
- `galton1980a` bears on **Callovosaurus** — recent enough to have
  retrievable full text (DOI shown).
- The pre-DOI historical erecting papers still outstanding (Riabinin
  1925, Lapparent 1955, Zhao 1986) are the hardest to source but are the
  nomenclatural authorities for their loci; batch via BHL / archive scans
  where possible. (Riabinin 1945 and Hennig 1925 have since been fetched
  and condensed; Geoffroy Saint-Hilaire 1831 is tracked under the
  Ankylosauria re-audit queue for Cryptosaurus.)
- `zheng2021b` (Sinankylosaurus, Ankylosauria) is a distinct case tracked
  in `reaudit-queue.yml` as `fetch-pending`: the dataset currently cites
  the *wrong* Zheng 2021 paper, and the correct one must be fetched before
  the re-point. Not a coverage gap in the table above (nothing cites the
  correct key yet).
- `norman2014b` (Protohadros, Hadrosauroidea) — RESOLVED. Protohadros had
  cited `norman2014a` (the *Hypselospinus fittoni* osteology paper) for a
  placement it does not make; the intended source was the other Norman
  2014, "Iguanodonts from the Wealden of England..." (in *Hadrosaurs*,
  Eberth & Evans eds.). It has since been fetched, condensed, and verified
  (Protohadros scored outside Hadrosauromorpha, surangular foramen present)
  and re-pointed to `norman2014b`.

---

## 2. Corpus source-quality issues (paper is present but unusable/wrong)

Papers whose corpus markdown exists but is truncated, mis-filed, or a
bundled multi-paper scan. These are logged per-paper in
`corpus-paper-report.md` §1 (canonical); summarized here by failure mode
and bucket. Each affected condensation is flagged `extraction_scope:
partial` (or annotated in `taxa_treated[].notes`) and will regenerate
automatically on re-fetch (its `source_sha256` changes).

### 2a. Truncated / fragmentary markdown → re-fetch or re-convert
| Notes | Ref-id | Bucket | Problem |
|---|---|---|---|

### 2b. Wrong paper / wrong edition filed under the key → re-file
| Notes | Ref-id | Bucket | Problem |
|---|---|---|---|
| Resolved | `tumanova1987a` | Ankylosauria | Was: markdown was the **2000** *Age of Dinosaurs in Russia and Mongolia* chapter, not the **1987** *Armored Dinosaurs of Mongolia* monograph the citation points to. Now fixed — the wrong chapter was re-filed under `tumanova2018a` (condensed) and the true 1987 monograph fetched under this key and re-condensed (clears the Maleevus Tier-0 class-1 flag). |

### 2c. Bundled multi-paper scans → split & re-key
| Notes | Ref-id | Bucket | Problem |
|---|---|---|---|
|   | `wiman1929` | (Euhelopus / Tanius) | Shared key; markdown covers *Euhelopus* correctly but the *Tanius* portion of the same volume is absent. |

Most other bundled scans encountered (shilin1982a, leidy1856a/1856c, cope1869a/1877d, molnar1996a, nopcsa1903a, sereno2009a, etc.) were **scoped correctly** by the extraction agents and need no action.

---

## 3. Citation-snowball leads (secondary, discovery-oriented)

Papers the condensed corpus material itself flags as worth pulling
(`references_worth_pulling`) that do **not** appear to be in the corpus —
the "unknown-unknowns" a Wikipedia-guided search would miss. Matching is
heuristic (first-author surname + year), so a few may already exist under
a variant key; verify before fetching. 119 distinct leads total; the
most-actionable are below.

### 3a. First-wave DOI leads — all resolved

All fetched and condensed. The last, Scannella & Horner 2011 on *Nedoceratops*,
is in the corpus under **`scannella2011a`** (double "n" — the earlier
`scanella2011a` here was a typo) and has been condensed.

### 3b. Second-wave DOI leads — all resolved

All six (Gauthier 1986 `gauthier1986a`, Holtz 1994 `holtz1994a`, Forster 1997
`forster1997a` — an SVP abstract only, Norman 1980 `norman1980a`, Dodson 1975
`dodson1975a`, Casanovas et al. 1999 `casanovas1999a`) have been fetched and
condensed. (Curry Rogers & Forster 2001, the most-flagged at 3×, was already in
corpus.)

### 3c. Third-wave singletons from the just-condensed batch

Surfaced by the 11 papers condensed in the third wave (the two §1 authority
papers, the six §3b leads, plus `riabinin1945a`, `carrano2012a`). All are 1×
(below the earlier 2× actionable bar) so they are enrichment, not blockers. The
Ankylosauria-relevant ones worth pulling when that slice's fixes are worked:
Coombs & Maryańska 1990 (Ankylosauria, *The Dinosauria* 1st ed.), Maryańska 1977
(Ankylosauridae from Mongolia), Tumanova 1977 (*Tarchia gigantea* redescription),
Maleev 1956 (armoured dinosaurs of the Upper Cretaceous of Mongolia), Blows 1987
(*Polacanthus foxii*), Pereda-Suberbiola 1994 (*Polacanthus*), Nopcsa 1918
(Thyreophora scheme). The remaining singletons (hadrosaur/lambeosaurine classics
behind Dodson 1975 and Casanovas 1999; theropod-systematics refs behind Gauthier,
Holtz, Carrano) plus the first-wave long tail stay lower priority — consult the
condensations' `references_worth_pulling` fields when auditing a specific locus.

---

## 4. Workflow

1. Fetch §1 papers → re-run the affected `/audit-disputes <Clade>` slice
   (or, for already-audited Ankylosauria, resolve the `reaudit-queue.yml`
   entries).
2. Repair §2 corpus sources (re-fetch / re-convert / split-and-re-key);
   the mislabeled condensations self-heal on the next condense (hash
   change). Log resolutions in `corpus-paper-report.md`.
3. Treat §3 as optional enrichment — pull a lead when its locus comes up
   in an audit and the existing sources leave a claim unverifiable.

Regenerate this report after each new slice is assembled/condensed.
