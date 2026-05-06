# Paper-driven field backfill — iteration log

Append-only log of per-letter batch outcomes. New entries go at the top
of "## Entries" so the most recent letter is first. Captures: prompt
tweaks, classes of extraction error caught in review, ratio of
accepted vs. edited vs. rejected entries, and paper-level surprises
(missing diagnosis sections, bibliographies that aren't really
describing papers, etc.).

**Read this file only when explicitly investigating a past batch.**
Routine work should append a new entry to "## Entries" and stop —
no need to re-read prior entries. The stable workflow reference lives
in `paper-driven-backfill.md`.

## Entries

### Pending-resolution sweep #2 — 2026-05-05

- Cross-letter run targeting the second batch of 11 entries in
  `corpus-paper-report.md`'s "Pending Resolution Papers" subsection.
  Letters touched: A, C, D, P, S, V, W, X.
- Standard prompts dispatched for 10 genera (Antarctosaurus,
  Pawpawsaurus, Phuwiangvenator, Plateosaurus, Protohadros, Spinops,
  Vagaceratops, Vayuraptor, Wulagasaurus, Xixiasaurus). Two custom
  multi-paper prompts: Campylodoniscus (huene1929 — describes the
  material under the original *Campylodon ameghinoi* binomial; the
  haubold1961 renaming paper is not in the corpus) and Dromiceiomimus
  (russell1972 + parks1926 combined). One additional custom prompt
  for Plateosaurus engelhardti (meyer1837), but the resulting JSON
  was discarded — the apply script only writes to the type species
  (now *P. trossingensis*) and the existing engelhardti material
  (Moser 2003 lectotype) is more authoritative than Meyer's brief
  1837 note.
- Two genera came back as sentinels despite "Paper updated in corpus"
  notes: Pawpawsaurus (`lee1996.md` still 28 lines of Taylor & Francis
  publisher boilerplate) and Spinops (`farke2011.md` still 12 lines —
  abstract + affiliations only). Re-fetch needed for both. Moved back
  into §1 with corpus-still-abstract-only notes.
- 10 applied (Antarctosaurus, Campylodoniscus, Dromiceiomimus,
  Phuwiangvenator, Plateosaurus, Protohadros, Vagaceratops, Vayuraptor,
  Wulagasaurus, Xixiasaurus). 0 hand edits — workflow held the
  spellcheck-before-apply discipline. 6 vocab additions:
  knollenmergels, Sellosaurus, Varanid, Lamphu, Nong, Yuliangze.
  paleo-vocab 1184 → 1190, taxonomy 6497 → 6506.
- 0 validation errors.

### Pending-resolution sweep — 2026-05-05

- Cross-letter run targeting the 22 entries in
  `corpus-paper-report.md`'s "Pending Resolution Papers" subsection.
  Letters touched: A, C, E, H, L, M, N, O, P, R, S.
- Workflow change: cleared `material` and `diagnostic_features` on
  Anoplosaurus, Astrodon, Syngonosaurus before run so they would
  re-extract against the OCR-improved corpus markdown.
- Built per-letter prompt JSONLs, then filtered to a 21-genus
  subset (`*-pending.jsonl`) so non-target genera in those letter
  queues stayed untouched. Altispinax handled separately with a
  custom 2-paper prompt (huene1923 + dames1885).
- Dispatched 21 Haiku 4.5 agents in parallel; 6 came back as
  sentinels:
    - Massospondylus, Scelidosaurus, Eucamerotus — too-strict
      sentinel calls (single-page Owen catalog format, brief Owen
      genus erection, multi-paper case). Re-dispatched with
      custom prompts; all three extracted cleanly.
    - Coahuilaceratops, Marmarospondylus, Oplosaurus — verified
      genuine corpus problems: the markdown filed under
      `loewen2010` is the 2007 Ceratopsian Symposium abstract
      (not the 2010 book chapter); `owen1874` is Part III of
      Owen's monograph series and covers *Omosaurus hastiger*
      with no Marmarospondylus content; `gervais1852a` is a
      bibliographic listing with no Oplosaurus section. Moved
      all three from the Pending Resolution Papers list back to
      §1 with new wrong-paper-content notes.
- Eucamerotus and Altispinax were both genus-erection-papers
  citing material from earlier papers (hulke1870 / dames1885
  respectively). Custom prompts pointed the agent at both files
  and asked it to synthesise.
- 19 genera applied. 1 typo fix (`proccoelous` → `procoelous`,
  Syngonosaurus) and 1 word swap (`curvable` → drop, Compsognathus,
  archaic translation artifact) caught at spellcheck-before-apply
  stage. 16 vocab additions: Dicraeosaurid, Senguerr, chondrine,
  unossified, Kelheim, Oberndorfer, cancellated, Sehuen,
  Macrospondylus, neurapophysial, subcylindric, truncature,
  Megalosaur, Wimille, Opercular, phalangial.
  paleo-vocab 1167 → 1183, taxonomy 6478 → 6496.
- 0 validation errors. Closed out:
    - 17 of 20 rows in "Pending Resolution Papers" (the entire
      list emptied save the 3 corpus-problem entries which
      moved to §1).
    - Altispinax row in §2 "Wrong described_in citations" (now
      successfully extracted via 2-paper combo, no longer an
      open issue).
    - Amargasaurus row in §3 "Real binomial / spelling
      discrepancies" (the *cazaui*/*groeberi* artifact was
      tied to the wrong-citation; salgado1991 extraction
      confirms `binomial_in_paper: Amargasaurus cazaui`).

### Letter Z — 2026-05-03 — _final letter_

- 25 genera scanned, 20 queued, 4 no_corpus_markdown skips,
  1 no_described_in skip.
- 2 batches dispatched (Haiku 4.5).
- 19 applied, 1 sentinel (Zapsalis/marsh1877c — agent reports
  "target taxon not found in paper", wrong-paper-content pattern;
  flagged in corpus-paper-report).
- 0 insertion failures, 0 hand edits.
- 5 specimen-ID strips before apply.
- Spellcheck-before-apply: 0 typos, 11 unknown words all
  legitimate (ankylosaurine, capitis, medioposteriorly,
  postfibular, posttemporal, protoceratopsids, Sanpetru,
  troodontid, Zhucheng, zygapophysial).
- Vocab additions: 10. paleo-vocab 1157→1167; taxonomy 6468→6478.
- Validation: 0 errors, 9 pre-existing warnings.

### A–Z paper-driven backfill complete

This entry closes out the alphabetical pass. The
spellcheck-before-apply workflow change introduced at letter T
held up across U–Z: zero per-YAML hand edits across 7 letters of
extractions, with all typo cleanup happening at the JSON layer.

### Letter Y — 2026-05-03

- 27 genera scanned, 24 queued, 3 no_corpus_markdown skips.
- 2 batches of 12 dispatched (Haiku 4.5).
- 23 applied, 1 wrong-`described_in` skip (Yandusaurus — sereno1986
  is a phylogenetic review, not the original He 1979 description;
  logged in section 2 of corpus-paper-report).
- 0 insertion failures, 0 hand edits.
- 3 specimen-ID strips before apply.
- Spellcheck-before-apply: 1 JSON normalization
  (`ilio-sacral` → `iliosacral` in Yanbeilong). 8 unknown words were
  legitimate (hemimandible, maniraptorans, postquadratic,
  Subelliptical, Subtemporal, supraglenoidal, ventroscapular,
  iliosacral).
- Vocab additions: 8. paleo-vocab 1149→1157; taxonomy 6460→6468.
- Validation: 0 errors, 9 pre-existing warnings.

### Letter X — 2026-05-03

- 20 genera scanned, 16 queued, 4 no_corpus_markdown skips.
- Single batch of 16 dispatched (Haiku 4.5).
- 15 applied, 1 sentinel (Xixiasaurus/lü2010 — 10-line stub
  markdown, flagged in corpus-paper-report).
- 0 insertion failures, 0 hand edits.
- 5 specimen-ID strips before apply.
- Spellcheck-before-apply: 2 JSON normalizations
  (`latero-medially` → `lateromedially` in Xenotarsosaurus;
  `Three-digited` → `Tridactyl` in Xuanhanosaurus). 5 unknown words
  were legitimate terms (allometric, ectocondylar,
  infraparapophyseal, interdigitating, sacrocostal).
- Vocab additions: 5. paleo-vocab 1144→1149; taxonomy 6455→6460.
- Validation: 0 errors, 9 pre-existing warnings.

### Letter W — 2026-05-03

- 14 genera scanned, 13 queued, 1 no_corpus_markdown skip.
- Single batch of 13 dispatched (Haiku 4.5).
- 12 applied, 1 sentinel (Wulagasaurus/godefroit2008 — 14-line stub
  markdown, flagged in corpus-paper-report).
- 0 insertion failures, 0 hand edits.
- 6 specimen-ID strips before apply.
- Spellcheck-before-apply: 1 typo fixed in JSON
  (`spinoprezygopophyseal` → `spinoprezygapophyseal` in Wintonotitan).
  6 unknown words were legitimate terms (anconal, anticus, brachialis,
  Bürgermeister, Henfield, rostrolateral).
- Vocab additions: 6. paleo-vocab 1138→1144; taxonomy 6449→6455.
- Validation: 0 errors, 9 pre-existing warnings.

### Letter V — 2026-05-03

- 23 genera scanned, 17 queued, 5 no_corpus_markdown skips,
  1 no_described_in skip.
- Single batch of 17 dispatched (Haiku 4.5).
- 15 applied, 2 sentinels (Vagaceratops/farke2011 — same paper as
  Spinops; Vayuraptor/samathi2019 — same paper as Phuwiangvenator;
  both stub-markdown). 0 insertion failures, 0 hand edits.
- 4 specimen-ID strips before apply.
- Spellcheck-before-apply: 6 unknown words, all legitimate
  anatomical/clade terms (metotic, neornithischians, pleurocoelous,
  procoelity, Somphospondylous, troughed). No JSON typo fixes.
- Vocab additions: 6. paleo-vocab 1132→1138; taxonomy 6443→6449.
- Validation: 0 errors, 9 pre-existing warnings.

### Letter U — 2026-05-03

- 13 genera scanned, 12 queued, 1 no_corpus_markdown skip.
- Single batch of 12 dispatched (Haiku 4.5).
- 12 applied, 0 sentinels, 0 insertion failures, 0 hand edits.
- 4 specimen-ID strips before apply.
- Spellcheck-before-apply: only 4 unknown words surfaced and all
  were legitimate anatomical/clade terms — no JSON typo fixes
  needed. Smallest letter so far; cleanest run on record.
- Vocab additions: 4 (cotyles, dromaeosaurs, laterodorsally,
  midcervical). paleo-vocab 1128→1132; taxonomy 6439→6443.
- Validation: 0 errors, 9 pre-existing warnings.

### Letter T — 2026-05-03

- 84 genera scanned, 66 queued, 16 no_corpus_markdown skips,
  2 no_described_in skips
- 6 batches of ~12 dispatched (Haiku 4.5)
- 62 applied, 3 sentinels (Telmatosaurus, Tochisaurus, Tornieria —
  flagged in corpus-paper-report), 1 review-only skip (Thecocoelurus,
  logged in section 4 of corpus-paper-report).
- 19 specimen-ID strips before apply.
- **Workflow improvement landed.** This batch ran spellcheck on the
  extraction JSONs *before* `apply-paper-field-extractions.ts` and
  fixed 12 typos at the JSON layer
  (`Crescentric-shaped`→`Crescent-shaped`, `tarsometarsal`→
  `tarsometatarsal`, `slitlike`→`slit-like`, `proötic`→`prootic`,
  `pleuroceol`→`pleurocoel`, `spenial`→`splenial`,
  `Doegie Creek`→`Dogie Creek`, `liplike`→`lip-like`,
  `inversed-comma`→`inverted-comma`,
  `semiarticulatedtail`→`semiarticulated tail`,
  `spinopost-zygapophyseal`→`spinopostzygapophyseal`,
  `foraminae`→`foramina`). The apply step then wrote clean text
  directly into the YAMLs — no per-YAML hand edits needed for
  vocabulary/typo cleanup this round (vs. 6 hand edits in letter S).
- 1 insertion failure (Troodon — no `holotype:` block in YAML).
  Added a new block by hand with `status: unknown` (Leidy 1856
  single-tooth holotype has no surviving catalog number); logged in
  corpus-paper-report section 5.
- 2 hand-cleaned material strings: Transylvanosaurus
  ("(LPB (FGGUB) R.2070)" parenthetical) and Thyreosaurus
  ("HIIUC BN00" inline ID). `strip-specimen-ids` does not yet handle
  these patterns.
- 1 abbreviation expansion: "deep narrow SPRF" →
  "deep narrow spinoprezygapophyseal fossa" (Tambatitanis).
- Vocab additions: 32 anatomical/locality terms (dorsocaudal,
  dorsosacrals, frontoparietals, hypapophysis, hyperconstricted,
  interprezygapophyseal, malleoli, orthopodous, parabasisphenoid,
  parasphenoidal, Peñarroya, Pisolitic, postocular, postpubic,
  postzygocentrodiapophyseal, prespinous, prezygocentrodiapophyseal,
  Puboischial, quadrately, reniform, Romà, rostroventrally, Sant,
  Savannakhet, subangular, subrounded, supracondylar, tarsometatarsal,
  Tastavins, tomial, ventrocaudal, Dogie). paleo-vocab 1096→1128;
  taxonomy 6407→6439.
- Validation: 0 errors, 9 warnings (all pre-existing).

### Letter S — 2026-05-03

- 111 genera scanned, 91 queued, 17 no_corpus_markdown skips,
  3 no_described_in skips
- 8 batches of ~12 dispatched (lightweight prompt-file pattern,
  Haiku 4.5)
- 86 applied, 5 sentinels (Sauroplites, Spinops, Stegosaurides,
  Stenopelix, Struthiosaurus — flagged in corpus-paper-report)
- 20 specimen-ID strips before apply
- One agent-side typo: Secernosaurus extraction was written to
  "Secernosaurs.json" with `genus: "Secernosaurs"` — renamed file
  and edited the JSON before apply.
- Hand-fixed 6 typos in YAMLs (still required this round because the
  spellcheck/JSON-fix step came AFTER apply): `prezygopophyses` →
  `prezygapophyses` (Saurophaganax), `proccoelous` → `procoelous`
  (Syngonosaurus), `Procoelic` → `Procoelous` (Sidersaura),
  `tonguelike` → `tongue-like` (Sinornithoides), `latero-medially`
  → `lateromedially` (Shuvuuia), `centraprezygapophyseal` →
  `centroprezygapophyseal` (Sonidosaurus).
- Cleaned up Spinostropheus material — strip-specimen-ids missed the
  parenthetical institution-name + catalog form
  "(Musée National d'Histoire Naturelle, 1961–28)"; removed by hand.
- Vocab additions: 52 anatomical/taxonomic terms (acanthopholid,
  Anisodactyl, anisotetradactyl, antotic, archaeopterygids,
  brainstem, buchholtzae, camellate, caudipterids, ceratosaurian,
  Ceratosaurus, coelurosaurs, ectepicondyle, embayed, epipophyseal,
  Glyptodon, heterodonty, iguanodont, incisura, internus,
  isotridactyl, Junghsien, Kuangyuan, Mamillated, mamillated,
  mammillated, megalosaurian, midsagittal, Nasomaxillary,
  nasomaxillary, neomorphic, nodosaur, nodosaurs, opisthotics,
  Parapodiapophyseal, Pietraroia, Plattenkalk, prootica,
  protoceratopsians, semiarticulated, Sihetun, subhomodont,
  Supracoracoid, supracoracoid, tibialis, tibiotarsal, tuberalis,
  unrecurved, Ventrodistal, …). paleo-vocab 1044→1096; taxonomy
  6357→6407.
- **Process improvement (carry forward):** Spellcheck reads from
  extraction JSONs. Running spellcheck → fix-typos-in-JSONs BEFORE
  `apply-paper-field-extractions.ts` would let the apply step write
  clean text directly into the YAMLs and skip the per-YAML hand
  edits that this batch needed. Memory saved as
  `feedback_spellcheck_before_apply.md`.
- Validation: 0 errors, 9 warnings (all pre-existing publication-source
  flags).

### Letter R — 2026-05-03

Eighteenth letter, on Haiku 4.5. 30 genera total; 24 queued, 6
skipped (no_corpus_markdown: Rapator, Rayososaurus, Rhabdodon,
Rinchenia, Riojasaurus, Ruyangosaurus).

Dispatch: 4 batches of 6 agents using lightweight prompt-file
stub (`Read this prompt file: /tmp/r-prompts/<Genus>.txt`). All
24 returned valid JSON.

Apply results: 23 applied, 1 sentinel (Ruehleia — galton2001 is
721 lines but agent sentinel'd; flagged in corpus-paper-report
section 1 for investigation). 0 non-primary, 0 insertion failures.

Strip-specimen-ids ran before apply: caught 7 cleanups
(Ratchasimasaurus, Regnosaurus, Rhomaleopakhus, Richardoestesia,
Rugocaudia, Ruixinia, plus capitalization-only). 3 YAMLs needed
hand-cleanup for patterns the strip script doesn't handle:

- Rahonavis: trailing `, UA 8656; Upper Cretaceous Maevarano
  Formation, Madagascar`
- Regnosaurus: trailing `from the Wealden, generically distinct
  from Iguanodon Mantelli`
- Riojavenatrix: trailing `cataloged as CPI 1637-1648, 1675-1677`

Post-apply spelling normalization (4 tokens):
- Rhoetosaurus: `amphiccelous` → `amphicoelous` (typo)
- Rajasaurus: `transversed` → `transverse` (typo)
- Regnosaurus: `Iguanodon Mantelli` → `Iguanodon mantelli` (modern
  species-name lowercase)
- Rebbachisaurus: `Apatosaurus comparables` → `corresponding
  Apatosaurus elements` (Spanish/translation artifact)

Vocab additions (11): capituloparapophysial, epiossifications,
eusauropod, hypantra, hyperextendible, hypopubic, Judithian,
orthozygous, sellae, somphospondylan, subgenerically. paleo-vocab
1032→1043; taxonomy 6344→6355.

Validation: 0 errors, 9 warnings (all pre-existing flagged
publication sources).

Cumulative impact: 23 of 24 queued R genera populated. Ruehleia
deferred for corpus investigation.

### Letter Q — 2026-05-03

Seventeenth letter, on Haiku 4.5. 14 genera total; 11 queued, 3
skipped (no_corpus_markdown: Qinlingosaurus, Qiupalong,
Quilmesaurus). Smallest letter run by count yet.

Dispatch: 2 batches of 6 + 5 agents. All 11 returned valid JSON.

Apply results: 11/11 applied. 0 sentinels, 0 non-primary, 0
insertion failures. Cleanest run yet.

Process improvement applied: dispatched the second batch using
"Read this prompt file: /tmp/q-prompts/<Genus>.txt" stub instead
of inlining the full prompt body. The agent reads the prompt from
disk, which dramatically reduces dispatcher token cost (the
verbose prompt body was repeated in every Agent invocation).
Tested first on a few batch-1 agents and worked equivalently;
extending to all future batches.

Strip-specimen-ids ran before apply: caught 2 cleanups (Qingxiusaurus
trailing paren, Quetecsaurus capitalization). 4 YAMLs needed
hand-cleanup for patterns the strip script doesn't handle:

- Qantassaurus: comma-prefix `NMV P199075, ` (not in
  institutions.yaml as a paren prefix)
- Qianlong: colon-prefix `GZPMVN001: ` (not recognized as
  institution by strip script)
- Qiaowanlong: colon-prefix `FRDC GJ 07-14: ` (similar)
- Quaesitosaurus: colon-prefix `PIN No. 3906/2: ` plus locality/
  formation tail — collapsed to "Incomplete skull"

Post-apply spelling normalization (1 token):
- Qantassaurus: `cheekteeth` → `cheek teeth` (modern two-word form)

Vocab additions (1): `Shara` (Mongolian locality "Shara-Tsav",
appears in pre-existing Quaesitosaurus location.locality).
paleo-vocab.txt 1031→1032; taxonomy.txt 6342→6344 (regenerated).

Remaining spellcheck flags (3, JSON-only): `Barungoyot` (formation),
`GZPMVN` (institution code), `cheekteeth` (legacy form, JSON not
yet re-stripped).

Validation: 0 errors, 9 warnings (all pre-existing flagged
publication sources).

Cumulative impact: 11 of 11 queued Q genera populated. Letter Q
was unusually clean — no sentinels, no non-primary, no insertion
failures, and minimal hand-cleanup. Likely because most Q genera
are recent named-after-Chinese-localities sauropod descriptions
with high-quality modern primary publications.

### Letter P — 2026-05-03

Sixteenth letter, on Haiku 4.5. 94 genera total; 70 queued, 24 skipped
(1 no_described_in: Parasaurolophus; 23 no_corpus_markdown).
Largest letter run yet by count (70 vs. M's 65).

Dispatch: 8 batches of 8-9 agents (size-balanced round-robin
distribution). All 70 returned valid JSON.

Apply results: 60 applied, 9 sentinels, 1 review-quality
(Protognathosaurus — olshevsky1991 is the Dinosaur Genera List, not
the primary description), 2 insertion failures (Pleurocoelus,
Pterospondylus — neither YAML had a `holotype:` block; added by
hand).

Sentinel breakdown:
- Empty/abstract-only: Pawpawsaurus (lee1996, 28 lines),
  Phuwiangvenator (samathi2019, 14 lines), Paranthodon
  (carroll1988, 50-line textbook entry).
- Wrong-target-taxon / borderline: Plateosaurus (sander1992 is
  paleohistology, not original Meyer 1837), Piatnitzkysaurus
  (bonaparte1979a — same paper as Patagosaurus which extracted
  successfully; agent sentinel'd Piatnitzkysaurus side),
  Peishansaurus (bohlin1953, same paper as Heishansaurus),
  Pararhabdodon (casanovascladellas1992, 273 lines but agent
  sentinel'd — possibly translation issue), Prosaurolophus
  (brown1916, 175 lines — investigate), Protohadros (head1998,
  64-line borderline).

All 9 sentinels + Protognathosaurus + Plateosaurus added to
corpus-paper-report section 1 / section 4 entries.

Hand-added holotype blocks (logged in corpus-paper-report section 5
for follow-up specimen_id population):
- Pleurocoelus: `specimen_type: syntype, status: unknown`
- Pterospondylus: `specimen_type: holotype, status: unknown`

Process improvement applied: ran strip-specimen-ids BEFORE apply.
Strip caught 12 cleanups (substantive + capitalization). 5 YAMLs
needed hand-cleanup for patterns the strip script doesn't handle:

- Pandoravenator: trailing "cataloged as MPEF PV 1773-3 through
  1773-28"
- Pentaceratops: trailing locality "from Fruitland Beds, 9 miles
  NE of Tsaya, New Mexico"
- Priconodon: trailing locality "from Potomac formation, Prince
  George Co., Maryland"
- Proceratosaurus: trailing locality "from Great Oolite of
  Minchinhampton, Gloucestershire"
- Protarchaeopteryx: trailing institution+catalog "Chinese
  Geological Museum specimen #GMV2125"

Post-apply spelling normalization (3 tokens):
- Protoavis: `infratetmporal` → `infratemporal`,
  `posterorbital` → `postorbital`
- Pedopenna: `postomedial` → `posteromedial`

Vocab additions (37): anteroverted, Astragalo, calcaneal,
caudoventrally, Cervico, circumorbital, costae,
dermosupraoccipital, diapsid, dromaeosaur, encephalized,
Epidendrosaurus, Epipodium, haema, hemapophyses, heterocoelous,
infradiapophyseal, Megalosaurids, miniaturisation, nodosaurid,
nonbifurcated, parieto, pectineal, Postcaniniform, Posterodistally,
prokinetic, proximodorsally, Pseudopleurocoel, sella, semiovate,
sphenethmoid, streptostylic, syndesmotic, titanosaurid,
titanosauriforms, transversally, turcica.
paleo-vocab.txt 994→1031; taxonomy.txt 6305→6342.

Remaining spellcheck flags (15, JSON-only locality/institution/
typos in JSONs that are no longer in YAMLs): anpetru, Ceratosaurus,
Cinctorres, Colección, Dashanpu, Hateg, infratetmporal,
Minchinhampton, Museográfica, posterorbital, postomedial, Sibis,
Tsaya, plus borderlines.

YAML data issue noted: Podokesaurus YAML uses `species: Coelophysis
bauri` (synonymy decision); paper talbot1911 describes
*Podokesaurus holyokensis*. Agent extraction proceeded against
talbot1911 anyway with binomial_in_paper flagged.

Validation: 0 errors, 9 warnings (all pre-existing flagged
publication sources).

Cumulative impact: 60 of 70 queued P genera populated. Largest
single-letter run by both genera count and corpus volume (5973KB).

### Pending-resolution batch 2 — 2026-05-03

Five-genus sweep over the Pending Resolution Papers list updated by
the user after the letter-O run. All 5 markdown files now present
in corpus.

Setup:
- 5 genera: Anchisaurus, Camptosaurus, Liaoningvenator,
  Macrurosaurus, Oohkotokia.
- 2 markdown-target overrides:
  - Anchisaurus → `hitchcock1865.md` (23 lines — relaxed-threshold
    note added; the original *Megadactylus* description, since
    `marsh1885` is only the rename to *Anchisaurus*).
  - Camptosaurus → `marsh1879.md` (the original *Camptonotus*
    description; same paper as Brontosaurus's `marsh1879`, covers
    multiple Jurassic reptiles).

Dispatch: 5 Haiku-4.5 agents in a single batch. All returned valid
JSON; 0 sentinels.

Apply results: 5/5 applied. Liaoningvenator already had `material`
populated, so only `diagnostic_features` was added there. Strip-
specimen-ids ran before apply but caught 0 patterns (all residuals
were comma-prefix or locality-tail patterns the script doesn't
handle).

Pre-extraction agent typo fix: Camptosaurus's diagnostic_features
contained `opisthocoolous` (typo for `opisthocoelous`); fixed in
the JSON before apply.

Hand-cleanup applied (2 YAMLs):
- Macrurosaurus: trimmed locality+institution tail
  ("from phosphatite washings at Coldham Common and Barton,
  Cambridge Upper Greensand, Woodwardian Museum") → kept just
  "Series of approximately 40 associated caudal vertebrae".
- Oohkotokia: stripped comma-prefix `MOR 433, ` and locality tail
  ("from Upper Two Medicine Formation, Montana") → kept "Skull and
  fragmentary skeleton".

Post-apply spelling normalization (1 token):
- Camptosaurus: `uncoossified` → `unfused` (1879 Marsh archaic
  spelling; modern equivalent in the same context).

Vocab additions (1): `unkeeled` (Oohkotokia diagnostic feature).
paleo-vocab.txt 993→994; taxonomy.txt 6303→6305 (regenerated; the
+2 includes a derived form).

Validation: 0 errors, 9 warnings (all pre-existing flagged
publication sources).

Cumulative impact: section-1 entries for Anchisaurus, Camptosaurus,
and Oohkotokia removed; Pending Resolution Papers section now
empty.

### Letter O — 2026-05-03

Fifteenth letter, on Haiku 4.5. 31 genera total; 26 queued, 5 skipped
(no_corpus_markdown: Ohmdenosaurus, Oplosaurus, Ornithomimoides,
Orthogoniosaurus, Ouranosaurus).

Dispatch: 5 batches of 5-6 agents to stay under usage. All 26 returned
valid JSON.

Apply results: 25 applied, 1 sentinel (Oohkotokia,
penkalski2013 — likely insufficient prose), 2 insertion failures
(Ojoceratops/holotype.material and Omeisaurus/holotype.material —
neither YAML had a `holotype:` block; added them by hand). 13 of the
25 applied genera had pre-existing `material:` content, so apply only
inserted `diagnostic_features:` for those.

Process improvement applied: ran `strip-specimen-ids` BEFORE `apply`
this round (lesson from the pending-resolution batch). Strip caught
4 substantive cleanups (Ojoraptorsaurus, Oryctodromeus, Owenodon,
Ozraptor) plus 1 capitalization fix (Overosaurus). 6 YAMLs still
needed hand-cleanup for patterns the strip script doesn't handle:

- Obelignathus: comma-prefix specimen ID + dimensions + locality tail
- Olorotitan: embedded specimen ID with parenthetical institution-
  location wrapper
- Orodromeus: comma-prefix specimen ID
- Osmakasaurus: comma-prefix specimen ID
- Overoraptor: colon-prefix specimen ID at start of material
- Owenodon: embedded `(NHM R2998)` parenthetical + locality tail

Modernized 4 historical-spelling tokens in YAML diagnostic features
(per the project's spelling-normalization policy):

- Ornithopsis: `Pterodactyle` → `pterodactyl` (1870 spelling)
- Ornithopsis: `Ophisthoccelous` → `Opisthocoelous` (OCR artifact;
  Seeley 1870 markdown was OCR-corrupted, agent's note flagged it)
- Ornitholestes: `Celurus` → `Coelurus` (1903 spelling of related
  genus)
- Ornitholestes: `united postorbito-frontal` → `fused postorbital
  and frontal` (clarified hyphenated combining form)

Vocab additions (17): Faciocranial, fenestrations, ginglymoidal,
iliocaudalis, inrolling, intermedium, lateroposteriorly,
lithostrotians, medioventral, megalosaurs, Nasofrontal, osteologic,
Processus, pseudospinosus, rhabdodontomorphs, subequally, Unforked.
paleo-vocab.txt 976→993; taxonomy.txt 6286→6303.

Remaining spellcheck flags (10, all JSON-only or pre-existing
content): `Blagoveschensk`, `Celurus`, `Durlston`, `Jachenhausen`,
`Montouliers`, `Ophisthoccelous`, `postorbito`, `Pterodactyle`,
`Swanage`, `Teylers` — locality/etymology pre-existing terms or
agent-extraction text superseded in YAML.

Real binomial flag (cosmetic — Wade-Giles vs. older transliteration
variant): Omeisaurus YAML uses `junghsiensis` (matches original
Young 1939); paper markdown OCR rendered `yunghsiensis`. Both forms
appear in the literature; YAML's spelling matches the original
publication, so no change.

Holotype additions (Omeisaurus had no `holotype:` block at all):
specimen_id `IVPP V930`, institution `IVPP` (modern catalog
reference; Young 1939's original specimen designation predated the
IVPP cataloging system).

Validation: 0 errors, 9 warnings (all pre-existing flagged
publication sources).

Cumulative impact: 25 of 26 queued genera populated this round.
Oohkotokia stays in the no-data bucket; Macrurosaurus still pending
corpus addition of `seeley1876.md` from the prior batch.

### Pending-resolution batch — 2026-05-02

Re-extraction sweep over the 14 entries the user had flagged as "fixed
in corpus, awaiting reprocess" in the corpus-paper-report. Custom
prompts dispatched directly (not via `build-extraction-prompts.ts`)
because the targets span letters H/L/M/N and two cases needed
markdown-target overrides.

Setup:
- 14 candidates total. 1 dropped at queue time:
  Macrurosaurus (`seeley1876.md` still missing from corpus despite
  user note). Hoplitosaurus kept after user confirmed lucas1901 (44
  lines, the original *Stegosaurus marshi* description) suffices
  even though gilmore1914b is missing.
- 2 markdown-target overrides:
  - Mononykus → read `perle1993a.md` (original Nature description)
    instead of the YAML's `described_in: perle1993b` (correction).
  - Nemegtomaia → read `lü2004.md` (original *Nemegtia* description)
    instead of YAML's `described_in: lü2005b` (replacement name).

Dispatch:
- 13 Haiku-4.5 agents in 3 batches (5/4/4) to stay under usage at 86%
  start. All 13 returned valid JSON; 0 sentinels at extraction.

Apply results (per letter):
- H: 2 applied (Hoplitosaurus, Hypsibema)
- L: 3 applied (Lanzhousaurus, Lavocatisaurus, Lepidus)
- M: 2 applied (Mononykus, Musankwa)
- N: 6 applied (Narambuenatitan, Nebulasaurus, Nemegtomaia,
  Nigersaurus, Niobrarasaurus, Nodocephalosaurus)
- 13/13 net populated. Lepidus and Nemegtomaia already had `material`
  pre-populated; only their new `diagnostic_features` were applied.

Material-cleanup pattern observed: ran `strip-specimen-ids` AFTER
`apply` (wrong order — strip writes to JSONs, not YAMLs), so 7 YAMLs
needed hand-edits to remove specimen-ID parentheticals, institution
prefixes, and locality/age tails the strip patterns don't catch.
Affected:

- Lanzhousaurus: trailing ` (GSLTZP 1-1)` (script caught in JSON, not
  YAML)
- Mononykus: leading `Mongolian Geological Institute (MGI) 107/6: `
  prefix and trailing `From Upper Cretaceous Maestrichtian Nemegt
  Formation, Bugin Tsav, Mongolia.`
- Musankwa: trailing ` (NHMZ 2521)` (NHMZ not in institutions.yaml)
- Nebulasaurus: leading `LDRC-v.d.1, ` prefix (comma-prefix the
  strip script doesn't handle) plus trailing formation/age info;
  collapsed to just `Braincase`
- Nigersaurus: trailing ` from niveau des Innocents locality in
  Gadoufaoua region` locality preamble
- Nodocephalosaurus: trailing ` (SMP VP-900)` (script caught in JSON,
  not YAML)
- Hypsibema: leading `Fossil reptile remains from Sampson Co., North
  Carolina: ` locality preamble

**Lesson learned:** strip-specimen-ids should run on JSONs *before*
apply, not after. Order matters because `apply` skips already-
populated fields, so re-running it after a strip won't propagate
changes back into YAML.

Vocab additions (7): `cotyla`, `Craniopharyngeal`, `intermetacarpal`,
`mammillations`, `Nasopremaxillary`, `ovalis`, `precaudal`. paleo-
vocab.txt 969→976; taxonomy.txt 6279→6286 (regenerated).

Remaining spellcheck flags (3, JSON-only — not in YAML, will not
affect validation): `Bugin`, `Maestrichtian` (M-letter), `LDRC` (N-
letter). Locality/institution artifacts trimmed during YAML cleanup.

Validation: 0 errors, 9 warnings (all pre-existing flagged
publication sources, none from this batch).

Cumulative impact: this batch covers 13 of the 14 deferred items
flagged across letters A–N. Macrurosaurus remains pending corpus
addition of `seeley1876.md`.

### Letter N — 2026-05-02

Fourteenth letter, also on Haiku 4.5. 46 genera total; 38 queued
(1 no described_in: Nuthetes; 7 no corpus markdown).

Apply results:
- **Applied**: 31
- Sentinels (7):
  - 4 abstract-only markdown: Narambuenatitan (`filippi2011`,
    14 lines), Nebulasaurus (`xing2013`, 10 lines), Niobrarasaurus
    (`carpenter1995`, 30 lines), Nodocephalosaurus (`sullivan1999`,
    26 lines)
  - 1 wrong-paper-content: Nigersaurus (`sereno1999.md` has laser
    physics / neuroscience reports, not the Nigersaurus paper)
  - 1 wrong-target-taxon: Neuquensaurus (`powell1992.md` is a
    655-line *Saltasaurus loricatus* monograph; Powell does erect
    *Neuquensaurus* there, but the systematic content is on
    Saltasaurus — agent correctly didn't extract referred-only
    diagnostic content)
  - 1 nomenclatural-only: Nemegtomaia (`lü2005b` is the
    replacement-name paper; original diagnosis is in Lü et al.
    2004)
- Non-primary: 0
- No-data: 0
- Insertion failures: 0

One typo caught by spellcheck and fixed:
Ningyuansaurus `Confuciornís` → `Confuciusornis` (paper-level
acute-accent OCR error in institution name; standardised).

Spellcheck added 20 new vocab entries (anatomical adjectives,
locality `Hermiin` and `Xingcheng`, institution PVPH, plus
`Confuciusornis` after the typo fix). Total 969, taxonomy
6,279 words.

Cumulative impact (A–N):
- `diagnostic_features` missing: 1,295 → 652 (−643, −49.7%)
- `species.holotype.material` missing: 1,062 → 532 (−530, −49.9%)

### Letter M — 2026-05-02

Thirteenth letter, also on Haiku 4.5. 79 genera total; 65 queued
(1 no described_in: Megalosaurus; 13 no corpus markdown including
Mamenchisaurus, Massospondylus, Mantellisaurus, Magyarosaurus,
Magnosaurus, Mandschurosaurus, Marmarospondylus, Microhadrosaurus,
Micropachycephalosaurus, Mongolosaurus, Monkonosaurus, Montanoceratops,
Morinosaurus).

Apply results:
- **Applied**: 61
- Sentinels (4):
  - Macrurosaurus (`seeley1869` markdown is abstract-only, 26 lines)
  - Musankwa (`barrett2024` markdown is abstract-only, 20 lines)
  - Mononykus (`perle1993` markdown contains a DNA repair / XP
    paper, not Mononykus — wrong-paper-content)
  - Microceratus (`mateus2008` is a nomenclatural note declaring
    the species *nomen dubium* per Sereno 2000; no diagnosis to
    extract — not a corpus issue)
- Non-primary: 0
- No-data: 0
- Insertion failures: 0

Strip-specimen-ids cleaned 16 catalog tokens that survived in
holotype_material.

Four typos caught by spellcheck and fixed:
- Muyelensaurus `Distai` → `Distal` and `basipterigoid` →
  `basipterygoid` (paper has both forms; standardised to modern
  spellings). Also stripped a comma-prefixed catalog token
  (`MRS-PV 207, a braincase…`) that the strip script doesn't match.
- Minmi `notocordal` → `notochordal` (paper-level typo, multiple
  occurrences in source).
- Microvenator `pleurocels` → `pleurocoels` (paper diagnosis
  literally writes `pleurocels`; standardised).

Spellcheck added 52 new vocab entries (anatomical adjectives,
clade abbreviations like `tyrannosauroid`/`carcharodontosaurid`,
institution codes NHMZ/UUVP, Mongolian/Tanzanian/South African
place names like `Nyama`, `Thaba`, `Thabana`, `Rooi`, `Morena`,
`Xiasanjiazi`). Total 949, taxonomy 6,259 words.

Cumulative impact (A–M):
- `diagnostic_features` missing: 1,295 → 683 (−612, −47.3%)
- `species.holotype.material` missing: 1,062 → 556 (−506, −47.6%)

### Letter L — 2026-05-02

Twelfth letter, also on Haiku 4.5. 64 genera total; 48 queued
(16 no corpus markdown — the largest no-paper bucket so far,
mostly older OCR-stub citations like `marsh1878a` cousins).

Apply results:
- **Applied**: 43
- Sentinels (5):
  - Lanzhousaurus (`you2005a` describes *Auroraceratops rugosus*,
    not Lanzhousaurus magnidens — wrong-paper-content)
  - Liaoningvenator (`shen2017` describes *Daliansaurus
    liaoningensis*, not Liaoningvenator curriei — same pattern)
  - Lavocatisaurus (`canudo2018` markdown is abstract-only,
    12 lines)
  - Lepidus (`nesbitt2015` markdown is abstract-only, 10 lines)
  - Laplatasaurus (`huene1927b` is a sauropod review paper;
    formal description is in Huene 1929 monograph — same
    citation issue as Antarctosaurus)
- Non-primary: 0 (Laplatasaurus quality flag was `review`,
  counted under sentinels above)
- No-data: 0
- Insertion failures: 0 (one apply round needed to fix a
  Haiku-introduced typo: `Lurdosaurus` → `Lurdusaurus` in the
  extracted JSON's `genus` field, which mismatched the YAML
  filename. Hand-corrected and re-applied.)

Three typos caught by spellcheck and fixed:
- Liaoceratops `juvenille` → `juvenile` (Haiku transcription
  error; source uses correct form). Also stripped surviving
  catalog tokens from the `material:` field by hand (the
  comma-delimited "IVPP V12738, an almost complete..." pattern
  isn't matched by `strip-specimen-ids-from-material`).
- Lythronax `tranverse` → `transverse` (paper-level typo in
  the Loewen et al. 2013 diagnosis; standardised to modern
  spelling).
- Lythronax `suboccular` → `subocular` (paper uses both
  forms; standardised to `subocular` which appears elsewhere
  in the same paper).

Spellcheck added 32 new vocab entries (Brachiosaurid family
abbreviation, anatomical adjectives like craniodorsally/
rostrodorsally/dorsolateroposteriorly, place names Lingwu/
Shawan/Wangshi/Paballong, historical synonym Gypsaurus, and
the typo-corrected `subocular`). Total 897, taxonomy
6,207 words.

Cumulative impact (A–L):
- `diagnostic_features` missing: 1,295 → 744 (−551, −42.6%)
- `species.holotype.material` missing: 1,062 → 610 (−452, −42.6%)

### Letter K — 2026-05-02

Eleventh letter, also on Haiku 4.5. 40 genera total; 35 queued
(5 no corpus markdown: Kaijiangosaurus, Kelmayisaurus,
Khankhuuluu, Kotasaurus, Kurupi).

Apply results:
- **Applied**: 35 (100% of queued — second clean letter in a row)
- Sentinels: 0
- Non-primary: 0
- No-data: 0
- Insertion failures: 0

No spellcheck-flagged typos this round (0 suspicious shapes).
Bullet counts again drifted above the soft 6-bullet cap on
Haiku (Kaatedocus 9, Kaijutitan 13, Kentrosaurus/Kerberosaurus/
Khulsanurus/Kileskus/Klamelisaurus/Koreanosaurus/Kosmoceratops/
Kritosaurus/Kulindadromeus/Kunbarrasaurus 7–13) — content
remains valid. Strip-specimen-ids cleaned 12 catalog tokens
that survived in `holotype_material` (e.g. `(MNHN.F.LES381m)`,
`(UMNH VP 17000)`).

Spellcheck added 29 new vocab entries (anatomical adjectives
like circumnasal/dorsocaudally/equidimensional/preantorbital,
plate-name terms epiparietosquamosal/episquamosal, scientific
terms ankylosaurian/arctometatarsalian/neornithischian, place
names Kindope/Kulinda, historical taxa Trachodon/trachodontid,
faithful copy of paper-level `pencillike`). Total 865,
taxonomy 6,175 words.

Cumulative impact (A–K):
- `diagnostic_features` missing: 1,295 → 787 (−508, −39.2%)
- `species.holotype.material` missing: 1,062 → 644 (−418, −39.4%)

### Letter J — 2026-05-01

Tenth letter, also on Haiku 4.5. 27 genera total; 20 queued
(7 no corpus markdown).

Apply results:
- **Applied**: 20 (100% of queued — cleanest letter yet)
- Sentinels: 0
- Non-primary: 0
- No-data: 0
- Insertion failures: 0

No spellcheck-flagged typos this round. Bullet counts continue to
drift above the soft 6-bullet cap on Haiku (Jianchangosaurus 11,
Jiangshanosaurus 9, Jaculinykus/Jakapil/Jeholosaurus/Jinbeisaurus/
Jiangxititan/Jinzhousaurus/Jobaria 8) — content remains valid.

Spellcheck added 9 new vocab entries (DLXH, VPPU institution
codes; iguanodontids, midheight, paranasal, Supracoracoideus,
supraoccipitals, Tambrat, Titanosaurus). Total 836, taxonomy
6,146 words.

Cumulative impact (A–J):
- `diagnostic_features` missing: 1,295 → 824 (−471, −36.4%)
- `species.holotype.material` missing: 1,062 → 670 (−392, −36.9%)

### Letter I — 2026-05-01

Ninth letter, also on Haiku 4.5. 31 genera total; 26 queued
(1 no described_in, 4 no corpus markdown).

Apply results:
- **Applied**: 23
- Sentinels (2): Invictarx (mcdonald2018 corpus paper actually
  describes *Dynamoterror dynastes*, not Invictarx — wrong corpus
  paper for this key); Itemirus (kurzanov1976a corpus paper
  describes *Alioramus remotus*, not Itemirus medullaris — same
  pattern).
- No-data (1): Iuticosaurus (leloeuff1993 — type species in YAML
  is `Iuticosaurus lydekkeri`, but the paper treats lydekkeri as a
  nomen dubium and describes *I. valdensis* instead. Real
  binomial / nomenclatural issue.)
- Insertion failures: 0

Two paper-/Haiku-level typos caught by spellcheck and fixed:
Incisivosaurus `oviraptosaur` → `oviraptorosaur`,
Iberospinus `pleurocelic` → `pleurocoelic`.

Spellcheck added 30 new vocab entries (mostly anatomical
directions and compound terms; plus place names Abangarit,
Tedreft from the Inosaurus/Ténéré paper, Ralekoala from the
Ignavusaurus paper, and the lamina abbreviations CPRL/PRSL from
the Ibirania paper). Total 827, taxonomy 6,137 words.

Cumulative impact (A–I):
- `diagnostic_features` missing: 1,295 → 844 (−451, −34.8%)
- `species.holotype.material` missing: 1,062 → 685 (−377, −35.5%)

Notable corpus findings:
- 2 wrong-paper-content cases (Invictarx, Itemirus): the cited
  markdown for the genus's described_in key actually describes a
  different taxon. Either the corpus file was assigned the wrong
  citation key, or the YAML's described_in points at the wrong
  paper. Logged in section 1 of `corpus-paper-report.md` for
  manual reconciliation.
- 1 nomenclatural issue (Iuticosaurus): YAML type species is
  *I. lydekkeri* (a nomen dubium per the cited paper); valid
  species per the paper is *I. valdensis*. Logged in section 5.

### Letter H — 2026-05-01

Eighth letter, **first run on Haiku 4.5** (instead of Sonnet 4.6) to
cut extraction cost. 53 genera total; 42 queued (10 no corpus
markdown; 1 no described_in: Hagieophis-equivalent slot).

Spot-checked 8 of the harder cases (multi-taxon papers, historical
1858/1870 OCR, Mongolian/Chinese names) before scaling to the full
batch. Quality was acceptable: bullet counts occasionally drifted
above the soft 6-bullet cap (Heterodontosaurus 8, Hypselospinus 9),
catalog tokens sometimes survived in `holotype_material` (handled by
`strip-specimen-ids`), and three paper/OCR-level typos were caught
by spellcheck and fixed manually:

- Hypsilophodon: `proemaxilla(ry)` → `premaxilla(ry)` (Huxley 1870
  OCR has `pr~emaxilla`/`proemaxillary` artifacts).
- Huehuecanauhtlus: `posterovental` → `posteroventral` (Haiku
  transcription error; source paper uses the correct form).
- Hungarosaurus: `amphycoelous` → `amphicoelous` (paper-level
  Greek-transliteration typo, corrected to standard form).

Token usage per call averaged ~36 k for Haiku vs. ~27 k for Sonnet
on prior letters. Even at the higher per-call token count, Haiku's
~3–4× lower per-token rate yields ~50% net cost savings.

Apply results:
- **Applied**: 39
- Sentinels (3): Heishansaurus (bohlin1953 — Part I pages 9–59
  missing from markdown), Hoplitosaurus (lucas1902 — boilerplate),
  Hypsibema (cope1869a — boilerplate)
- Non-primary: 0
- No-data: 0
- Insertion failures: 0

Spellcheck added 30 new vocab entries (mostly anatomical:
amphicoelous, craniolateral, distoventral, entepicondylar,
homodont, hornshield(s), ilial, internasal, Interphalangeal,
interpterygoid, ischiac, metacarpophalangeal, paraquadrate,
Platyrostral, postsacrals, pseudoacromial, sagittally, spiculae,
supraorbitals, suprapostzygapophysial; plus place names Bayn,
Dzak, Ulaanbaatar from the Halszkaraptor/Mongolia reference, and
the historical ligature `vertebræ` from the 1858 Hadrosaurus
paper). Total 797, taxonomy 6,107 words.

Cumulative impact (A–H):
- `diagnostic_features` missing: 1,295 → 867 (−428, −33.0%)
- `species.holotype.material` missing: 1,062 → 701 (−361, −34.0%)

Notable corpus findings:
- 1 historical OCR / typography note: `vertebræ` ligature in
  Leidy 1858 (kept verbatim).
- Heishansaurus's bohlin1953 markdown is missing the article body
  (Part I, pp. 9–59); only a summary mention survives. Section 1
  candidate (corpus re-fetch).

### Re-run pass (corpus-updated papers) — 2026-05-01

Targeted re-extraction of the 10 genera listed as "Corpus paper
updated" in `corpus-paper-report.md` section 1. After the user
refreshed the source markdown for each, the same dispatch flow was
run for just these genera (one prompt per genus, filtered out of the
per-letter JSONL).

Applied (9): Achelousaurus, Baryonyx, Camarillasaurus,
Chaoyangsaurus, Cruxicheiros, Daxiatitan, Einiosaurus, Eocarcharia,
Galvesaurus.

Skipped (1): Altispinax — agent classified `huene1923` as `review`.
The 1923 paper is the formal genus erection but the auto-skip was
triggered by the brief, embedded format. Moved to section 2 of
`corpus-paper-report.md` (issue #1863) as an edge case similar to
Crichtonpelta / Dromiceiomimus.

Daxiatitan's prior fields (extracted from the corrupted markdown)
were cleared in the YAML before re-run so the queue would pick it
up; the new extraction from the refreshed markdown replaces them.

Spellcheck added 12 new vocab entries (cornual, procurved,
supracranial, fibularis, megalosauroids, Proximomedially,
Caudalmost, and the centro-/spino-/intra-pre/post-zygapophysial
laminae from Galvesaurus); total 767, taxonomy 6,077 words.

Cumulative impact (A–G):
- `diagnostic_features` missing: 1,295 → 906 (−389, −30.0%)
- `species.holotype.material` missing: 1,062 → 732 (−330, −31.1%)

Galvesaurus reference fix (commit `216c2d9`): the `barco2005`
DOI `10.1159/000433440` was wrong (Karger publication). It has
been removed (Naturaleza Aragonesa does not appear to issue a DOI
for this paper) and the Sánchez-Hernández 2005 Zootaxa paper
(10.11646/zootaxa.1034.1.1) added as a secondary reference. The
ethical priority history (Barco et al. July 2005 vs Sánchez-Hernández
August 2005) is preserved in the synonym block.

### Letter G — 2026-05-01

Seventh letter. 54 genera total; 48 queued (6 no corpus markdown).

Apply results:
- **Applied**: 46
- Sentinels (1): Galvesaurus
- Non-primary (1): Gigantspinosaurus (review — not original)
- No-data: 0
- Insertion failures: 0

Spellcheck added 57 new vocab entries; total 755, taxonomy 6,065
words.

Cumulative impact (A–G):
- `diagnostic_features` missing: 1,295 → 914 (−381, −29.4%)
- `species.holotype.material` missing: 1,062 → 738 (−324, −30.5%)

Notable corpus findings:
- 4 translations: Garudimimus (Russian), Genusaurus (French),
  Gongbusaurus (Chinese), Gongxianosaurus (Chinese)
- **Real data bug**: `Gravitholus`'s YAML lists type species as
  *Stegoceras novomexicanum*, but the cited paper (Wall & Galton
  1979) describes *Gravitholus albertae*. Needs hand correction.
- Other binomial flags resolved as historical (Gargoyleosaurus
  emendation), OCR (Gilmoreosaurus single-letter), or paper-form
  ambiguity (Giraffatitan vs Brachiosaurus subgenus).

### Letter F — 2026-05-01

Sixth letter through the pipeline. 22 genera total; 19 queued (3
no corpus markdown: Foskeia, Fulgurotherium, Fushanosaurus).

Apply results:
- **Applied**: 19 (100% of queued)
- Sentinels: 0
- Non-primary: 0
- No-data: 0
- Insertion failures: 0
- Binomial flags: 0

The cleanest letter yet — every queued paper was a primary
description with usable holotype/diagnosis content. 25 new
paleo-vocab entries; total 698, taxonomy 6,008 words.

Cumulative impact (A–F):
- `diagnostic_features` missing: 1,295 → 959 (−336, −25.9%)
- `species.holotype.material` missing: 1,062 → 774 (−288, −27.1%)

### Letter E — 2026-05-01

Fifth letter through the pipeline. 46 genera total; 43 queued (1
no `described_in`: Euhelopus; 2 no corpus markdown: Edmontonia,
Emiliasaura).

Apply results:
- **Applied**: 39 genera
- Sentinels (2): Einiosaurus (same as Achelousaurus's
  sampson1995), Eocarcharia (sereno2008a)
- Non-primary (1): Eucamerotus (review — bare name in a list)
- No-data (1): Elaphrosaurus
- Insertion failures: 0

Spellcheck unknowns: 78 → 0 after appending 76 new terms;
paleo-vocab.txt now 673 entries; cspell taxonomy 5,983 words.

Cumulative impact (A + B + C + D + E):
- `diagnostic_features` missing: 1,295 → 978 (−317, −24.5%)
- `species.holotype.material` missing: 1,062 → 790 (−272, −25.6%)

Notable corpus findings:
- 2 translations: Enigmosaurus (Russian), Epachthosaurus
  (Spanish)
- 2 historical genus renames: *Stereocephalus* → *Euoplocephalus*
  (preoccupied beetle name); *Efraasia diagnostica* → *E. minor*
  (verify nomenclatural history)

### Letter D — 2026-05-01

Fourth letter through the pipeline. 60 genera total; 49 queued (1
no `described_in`: Diplodocus; 10 no corpus markdown).

Apply results:
- **Applied**: 45 genera
- Sentinels: 0 (notable — every paper had usable content)
- Non-primary (2): Dromaeosauroides (review), Dromiceiomimus
  (systematic revision — edge case, see corpus-paper-report.md)
- No-data (2): Dacentrurus, Dryptosaurus (likely brief older papers)
- Insertion failures: 0

Spellcheck unknowns: 87 → 0 after appending 84 new terms;
paleo-vocab.txt now 597 entries; cspell taxonomy 5,907 words.

Cumulative impact (A + B + C + D):
- `diagnostic_features` missing: 1,295 → 1,016 (−279, −21.5%)
- `species.holotype.material` missing: 1,062 → 819 (−243, −22.9%)

Notable corpus findings:
- Daxiatitan (you2008) heavily OCR-corrupted — genus garbled as
  "Maxiaosaurus robustus"; data is suspect, consider re-OCR
- 4 binomial flags, all single-glyph OCR misreads (Dandakosaurus
  inducus, Dongyangopelta yangyananensis, Dongyungosaurus,
  Dromæzosaurus) — none require action
- 1 historical genus rename: Dacentrurus (formerly Omosaurus,
  preoccupied)

### Letter C — 2026-05-01

Third letter through the pipeline. 85 genera total; 67 queued (0
no `described_in`, 18 no corpus markdown).

Apply results:
- **Applied**: 60 genera
- Sentinels (5): Camarillasaurus, Camptosaurus, Campylodoniscus,
  Chaoyangsaurus, Cruxicheiros
- Non-primary (2): Conchoraptor (review), Crichtonpelta (review —
  edge case, see corpus-paper-report.md)
- Insertion failures: 0

Spellcheck unknowns: 108 → 0 after appending 105 new terms to
`paleo-vocab.txt` (3 dedupes with prior letters). Total
paleo-vocab now 513 entries; cspell taxonomy 5,823 words.

Cumulative impact (A + B + C):
- `diagnostic_features` missing: 1,295 → 1,061 (−234, −18.1%)
- `species.holotype.material` missing: 1,062 → 855 (−207, −19.5%)

Notable corpus findings (full details in
`reports/corpus-paper-report.md`):
- 5 new sentinels, 5 new translations
- 5 binomial flags — most are taxonomic history (genus rename,
  emended endings) or OCR (G vs C); none require immediate action
- Crichtonpelta `paper_quality: review` is borderline; the paper
  *is* the formal description of the new combination
- BXGMV (Beipiao Geological Museum) not in `institutions.yaml`,
  so its catalog token wasn't stripped from Crichtonpelta's
  material — one-off, easy fix when convenient

### Letter B — 2026-05-01

Second letter through the pipeline. 65 genera total; 56 queued (1
no `described_in`, 8 no corpus markdown).

Dispatched 56 Sonnet agents in two parallel batches (28 + 28).
Apply results:

- **Applied**: 55 genera
- Sentinel: 1 (Baryonyx — charig1986 markdown is empty/boilerplate)
- Non-primary: 0
- No-data: 0
- Insertion failures: 0

Spellcheck unknowns: 97 → 0 after appending to `paleo-vocab.txt`
(95 new terms; 2 already covered by letter-A additions). Total
paleo-vocab dictionary now 408 entries; cspell taxonomy.txt 5,718
words.

Repository-wide impact (cumulative across A + B):
- `diagnostic_features` missing: 1,295 → 1,121 (−174, −13.4%)
- `species.holotype.material` missing: 1,062 → 904 (−158, −14.9%)

No data-quality issues surfaced this batch — no review/popular
miscitations, no binomial discrepancies, no insertion edge cases
beyond the empty-markdown sentinel. The mechanical-prompt approach
introduced via `build-extraction-prompts` worked exactly as
intended: prompt construction was the same for letter B as letter
A, but with no transcription errors this time.

### Letter A — _in progress_

#### Dry-run, 2026-05-01: 3 papers spanning eras

Picks: Acanthopholis (huxley1867a, 1867 prose), Abelisaurus
(bonaparte1984, 1984 review-style), Australotitan (hocknull2021, 2021
modern systematic). Output: `extracted-paper-fields-A-dryrun.json`.

**What worked:**

- Modern systematic papers (Australotitan) are the easy case — the
  agent lifted the holotype list and 6 autapomorphies almost verbatim
  from clearly delimited subsections. Almost no editing needed.
- Older prose papers (Acanthopholis, 1867) are usable: the agent
  pulled 5 distinguishing characters from descriptive text when no
  formal diagnosis existed. Quality is good but reviewer should expect
  to tighten phrasing.
- The `notes` field caught real issues every time: Latin gender
  mismatch in Acanthopholis (paper writes "horridus", our YAML has
  "horrida"); wrong paper key for Abelisaurus (the corpus's
  bonaparte1984 is a popular review, not the formal description);
  missing asterisk notation in Australotitan's marker-converted
  diagnosis. Treat agent notes as a first-class signal, not a
  footnote.

**What needs prompt or process tweaks:**

1. **Citation-correctness check.** The Abelisaurus failure is a corpus
   data issue, not an extraction issue: `described_in: bonaparte1984`
   is wrong. Add a pre-flight pass that flags suspicious mismatches —
   e.g. when the paper's title doesn't reference the genus name in any
   form, or when the agent flags "review article" / "manuscript in
   preparation" in notes. Defer the extraction for those entries until
   the citation is corrected. (Tracked separately as a citation-key
   audit; we can build this into the driver as a soft warning.)

2. **Comparative bullets.** Acanthopholis bullet #6 ("Teeth distinct
   from Scelidosaurus; dermal armour characters differ from
   Hylaeosaurus and Polacanthus") is a comparison, not a standalone
   character. Tighten the prompt: *"Avoid bullets that are purely
   comparisons to other taxa. A character must be intrinsically
   describable without naming another genus."*

3. **Bullet length on prose-era papers.** Acanthopholis bullets ran up
   to ~200 chars because the 1867 descriptions are themselves dense.
   Consider relaxing the soft cap from 150 to 200 for older papers, or
   accepting that prose-derived bullets are longer and trimming in
   review.

4. **Verbatim Latin endings.** When a paper uses a different
   gender/spelling than our YAML (e.g. "horridus" vs "horrida"), the
   agent should surface it in `notes` (it did). Add an explicit
   instruction asking the agent to flag any binomial spelling
   discrepancy it notices.

5. **Markdown conversion artifacts.** Australotitan's diagnosis used
   asterisks in the original PDF to mark autapomorphies; the marker
   tool lost them. The agent treated the full character list as
   "the taxon's differentiating combination", which is correct
   downstream but means we may be including non-autapomorphic shared
   characters. Worth a spot-check on the source PDF for high-stakes
   entries.

**Action items before fanning out:**

- [x] Refine the prompt: cap bullet length at 200 chars; instruct
      agent to flag binomial spelling discrepancies; ban
      comparative-only bullets.
- [ ] Add a citation-key audit pass to the driver: skip entries where
      the agent's `notes` flag the paper as review/popular/in-prep.
      Open a follow-up issue listing the suspicious citations.
- [ ] Hand-correct Abelisaurus' `described_in` separately (not part of
      this backfill flow).
- [ ] Build the apply script (`scripts/apply-paper-field-extractions.ts`)
      using the same string-level rewrite approach as
      `fix-reference-titles.ts`. Don't apply until human review of the
      JSON is complete.

#### Full-run learnings (in progress, batches 1–2 of ~13)

**Hard rule: agents must not leave the markdown.** First batch turned
up Achelousaurus (sampson1995.md is publisher boilerplate only, no
body text). The agent spent 23 tool uses and 118 seconds searching
PDFs, images, and other corpus paths trying to find the missing
content. That's wasted compute and risks fabrication. The prompt now
includes an explicit guardrail:

> **Read ONLY the named markdown file.** If it is empty, contains
> fewer than ~50 lines of substantive prose, or is just publisher
> boilerplate / metadata, write the sentinel JSON
> (`{ holotype_material: null, diagnostic_features: [], notes:
> "EXTRACTION FAILED: empty/boilerplate markdown" }`) and STOP. Do
> NOT explore images/, pdf_images/, pdfs/, or any other paths. Do
> NOT search the corpus for related papers.

**Two more `described_in` errors caught by the agent:**

- `Adasaurus.species[0].described_in: barsbold1977` — barsbold1977 is
  a translated evolutionary survey; Adasaurus appears only in a
  figure caption. Wrong key.
- `Ahshislesaurus.species[0].name: Ahshislesaurus mcdonaldi` —
  dalman2025 actually describes *A. wimani*. Either our species
  entry is wrong or the citation is wrong. Needs a cross-check
  against the published paper.

These are corpus/data-quality issues, not extraction failures, and
will be batched as side-findings after the A run completes. They
also confirm that the `binomial_in_paper` and `paper_quality` fields
in the schema are pulling their weight as auditing signals.

**Action items before next batch:**

- [x] Update the prompt with the "do not leave the markdown" rule.
- [x] After the run, audit `binomial_in_paper` and `paper_quality`
      fields across all 127 outputs to surface citation/data issues.

#### Full-run results (letter A)

127 papers processed in 5 parallel batches of 10–25 (one batch of 10
to test, four of 25–17). Aggregate report at
`reports/extracted-paper-fields-A.json`.

**Summary:**
- 123 successful extractions
- 4 extraction failures (`EXTRACTION FAILED` sentinel) — all
  legitimately empty/boilerplate markdown, not agent errors
- 7 OK extractions returned `holotype_material: null` (paper lacks
  an explicit Holotype subsection)
- 5 OK extractions returned `diagnostic_features: []` (paper lacks
  a diagnosis-equivalent section)
- 11 papers classified as `review` / `popular` / `translation` —
  these are likely citation problems (the corpus has the wrong
  paper, or only a translation, for the formal description)
- 4 *real* binomial discrepancies (down from 60 once we filtered
  out cosmetic noise: "gen. et sp. nov." appendages, ligatures,
  capitalisation)

**Empty-markdown failures:**
- `Achelousaurus` (sampson1995) — publisher boilerplate only
- `Altispinax` (huene1923) — publisher boilerplate only
- `Anchisaurus` (marsh1885) — BHL OCR missed the actual page; only
  a garbled "Anchisauridae" fragment in scientific intelligence
- `Astrophocaudia` (d'emic2013) — **path-encoding bug**: the
  filename uses `'` (U+2019, curly apostrophe) and the agent's
  `Read` returned permission-denied. File content is fine; needs
  a re-run with the path properly handled

**Non-primary citations to investigate (probable wrong paper):**
- `Abelisaurus / bonaparte1984` — popular review, formal
  description is Bonaparte & Novas 1985
- `Abrosaurus / ouyang1989` — corpus has English translation
- `Adasaurus / barsbold1977` — corpus has English translation;
  Adasaurus appears only in a figure caption (the paper is an
  evolutionary survey, not the species description)
- `Amargasaurus / bonaparte1984` — review only, lists Amargasaurus
  as nomen nudum "groeberi"; formal description is Salgado &
  Bonaparte 1991 (cazaui)
- `Ampelosaurus / leloeuff1995` — corpus has English translation
- `Amurosaurus / bolotsky1991` — corpus has 2011 book chapter, not
  the 1991 original
- `Andesaurus / calvo1991` — corpus has English translation
- `Antarctosaurus / huene1927b` — review; Antarctosaurus mentioned
  only in passing
- `Aralosaurus / rozhdestvensky1968` — corpus has English
  translation
- `Argentinosaurus / bonaparte1993` — corpus has English
  translation
- `Avimimus / kurzanov1981` — corpus has English translation

For pure translations (eight of these), the data should still be
extractable — translations of formal description papers preserve
the holotype/diagnosis content. The `paper_quality: translation`
flag is informational, not disqualifying. The actual problem cases
are `Abelisaurus`, `Adasaurus`, `Amargasaurus`, `Amurosaurus`, and
`Antarctosaurus` — those need citation corrections before retry.

**Real binomial discrepancies:**
- `Acanthopholis horrida` — paper writes `horridus` (Latin gender
  emendation; well-known historical issue, our YAML form is the
  modern accepted spelling)
- `Ahshislesaurus mcdonaldi` — paper writes `wimani` (likely
  wrong species in our YAML; needs cross-check)
- `Amargasaurus cazaui` — paper writes `groeberi` (artifact of the
  wrong-citation issue above)
- `Anoplosaurus curtonotus` — paper writes `Anoplesaurus
  curtonotus` (genus spelling difference; needs ICZN check)

**Cost / time:** ~127 Sonnet calls, run-time ~3 minutes wall clock
across 5 batches. Most agents used 3–7 tool calls; one outlier
(Achelousaurus pre-guardrail) used 23 before the prompt fix. After
the guardrail the maximum was 15 (Astrophocaudia, which was
struggling with the path-encoding bug).

**Next steps for letter A:**

- [x] Build `scripts/apply-paper-field-extractions.ts` and apply
      the accepted entries.
- [x] File side-finding issues: see #1862 (species-level
      diagnostics), #1863 (5 wrong `described_in` citations).
- [x] Retry Astrophocaudia with the path properly quoted.
- [ ] Hand-review the 6 `holotype_material: null` and 4 empty
      `diagnostic_features` cases — some may be salvageable from
      descriptive prose with a tighter prompt.
- [ ] Add a `holotype:` block to Agathaumas — the only insertion
      failure during apply (genus has no holotype subblock at all,
      which is a pre-existing data gap not addressed by this flow).

#### Post-run polish (2026-05-01)

Three quality fixes shipped on top of the raw extractions:

1. **Mechanical normalisation of extraction JSONs**
   (`scripts/normalize-extractions.ts`). Capitalises the leading
   ASCII letter of `holotype_material` and each
   `diagnostic_features` bullet; replaces en-dashes, em-dashes, and
   curly quotes with ASCII equivalents. Preserves semantic non-ASCII
   glyphs (°, ×, ², é, Greek letters). Idempotent. Letter-A pass
   updated 33 of 124 files with 60 changes.

2. **Spell-check pass over extractions**
   (`scripts/spellcheck-extractions.ts`). Runs cspell against
   `holotype_material` and each `diagnostic_features` bullet,
   classifies unknowns as either "suspicious shape" (digits,
   non-letter glyphs, or mixed-case in the middle — likely OCR
   garbage or typos) or "likely real terms" (legitimate paleo /
   anatomical vocabulary missing from the project dictionary).
   Letter-A: 685 snippets scanned, 0 suspicious, 347 likely terms
   surfaced for triage into `scripts/generate-dictionary.ts`
   `commonTerms`. The zero-suspicious result is a meaningful signal
   that the agent isn't introducing OCR artifacts of its own.
   Report: `reports/extracted-paper-fields-A-spellcheck.md`.

3. **Existing-corpus normalisation sweep**
   (`scripts/normalize-genera-text.ts`). Same character rules as (1)
   but applied at the file level over `genera/*/*.yml`. Defaults to
   dry-run mode and writes `reports/genera-text-normalization.md`
   with per-file change samples; pass `--apply` to write changes
   in place. Initial dry-run: 238 files, 362 replacements (207
   en-dashes, 89 em-dashes, 56 curly singles, 10 curly doubles).
   Most occurrences are in `references[].title` and `etymology`
   fields, e.g. "IV.—On Acanthopholis", "dell'Argentina",
   "Temerty — James being chairman". Apply pending review.

**Why the apply step is split into three.** The extraction JSONs,
the dictionary, and the existing YAMLs are three independent surfaces
with different review costs and rollback profiles. Keeping them as
separate scripts makes each one auditable in isolation and lets the
sweep (3) be batched into its own commit, separately from the
extraction-driven commits.

#### Specimen-ID stripping and institution-aware dictionary

The first spellcheck triage surfaced bare institution abbreviations
(`MGUAN`, `TMP`, `MACN`, `YPM`, `PIN`, ...) in the unknowns list. Two
issues were entangled:

1. The agent occasionally lifted catalog numbers verbatim into
   `holotype_material` despite the prompt asking it to drop them.
   These references duplicate the structured
   `species.holotype.specimen_id` and `species.holotype.institution`
   fields, so they were noise, not signal.
2. When abbreviations *legitimately* appear in prose (rare, but
   possible in older description papers), they should not be flagged
   as misspellings.

Two mechanical fixes addressed both:

- **`scripts/strip-specimen-ids-from-material.ts`** —
  institution-aware regex strip of catalog tokens from extraction
  `holotype_material` fields. Recognises three patterns:
  parenthetical (`(TMP 2001.26.1)`), leading prefix (`YPM 2195: …`),
  and mid-segment (`…hind limbs; PIN #3907/1; …`). Letter-A pass
  cleaned 8 entries. Defaults to dry-run; `--apply` to write.

- **`scripts/generate-dictionary.ts`** — extended to include all
  institution abbreviations (and their aliases) from
  `institutions.yaml`. Dictionary grew from 4,784 → 5,312 words.
  Provides defensive coverage so future legitimate prose mentions
  of an abbreviation don't trip the spellcheck.

Combined effect on letter-A spellcheck: 347 → 345 unknown words, 0
of which match any known institution abbreviation. The remaining
unknowns are all anatomical/paleontological vocabulary candidates
for `commonTerms` in the dictionary generator.

#### Hand-curated paleo vocabulary

The 345 unknowns left after the institution pass were a mix of
anatomical jargon (`anteroposteriorly`, `zygapophyseal`,
`vomeropterygoid`), fossil-group plurals (`alvarezsaurids`,
`velociraptorines`), lamina abbreviations (`acdl`, `acpol`), and a
small set of locality / formation names that legitimately appear in
description prose (Wealden, Uitenhage, Las Zabacheras, Udan-Sayr,
Abdrant Nuru). None looked like OCR artifacts after manual review.

These were seeded into a new flat-file dictionary,
`dictionaries/paleo-vocab.txt` (313 unique entries after
case-insensitive dedup). `scripts/generate-dictionary.ts` now reads
this file alongside `tree.yml`, `schema.yml`, `institutions.yaml`,
and the hard-coded `commonTerms` array, merging everything into the
generated `dictionaries/taxonomy.txt` that cspell consumes.

After regeneration: dictionary grew 5,312 → 5,625 words, and the
letter-A spellcheck dropped to **0 unknowns** across 685 snippets.

The split between `paleo-vocab.txt` (hand-curated, append-only) and
`taxonomy.txt` (auto-generated, never edited by hand) keeps the
review workflow simple. For future letter runs the loop is:

1. `npm run spellcheck-extractions -- --letter X`
2. Eyeball the unknowns; flag any OCR artifacts for re-extraction
3. Append the rest to `dictionaries/paleo-vocab.txt`
4. `npm run generate-dictionary`
5. Re-run spellcheck to confirm clean

#### Apply step (2026-05-01)

`scripts/apply-paper-field-extractions.ts` writes accepted
extractions back into the genus YAMLs. Filter rules: skip
EXTRACTION FAILED sentinels; skip `paper_quality: review/popular`
(citation-suspect, tracked under #1863); skip per-field if the YAML
already has it. String-level rewrite using `yaml.stringify` for the
inserted fields only — surrounding content untouched, formatting
preserved.

Letter-A apply results:

- **Applied**: 119 genera (1,467 line insertions across both fields)
- Skipped sentinel: 3 (Achelousaurus, Altispinax, Anchisaurus)
- Skipped non-primary: 4 (Abelisaurus, Amargasaurus, Amurosaurus,
  Antarctosaurus — all `paper_quality: review`)
- Skipped no-data: 1 (Adasaurus — translation but agent returned
  no usable data, figure caption only)
- Insertion failure: 1 (Agathaumas — genus has no `holotype:`
  block at all in its YAML, pre-existing data gap)

Validation post-apply: **0 errors**, 9 pre-existing unrelated
warnings.

Repository-wide impact:
- `diagnostic_features` missing: 1,295 → 1,176 (−119, −9.2%)
- `species.holotype.material` missing: 1,062 → 956 (−106, −10.0%)

Letter-A specifically:
- Material: 135 missing → 29 missing
- Diagnostic features: 146 missing → 27 missing

#### Existing-corpus text normalisation applied

`scripts/normalize-genera-text.ts --apply` swept the existing
`genera/*/*.yml` files: 238 files updated, 362 character
replacements (207 en-dashes, 89 em-dashes, 56 curly singles, 10
curly doubles).

**Gotcha worth carrying forward.** Three files broke YAML parsing
after apply because the replaced curly quotes were acting as
"scare quotes" inside otherwise-unquoted scalars. Once the curly
glyphs became ASCII delimiters, the YAML parser tried to read the
result as a quoted string and choked:

- `Bustingorrytitan.yml`: `locality: "Bustingorry II" Site` —
  re-quoted with single quotes around the whole value
- `Fulengia.yml`: `title: 'Modern' lizard from the Upper Triassic
  of China` — re-quoted with double quotes
- `Lophostropheus.yml`: a multi-line double-quoted reference title
  containing curly doubles `"Liliensternus"` — switched the outer
  scalar to single quotes so the inner doubles became content

These three needed a hand fix; `npm run validate` after `--apply`
caught all of them. For future similar sweeps, plan on running
validate as the final step and budgeting time to re-quote the
handful of scare-quote patterns it surfaces.
