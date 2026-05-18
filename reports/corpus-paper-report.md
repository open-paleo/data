# Corpus Paper Quality Report

Tracks paper-corpus issues surfaced by the paper-driven backfill flow
(`reports/paper-driven-backfill.md`). Updated as each letter is
processed.

Issues are categorised below. Most need action somewhere — either a
corpus re-fetch / re-OCR (sections 1, 4), a YAML citation correction
(section 2, tracked under issue #1863), a metadata reconciliation
(section 3), or a nomenclatural cross-check (section 5).

The numeric run-level outcomes (counts applied, skipped, etc.) live
in the per-letter iteration log inside `paper-driven-backfill.md`.
This file collects only the per-paper issues worth keeping a list of
across letters.

## 1. Empty / boilerplate-only markdown

Papers where the corpus markdown contains no usable body text. The
extraction agent writes an `EXTRACTION FAILED` sentinel and the
genus is skipped at the apply step. Recoverable by re-fetching or
re-converting the source PDF; a follow-up letter pass will pick them
up automatically once the markdown is restored.

| Genus | Citation key | Letter | Reason |
|---|---|---|---|
| Amurosaurus | `bolotsky1991` | A | The corpus markdown filed under `bolotsky1991` is actually a 2011 book chapter (Bolotsky, Godefroit, Bolotsky & Atuchin in the Hadrosaurs volume), not the 1991 original. The `described_in` citation in the YAML is correct — the corpus file just needs to be replaced with Bolotsky & Kurzanov 1991, Geologiya Tikhookeanskogo obramleniya. |
| Coahuilaceratops | `loewen2010` | C | Wrong-paper-content. The current `loewen2010.md` is the 2007 Ceratopsian Symposium abstract by Lund et al. (titled "Ceratopsian remains from the Late Cretaceous Cerro del Pueblo Formation, Coahuila, Mexico"); it identifies the chasmosaurine material but does not formally erect *Coahuilaceratops* or designate a holotype. The 2010 book chapter (Loewen et al. in *New Perspectives on Horned Dinosaurs*, Indiana University Press) is the formal description and needs to replace the corpus file. |
| Conchoraptor | `barsbold1986` | C | YAML `described_in` corrected from `maryanska2002` (a 2002 phylogenetic analysis) to `barsbold1986` (Barsbold, *Raubdinosaurier Oviraptoren*, in *Herpetologische Untersuchungen in der Mongolischen Volksrepublik*, Akademia Nauk SSSR, pp. 210–223; in German). Corpus does not yet contain `barsbold1986.md`; once added, re-run extraction. |
| Dromaeosauroides | `christiansen2003` | D | The corpus markdown filed under `christiansen2003` is a 497-line review chapter by Bonde summarising and defending the taxon, not the 2003 *Neues Jahrbuch für Geologie und Paläontologie* original description by Christiansen & Bonde. The `described_in` citation in the YAML is correct — corpus file just needs replacing with the Neues Jahrbuch paper. |
| Gigantspinosaurus | `ouyang1992` | G | YAML `described_in` corrected from `maidment2006` (a 2006 review identifying only one autapomorphy) to `ouyang1992` (Ouyang, *Discovery of Gigantspinosaurus sichanensis and its scapular spine orientation*, in *Abstracts and Summaries for Youth Academic Symposium on New Discoveries and Ideas in Stratigraphic Paleontology*, pp. 47–49; in Chinese). Corpus does not yet contain `ouyang1992.md`; once added, re-run extraction. |
| Heishansaurus | `bohlin1953` | H | Markdown is missing the article body (Part I, pages 9–59 of the original); only a summary mention survives. |
| Itemirus | `kurzanov1976a` | I | The `kurzanov1976a.md` markdown describes *Alioramus remotus*, not Itemirus medullaris. Wrong-paper-content pattern. Kurzanov did publish on Itemirus (also 1976), so the citation key likely needs disambiguation. |
| Neuquensaurus | `powell1992` | N | Same paper but wrong target taxon — `powell1992.md` is a 655-line monograph describing *Saltasaurus loricatus*; *Neuquensaurus australis* is referenced only in comparison. Powell 1992 erects *Neuquensaurus* in this paper as a new genus for "Titanosaurus" australis, but the bulk of the systematic content is on *Saltasaurus*. Edge case similar to Crichtonpelta — re-running with non-primary filter relaxed should populate. |
| Paranthodon | `carroll1988` | P | Textbook reference (same as Campylodoniscus), not the original description. Original is Owen 1876 (or later — Galton & Coombs 1981 redescription). |
| Pararhabdodon | `casanovascladellas1993` | P | YAML `described_in` corrected from `casanovascladellas1992` (Casanovas-Cladellas, *Novedades en el registro fósil de dinosaurios del levante español*, Zubía 10:139–151 — a regional review that does not formally erect *Pararhabdodon*) to `casanovascladellas1993` (Casanovas-Cladellas, Santafé-Llopis & Isidro-Llorens, *Pararhabdodon isonensis n. gen. n. sp. (Dinosauria)…*, Paleontologia i Evolució 26-27:121–131; in Spanish — the formal genus and species erection). `described:` year corrected from 1992 to 1993. Corpus does not yet contain `casanovascladellas1993.md`; once added, re-run extraction. |
| Peishansaurus | `bohlin1953` | P | Same Bohlin 1953 monograph as Heishansaurus — markdown is 1057 lines but the relevant section on *Peishansaurus philemys* may not be captured, or treated as wrong-target-taxon since Bohlin described many taxa. |
| Protognathosaurus | `olshevsky1991` | P | Review-flagged — olshevsky1991 is the Dinosaur Genera List, not the primary description. Issue #1863 candidate. Original is Zhang 1988 (or whoever first described *Protognathosaurus*). |
| Ruehleia | `galton2001` | R | 721-line markdown but agent sentinel'd; possibly wrong-target-taxon (Galton 2001 may cover multiple sauropodomorphs). Re-investigate. |
| Sauroplites | `bohlin1953` | S | Same Bohlin 1953 monograph as Heishansaurus / Peishansaurus. Agent reports "markdown missing dinosaur sections (pages 19–31 with detailed Sauroplites description)" — markdown is 1057 lines but the relevant chapter isn't captured. |
| Stegosaurides | `bohlin1953` | S | Bohlin 1953 again. Agent: "only summary reference found; descriptive material on p. 66 is very brief". Likely the *Stegosaurides* section is genuinely a one-paragraph mention in the original, not a corpus problem. |
| Yandusaurus | `he1979` | Y | YAML `described_in` corrected from `sereno1986` (a 1986 phylogenetic review using *Yandusaurus* only as a terminal taxon) to `he1979` (He, *A newly discovered ornithopod dinosaur Yandusaurus from Zigong, Sichuan*, in *Contributions to International Exchange of Geology. Part 2. Stratigraphy and paleontology*, Geological Publishing House, Beijing, pp. 116–123). Corpus does not yet contain `he1979.md`; once added, re-run extraction. |
| Zapsalis | `marsh1877c` | Z | Markdown 78 lines but agent reports "target taxon not found in paper". Wrong-paper-content pattern — `marsh1877c` may describe different taxa, or the *Zapsalis* portion didn't render. Re-investigate: Marsh 1877 has multiple papers and one of them is the *Zapsalis abradens* description. |
| Embasaurus | `riabinin1931` | E | Russian-language describing paper (Riabinin 1931, Trudy GGRU 78:1-8) is not in corpus and was reported as not easily obtainable. Bucket D Cat III intake built as a Wikipedia-paragraph-1 stub; reference metadata cited from secondary literature. Once obtained, re-extract for holotype number, autapomorphies (if any), and verify the Berriasian age assignment against the Neocomian Sands description. |
| Euronychodon | `antunes1991` | E | French-language describing paper (Antunes & Sigogneau-Russell 1991, Comptes Rendus de l'Académie des Sciences Série II 313:113-119) is not in corpus. Bucket D Cat III intake built as a Wikipedia-paragraph-1 stub with structured fields (type species, holotype CEPUNL TV 20, locality Taveiro, Campanian-Maastrichtian) sourced from the Wikipedia article body. Once obtained, verify the holotype tooth measurements (1.8 mm, D-shaped cross-section) and paratype designations (CEPUNL TV 18, TV 19). |
| Bustingorrytitan | `salgado2023` | B | Corpus markdown is abstract-only (10 lines); body of paper not present. Diagnostic features captured during letter-B run from the abstract, but holotype material (specimen MMCh-Pv 232 fide Wikipedia) cannot be extracted. Needs full-paper re-fetch. |
| Koshisaurus | `shibata2015b` | K | Corpus markdown lacks the Systematic Paleontology section (Holotype, Referred Material, Diagnosis subsections); only abstract and discussion are captured. Diagnostic features partly extracted during letter-K run from abstract; holotype material and formal autapomorphy list missing. Needs full-paper re-fetch. |
| Xiaosaurus | `dong1983b` | X | Corpus markdown filed under `dong1983b` describes *Dashanpulong xialong*, not *Xiaosaurus dashanpensis*. Wrong-paper-content pattern. The actual Xiaosaurus description is Dong & Tang 1983 (different paper); citation key likely needs disambiguation. |
| Zigongosaurus | `hou1976` | Z | Corpus markdown filed under `hou1976` describes *Fumeisaurus shuchangensis*, not *Zigongosaurus fuxiensis*. Wrong-paper-content pattern. The actual Zigongosaurus description is Hou, Zhao & Chu 1976 (different paper); citation key likely needs disambiguation. |

### Pending Resolution Papers

The following have been fixed/updated by the user, but have not yet been processed

| Genus | Citation key | Resolution |
|---|---|---|

## 2. Wrong `described_in` citations

The genus YAML's `described_in` points to the wrong paper — typically
a popular review, evolutionary survey, or unrelated monograph that
mentions the genus in passing rather than the formal description.
The agent's `paper_quality` flag (`review` / `popular`) caught these
and the apply script skipped them.

Tracked centrally as **issue #1863**. Each entry needs the YAML
updated (correct `described_in`, add the right paper to
`references:`); a re-extraction can then run for that genus.

| Genus | Current key | Problem | Likely correct paper |
|---|---|---|---|
| Crichtonpelta | `arbour2015` | Keep `arbour2015` as `described_in` — Arbour 2015 is the formal erection of the *Crichtonpelta benxiensis* combination (re-assigned from *Crichtonsaurus benxiensis*). Re-run extraction without the non-primary filter so the existing markdown is processed. Original *species* description is Lü et al. 2007 (*Crichtonsaurus*); not required for the genus YAML. |

## 3. Real binomial / spelling discrepancies

Filtered from the agent's `binomial_in_paper` flags after removing
cosmetic noise (`gen. et sp. nov.`, capitalisation, ASCII↔ligature
variants). These are nomenclatural questions — the YAML and the
paper genuinely differ on a letter, and the canonical form needs a
cross-check against ICZN / current literature.

| Genus | YAML | In paper | Letter | Note |
|---|---|---|---|---|
| Efraasia | *minor* | *Efraasia diagnostica* | E | Galton 1973 used species epithet *diagnostica*; current accepted form is *minor*. Verify nomenclatural history — possibly subsumed into the older *Sellosaurus minor* via species reassignment. |
| **Gravitholus** | *Stegoceras novomexicanum* | *Gravitholus albertae* | G | **Real data bug** — *Gravitholus*'s type species is *albertae* (Wall & Galton 1979), not *Stegoceras novomexicanum*. The current YAML entry appears mis-keyed; needs hand correction. |

## 4. Correct papers, but not actionable

The following papers are correct, but are not actionable. These do not need to be corrected, but may require supplemental papers to extract material description or diagnostic features.

| Genus | Citation key | Letter | Reason |
|---|---|---|---|
| Microceratus | `mateus2008` + `bohlin1953` | M | `mateus2008` is a 1-page nomenclatural note renaming *Microceratops* Bohlin 1953 (preoccupied by an ichneumon wasp) to *Microceratus*; carries no diagnosis. The original description is `bohlin1953` (Bohlin, *Fossil reptiles from Mongolia and Kansu*, Reports from the Scientific Expedition to the North-western Provinces of China under Leadership of Dr. Sven Hedin, vol. 37, 113 pp), now added as a secondary reference. Note: much of the original Bohlin material has since been reassigned to *Graciliceratops*; only the type specimen carries the *Microceratus* name. Re-run extraction with `bohlin1953` once the corpus contains the Microceratus-relevant section. |
| Thecocoelurus | `huene1923` | T | Genus erected by Huene 1923 for material previously described by Seeley as *Thecospondylus daviesi*; review-quality paper with no novel diagnosis. Apply skipped (paper_quality=review). Real diagnostic content lives with Seeley's original *Thecospondylus* description. |

## 5. Holotype additions needing specimen_id

During paper-driven backfill, when a YAML lacks a `holotype:` block entirely but the agent's extraction has usable `holotype_material`, a new `holotype:` block is added by hand with `specimen_type` and `material` (and `status: unknown` if no catalog number is determinable from the paper). These entries need a follow-up pass to populate `specimen_id` and `institution` from the literature.

| Genus | Letter | Added during | Notes |
|---|---|---|---|
| Chiayusaurus | C | Bucket D Cat III intake | `specimen_type: holotype`, `status: unknown`, `institution: IVPP` (Beijing, per user). The available `bohlin1953.md` corpus omits the systematic-description section (p. 45) where Bohlin gives the catalog number and full diagnosis; only the front matter, Chelonia, and summary chapters were captured. User has a hardcopy of Bohlin 1953 on order — once scanned/processed, re-extract for `specimen_id` and any autapomorphies. Same time, verify these fields filled in by general knowledge during the initial intake: coordinates `[40.5, 96.0]` (estimated location of Hui-hui-p'u area in western Gansu); the Aptian half of the period range (triage said only Barremian); the description's "C. asianensis Lee et al. 1997 from Hasandong Fm" mention (citation not verified against a primary source). |
| Calamospondylus | C | letter C run | `specimen_type: holotype`, `status: lost`. Fox 1866 (anonymous notice in *The Geologist*) described the taxon on a sacrum and partial ilia from the Wealden of the Isle of Wight; the specimen has long been lost. No catalog number was assigned at the time of description. |

## Resolved false positives (kept as a checklist)

These were initially flagged as discrepancies but turned out to be
process or data artifacts, not real issues. Recorded so future runs
know to gut-check similar patterns:

- **Anoplosaurus / Anoplesaurus curtonotus** (seeley1879, A): single
  OCR misread in the paper's title line. Body uses *Anoplosaurus*
  consistently (7+ occurrences). Lesson: when the agent flags a
  binomial mismatch, gut-check whether the alternative form appears
  more than once in the markdown before treating it as a real
  nomenclatural issue.
- **Craterosaurus / Graterosaurus pottonensis** (seeley1874, C):
  same pattern — single OCR misread of capital C → G. The body
  consistently uses *Craterosaurus*.
- **Dandakosaurus / Dandakosaurus inducus** (yadagiri1982, D),
  **Dongyangopelta / Dongyangopelta yangyananensis** (chen2013, D),
  **Dongyangosaurus / Dongyungosaurus sinensis** (lü2008b, D),
  **Dromaeosaurus / Dromæzosaurus albertensis** (matthew1922, D):
  all single-glyph OCR misreads (i/u, a/n inserted, n/u, æz for
  ae). Body of each paper uses the canonical YAML form.
- **Coloradisaurus / Coloradia brevis** (bonaparte1978, C): not an
  OCR issue but historical taxonomy — the original genus name was
  *Coloradia*, replaced by *Coloradisaurus* (Lambert 1983) when
  *Coloradia* was found preoccupied. Listed under translations
  above for traceability.
- **Ahshislesaurus mcdonaldi** vs *wimani* and **Athenar
  antiquitatum** vs *bermani* (both A): both were caused by
  hand-typing species names into dispatch prompts instead of
  interpolating from the work-queue file. The agent dutifully
  flagged each; both entries were re-run with the correct names.
  The `build-extraction-prompts.ts` script now eliminates this
  class of error by emitting prompts mechanically from parsed YAML.
