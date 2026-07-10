# Dispute-Citation Audit — Data-Quality & Missing-Papers Report

Cross-slice summary of corpus problems surfaced while building the
paper-condensation ground-truth cache for the dispute/description
citation audit (#1968). Its purpose is to let corpus materials be
**gathered and repaired ahead of the per-clade audits**, so each
`/audit-disputes <Clade>` pass runs against complete sources.

**Scope of this report:** the seven slices assembled/condensed so far —
Ankylosauria (pilot, audited), plus the pre-build set Tyrannosauroidea,
Stegosauria, Ceratosauria, Ceratopsia, Ornithopoda, Sauropoda. Cache
state at generation: **461 condensations / 11,556 taxon positions**.

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
locus until fetched. 28 distinct papers across the seven slices.

Fetch these first: they are load-bearing for a specific audit and several
are the *erecting/authority* paper for a contested taxon.

| Ref-id | Slice → locus | Year | DOI | Title (short) |
|---|---|---|---|---|
| `blows2015a` | Ankylosauria → Horshamosaurus | 2015 | — | British Polacanthid Dinosaurs |
| `geoffroysaint-hilaire1831a` | Ankylosauria → Cryptosaurus | 1831 | — | Recherches sur de grands sauriens fossiles |
| `mantell1833b` | Ankylosauria → Polacanthoides | 1833 | — | Observations on the remains of the Iguanodon |
| `pereda-suberbiola1999a` | Ankylosauria → Acanthopholis | 1999 | — | Systematic review of ankylosaurian remains, Albian-Cenomanian of England |
| `bertozzo2025b` | Ceratopsia → Ajkaceratops | 2025 | 10.1371/journal.pone.0312519 | Skull of *Jeholosaurus shangyuanensis* |
| `hatcher1907a` | Ceratopsia → Polyonax | 1907 | — | The Ceratopsia (Hatcher, Marsh & Lull) |
| `nessov1989a` | Ceratopsia → Asiaceratops, Turanoceratops | 1989 | — | Mesozoic ceratopsian dinosaurs and crocodiles of central Asia |
| `iori2021a` | Ceratosauria → Kurupi | 2021 | 10.1016/j.jsames.2021.103551 | New theropod, Late Cretaceous of Brazil |
| `bonaparte1996a` | Ceratosauria → Ligabueino; Sauropoda → Rayososaurus | 1996 | — | Cretaceous tetrapods of Argentina |
| `abel1919a` | Ornithopoda → Orthomerus | 1919 | — | Die Stämme der Wirbeltiere |
| `galton1980a` | Ornithopoda → Callovosaurus | 1980 | 10.1127/njgpa/160/1980/73 | European Jurassic hypsilophodontid/camptosaurid ornithopods |
| `head2001a` | Ornithopoda → Eolambia | 2001 | 10.1671/0272-4634(2001)021[0392:AROTPP]2.0.CO;2 | Phylogenetic position of *Eolambia caroljonesa* |
| `mantell1834a` | Ornithopoda → Mantellisaurus | 1834 | — | Discovery of the bones of the Iguanodon in Kentish Rag |
| `riabinin1925a` | Ornithopoda → Mandschurosaurus | 1925 | — | Mounted skeleton of *Trachodon amurense* |
| `riabinin1945a` | Ornithopoda → Riabininohadros | 1945 | — | Dinosaur remains in the Upper Cretaceous of Crimea |
| `ruiz-omeñaca2007a` | Ornithopoda → Callovosaurus | 2007 | — | *Callovosaurus leedsi*, the earliest dryosaurid |
| `weishampel1993a` | Ornithopoda → Telmatosaurus | 1993 | — | *Telmatosaurus transsylvanicus*, most basal hadrosaurid |
| `bakker1998a` | Sauropoda → Brontosaurus | 1998 | — | Dinosaur mid-life crisis: Jurassic-Cretaceous transition |
| `cabrera1947a` | Sauropoda → Amygdalodon | 1947 | — | Un saurópodo nuevo del Jurásico de Patagonia |
| `lapparent1955a` | Sauropoda → Rhoetosaurus | 1955 | — | Dinosauriens (Traité de Paléontologie V) |
| `läng2008a` | Sauropoda → Lapparentosaurus | 2008 | — | Les Cétiosaures et les sauropodes du Jurassique moyen |
| `mannion2011b` | Sauropoda → Mongolosaurus | 2011 | 10.1080/14772019.2010.527379 | Reassessment of *Mongolosaurus haplodon* |
| `norell1995a` | Sauropoda → Brontosaurus | 1995 | — | Discovering Dinosaurs in the AMNH |
| `rich1999a` | Sauropoda → Tehuelchesaurus | 1999 | — | A new sauropod from Chubut province, Argentina |
| `yadagiri1979a` | Sauropoda → Rhoetosaurus | 1979 | — | Sauropod from the Kota Formation, India |
| `hennig1915b` | Stegosauria → Lexovisaurus | 1915 | — | Stegosauria (Fossilium Catalogus) |
| `hennig1925a` | Stegosauria → Kentrosaurus | 1925 | — | *Kentrurosaurus aethiopicus*, Tendaguru stegosaurs |
| `zhao1986a` | Stegosauria → Monkonosaurus | 1986 | — | [Reptiles] (Cretaceous of the Ordos Basin) |

**Notes on priority within this list:**
- The four Ankylosauria entries are already tracked in `reaudit-queue.yml`
  (surfaced by the completed pilot).
- `mannion2011b` (Mongolosaurus reassessment) is the direct authority for
  a placement re-evaluated in the #1962 re-eval — high value, has a DOI.
- `galton1980a` + `ruiz-omeñaca2007a` both bear on **Callovosaurus**;
  `head2001a` on **Eolambia**; `weishampel1993a` on **Telmatosaurus** —
  all recent enough to have retrievable full text (DOIs where shown).
- The pre-DOI historical erecting papers (Mantell 1833/1834, Riabinin
  1925/1945, Hennig 1915/1925, Geoffroy Saint-Hilaire 1831, Cabrera 1947,
  Lapparent 1955, Abel 1919, Zhao 1986) are the hardest to source but are
  the nomenclatural authorities for their loci; batch via BHL / archive
  scans where possible.
- `zheng2021b` (Sinankylosaurus, Ankylosauria) is a distinct case tracked
  in `reaudit-queue.yml` as `fetch-pending`: the dataset currently cites
  the *wrong* Zheng 2021 paper, and the correct one must be fetched before
  the re-point. Not a coverage gap in the table above (nothing cites the
  correct key yet).

---

## 2. Corpus source-quality issues (paper is present but unusable/wrong)

Papers whose corpus markdown exists but is truncated, mis-filed, or a
bundled multi-paper scan. These are logged per-paper in
`corpus-paper-report.md` §1 (canonical); summarized here by failure mode
and bucket. Each affected condensation is flagged `extraction_scope:
partial` (or annotated in `taxa_treated[].notes`) and will regenerate
automatically on re-fetch (its `source_sha256` changes).

### 2a. Truncated / fragmentary markdown → re-fetch or re-convert
| Ref-id | Bucket | Problem |
|---|---|---|
| `upchurch2004a` | Sauropoda | **Priority.** Only a ~7.8 KB / 18-paragraph fragment of the ~64-page *Sauropoda* chapter of *The Dinosauria* 2nd ed. (Ornithopsis→Cedarosaurus only). A full **PDF exists at `pdfs/upchurch2004a.pdf`** — re-convert to recover Titanosauria/Diplodocoidea/basal sauropods + phylogeny. Very widely cited. |
| `nopcsa1928a` | Ankylosauria | Cuts off ~line 1103 mid-*Scolosaurus*, before *Polacanthoides ponderosus*. (Data is correct; flag was a truncation artifact.) |
| `cope1872a` | Sauropoda | Bundled Proc. A.P.S. scan — a fish description (*Amyzon*) precedes and unrelated content follows; opens mid-sentence. |
| `romer1956a` | Sauropoda | Only a ~5-line mid-book fragment of *Osteology of the Reptiles* (partial sauropod family list). |
| `langston1960a` | Ornithopoda | Opens mid-sentence, cuts off mid-word in the *Lophorhothon* description. |
| `prieto-márquez2021a` | Ornithopoda | Abstract only — no Systematic Palaeontology / Results. |
| `seeley1888a` | (Ornithischia authority) | "Classification of the Dinosauria" abstract, truncated mid-sentence. |
| `horner2004a` | Ornithopoda | *Dinosauria*-2e Hadrosauridae chapter fragment, no phylogeny/diagnosis section. |
| `brett-surman1989a` | Ornithopoda | Mid-monograph excerpt starting at genus #27, no front matter. |
| `upchurch1995a` | Sauropoda | *Minor.* Complete except two `[FILTER-BLOCKED QUARTER]` redaction placeholders in the Conclusion — general prose only, no taxon placements lost. |

### 2b. Wrong paper / wrong edition filed under the key → re-file
| Ref-id | Bucket | Problem |
|---|---|---|
| `tumanova1987a` | Ankylosauria | Markdown is Tumanova's **2000** *Age of Dinosaurs in Russia and Mongolia* chapter, not the **1987** *Pantsirnyye dinozavry Mongolii* monograph the citation points to. Re-file the 2000 chapter under its own key; fetch the true 1987 monograph. |
| `rauhut2003a` | Tyrannosauroidea/Ceratosauria | Markdown is Rauhut 2003 *"A tyrannosauroid… from the Upper Jurassic of Portugal"* (*Aviatyrannis*), not the 2003 basal-theropod monograph. Verify which the citing genera intend; split keys if the monograph is meant. |

### 2c. Bundled multi-paper scans → split & re-key
| Ref-id | Bucket | Problem |
|---|---|---|
| `riabinin1931a` | Sauropoda/others (Cionodon, Embasaurus) | Holds TWO 1931 Riabinin articles. `Embasaurus`'s citation is correct; but `Cionodon` cites this id while its real erecting article is the appended, un-keyed "Amu-Darya" piece. Split & re-point Cionodon. |
| `wiman1929` | (Euhelopus / Tanius) | Shared key; markdown covers *Euhelopus* correctly but the *Tanius* portion of the same volume is absent. |

Most other bundled scans encountered (shilin1982a, leidy1856a/1856c, cope1869a/1877d, molnar1996a, nopcsa1903a, sereno2009a, etc.) were **scoped correctly** by the extraction agents and need no action.

---

## 3. Citation-snowball leads (secondary, discovery-oriented)

Papers the condensed corpus material itself flags as worth pulling
(`references_worth_pulling`) that do **not** appear to be in the corpus —
the "unknown-unknowns" a Wikipedia-guided search would miss. Matching is
heuristic (first-author surname + year), so a few may already exist under
a variant key; verify before fetching. 119 distinct leads total; the
most-actionable are below.

### 3a. With a DOI (quickest to fetch)
| Times flagged | Ref | DOI | Note |
|---|---|---|---|
| 2× | Arbour & Currie (2016) | 10.1080/14772019.2015.1059985 | Ankylosaurid systematics/phylogeny |
| 2× | Thompson et al. (2012) | 10.1080/14772019.2011.569091 | Ankylosaurian phylogeny |
| 2× | Torcida Fernández-Baldor et al. (2011) | 10.4202/app.2010.0003 | *Demandasaurus* (rebbachisaurid) |
| 1× | Bellardini et al. (2024) | 10.1080/08912963.2023.2268638 | Rebbachisaurid hind-limb anatomy |
| 1× | Sereno (1997) | 10.1146/annurev.earth.25.1.435 | Origin & evolution of dinosaurs (review) |
| 1× | Han et al. (2017) | 10.1080/14772019.2017.1369185 | *Yinlong* postcranial / ceratopsian phylogeny |
| 1× | Scannella & Horner (2011) | 10.1371/journal.pone.0028705 | *Nedoceratops* transitional morphology |
| 1× | Costa Franco-Rosas et al. (2004) | 10.4072/rbp.2004.3.04 | New titanosaur material, Brazil |
| 1× | D'Emic & Wilson (2011) | 10.4202/app.2009.0149 | Holotype of *Neuquensaurus australis* |

### 3b. No DOI, flagged repeatedly (higher-value historical/review works)
| Times | Ref | Note |
|---|---|---|
| 5× | Prieto-Márquez (2010) | Global phylogeny of Hadrosauridae — the base matrix for many Ornithopoda disputes; **fetch ahead of the Ornithopoda audit** |
| 2× | Norman (1986) | Anatomy of *Iguanodon atherfieldensis* |
| 2× | Curry Rogers (2005) | *Titanosauria: A Phylogenetic Overview* (review chapter) |
| 2× | Curry Rogers & Forster (2004) | Skull of *Rapetosaurus krausei* |
| 2× | Carballido et al. (2011) | Phylogenetic analysis incl. *Janenschia*/*Tendaguria* |
| 2× | Carr (2020) | *Tyrannosaurus rex* ontogeny/histology |

The remaining ~104 leads were each flagged once (long tail; consult the
condensations' `references_worth_pulling` fields when auditing a specific
locus).

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
