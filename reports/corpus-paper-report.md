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
| Conchoraptor | `barsbold1986` | C | YAML `described_in` corrected from `maryanska2002` (a 2002 phylogenetic analysis) to `barsbold1986` (Barsbold, *Raubdinosaurier Oviraptoren*, in *Herpetologische Untersuchungen in der Mongolischen Volksrepublik*, Akademia Nauk SSSR, pp. 210–223; in German). Corpus does not yet contain `barsbold1986.md`; once added, re-run extraction. |
| Dromaeosauroides | `christiansen2003` | D | The corpus markdown filed under `christiansen2003` is a 497-line review chapter by Bonde summarising and defending the taxon, not the 2003 *Neues Jahrbuch für Geologie und Paläontologie* original description by Christiansen & Bonde. The `described_in` citation in the YAML is correct — corpus file just needs replacing with the Neues Jahrbuch paper. |
| Gigantspinosaurus | `ouyang1992` | G | YAML `described_in` corrected from `maidment2006` (a 2006 review identifying only one autapomorphy) to `ouyang1992` (Ouyang, *Discovery of Gigantspinosaurus sichanensis and its scapular spine orientation*, in *Abstracts and Summaries for Youth Academic Symposium on New Discoveries and Ideas in Stratigraphic Paleontology*, pp. 47–49; in Chinese). Corpus does not yet contain `ouyang1992.md`; once added, re-run extraction. |
| Itemirus | `kurzanov1976a` | I | The `kurzanov1976a.md` markdown describes *Alioramus remotus*, not Itemirus medullaris. Wrong-paper-content pattern. Kurzanov did publish on Itemirus (also 1976), so the citation key likely needs disambiguation. |
| Neuquensaurus | `powell1992` | N | Same paper but wrong target taxon — `powell1992.md` is a 655-line monograph describing *Saltasaurus loricatus*; *Neuquensaurus australis* is referenced only in comparison. Powell 1992 erects *Neuquensaurus* in this paper as a new genus for "Titanosaurus" australis, but the bulk of the systematic content is on *Saltasaurus*. Edge case similar to Crichtonpelta — re-running with non-primary filter relaxed should populate. |
| Pararhabdodon | `casanovascladellas1993` | P | YAML `described_in` corrected from `casanovascladellas1992` (Casanovas-Cladellas, *Novedades en el registro fósil de dinosaurios del levante español*, Zubía 10:139–151 — a regional review that does not formally erect *Pararhabdodon*) to `casanovascladellas1993` (Casanovas-Cladellas, Santafé-Llopis & Isidro-Llorens, *Pararhabdodon isonensis n. gen. n. sp. (Dinosauria)…*, Paleontologia i Evolució 26-27:121–131; in Spanish — the formal genus and species erection). `described:` year corrected from 1992 to 1993. Corpus does not yet contain `casanovascladellas1993.md`; once added, re-run extraction. |
| Protognathosaurus | `olshevsky1991`, `zhang1988` | Fixed, but additional paper not yet corpus |
| Ruehleia | `galton2001` | R | 721-line markdown but agent sentinel'd; possibly wrong-target-taxon (Galton 2001 may cover multiple sauropodomorphs). Re-investigate. |
| Yandusaurus | `he1979` | Y | YAML `described_in` corrected from `sereno1986` (a 1986 phylogenetic review using *Yandusaurus* only as a terminal taxon) to `he1979` (He, *A newly discovered ornithopod dinosaur Yandusaurus from Zigong, Sichuan*, in *Contributions to International Exchange of Geology. Part 2. Stratigraphy and paleontology*, Geological Publishing House, Beijing, pp. 116–123). Corpus does not yet contain `he1979.md`; once added, re-run extraction. |
| Euronychodon | `antunes1991` | E | French-language describing paper (Antunes & Sigogneau-Russell 1991, Comptes Rendus de l'Académie des Sciences Série II 313:113-119) is not in corpus. Bucket D Cat III intake built as a Wikipedia-paragraph-1 stub with structured fields (type species, holotype CEPUNL TV 20, locality Taveiro, Campanian-Maastrichtian) sourced from the Wikipedia article body. Once obtained, verify the holotype tooth measurements (1.8 mm, D-shaped cross-section) and paratype designations (CEPUNL TV 18, TV 19). |
| Bustingorrytitan | `salgado2023` | B | Corpus markdown is abstract-only (10 lines); body of paper not present. Diagnostic features captured during letter-B run from the abstract, but holotype material (specimen MMCh-Pv 232 fide Wikipedia) cannot be extracted. Needs full-paper re-fetch. |
| Betasuchus | `huene1932` | B | Corpus markdown is a 39-line fragment of Huene's 1932 *Die fossile Reptil-Ordnung Saurischia* monograph (covers *Caudocoelus*/*Elaphrosaurus*); the *Betasuchus bredai* section is absent. Needs the relevant monograph pages re-converted. |
| Cetiosaurus | `owen1841` | C | Corpus markdown is the proceedings abstract/summary of Owen's 1841 memoir, not the full paper; no holotype designation and the species epithet *oxoniensis* does not appear. `diagnostic_features` already populated; only `material` is blocked. Needs the full memoir. |
| Cumnoria | `seeley1888a` | C | Corpus markdown is the British Association 1887 conference abstract (binomial given as *Iguanodon Prestwichi*); no holotype subsection. `diagnostic_features` already populated; `material` not derivable from the abstract. |
| Dacentrurus | `lucas1902` | D | `described_in` points to Lucas's 1902 replacement-name note (Dacentrurus for the preoccupied *Omosaurus* Owen 1875); contains no holotype description or diagnosis. Original description is Owen 1875 (*Omosaurus armatus*) — a described_in/section-2 candidate. |
| Dryptosaurus | `marsh1877b` | D | `described_in` points to a paper where Dryptosaurus appears only in a closing footnote (replacement name for the preoccupied *Laelaps* Cope); no holotype description. Original description is Cope 1866 (*Laelaps aquilunguis*) — a described_in/section-2 candidate. |
| Elaphrosaurus | `janensch1920` | E | Corpus markdown is 69 lines of raw BHL OCR (print pages 225–235) that cuts off mid-sentence with no holotype subsection. Needs a clean re-conversion of the Janensch 1920 description. |
| Fulgurotherium | `huene1932` | F | Same `huene1932` *Saurischia* monograph fragment as Betasuchus/Magyarosaurus; the Fulgurotherium section is absent. Needs the relevant pages re-converted. |
| Magyarosaurus | `huene1932` | M | Same `huene1932` *Saurischia* monograph fragment as Betasuchus/Fulgurotherium; the Magyarosaurus section is absent. Needs the relevant pages re-converted. |
| Koshisaurus | `shibata2015b` | K | Corpus markdown lacks the Systematic Paleontology section (Holotype, Referred Material, Diagnosis subsections); only abstract and discussion are captured. Diagnostic features partly extracted during letter-K run from abstract; holotype material and formal autapomorphy list missing. Needs full-paper re-fetch. |
| Xiaosaurus | `dong1983b` | X | Corpus markdown filed under `dong1983b` describes *Dashanpulong xialong*, not *Xiaosaurus dashanpensis*. Wrong-paper-content pattern. The actual Xiaosaurus description is Dong & Tang 1983 (different paper); citation key likely needs disambiguation. |
| Zigongosaurus | `hou1976` | Z | Corpus markdown filed under `hou1976` describes *Fumeisaurus shuchangensis*, not *Zigongosaurus fuxiensis*. Wrong-paper-content pattern. The actual Zigongosaurus description is Hou, Zhao & Chu 1976 (different paper); citation key likely needs disambiguation. |

### Pending Resolution Papers

The following have been fixed/updated by the user, but have not yet been processed

| Genus | Citation key | Resolution |
|---|---|---|
| Coahuilaceratops | `loewen2010` | Fixed in corpus |
| Crichtonpelta | `arbour2015`, `lü2007b` | `arbour2015` erects the new combination, `lü2007b` is the original describing paper |
| Paranthodon | Four cited papers | Updated in corpus |
| Zapsalis | `marsh1876a`, `marsh1876b`, `larson2013` | Updated in corpus |

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

## 3. Real binomial / spelling discrepancies

Filtered from the agent's `binomial_in_paper` flags after removing
cosmetic noise (`gen. et sp. nov.`, capitalisation, ASCII↔ligature
variants). These are nomenclatural questions — the YAML and the
paper genuinely differ on a letter, and the canonical form needs a
cross-check against ICZN / current literature.

| Genus | YAML | In paper | Letter | Note |
|---|---|---|---|---|

## 4. Correct papers, but not actionable

The following papers are correct, but are not actionable. These do not need to be corrected, but may require supplemental papers to extract material description or diagnostic features.

| Genus | Citation key | Letter | Reason |
|---|---|---|---|
| Thecocoelurus | `huene1923` | T | Genus erected by Huene 1923 for material previously described by Seeley as *Thecospondylus daviesi*; review-quality paper with no novel diagnosis. Apply skipped (paper_quality=review). Real diagnostic content lives with Seeley's original *Thecospondylus* description. |

## 5. Holotype additions needing specimen_id

During paper-driven backfill, when a YAML lacks a `holotype:` block entirely but the agent's extraction has usable `holotype_material`, a new `holotype:` block is added by hand with `specimen_type` and `material` (and `status: unknown` if no catalog number is determinable from the paper). These entries need a follow-up pass to populate `specimen_id` and `institution` from the literature.

| Genus | Letter | Added during | Notes |
|---|---|---|---|
| Chiayusaurus | C | Bucket D Cat III intake | `specimen_type: holotype`, `status: unknown`, `institution: IVPP` (Beijing, per user). The full bohlin1953 corpus has now been processed; Bohlin assigned no catalog number or field designation to the type tooth ("the only specimen of importance in a small group of finds"). Verify these fields filled in by general knowledge during the initial intake: coordinates `[40.5, 96.0]` (estimated Hui-hui-p'u area, Gansu); the Aptian half of the period range (triage said only Barremian); the description's "C. asianensis Lee et al. 1997 from Hasandong Fm" mention (citation not verified against a primary source). |
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
