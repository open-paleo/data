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
| Abelisaurus | `bonaparte1985b` | A | YAML `described_in` corrected from `bonaparte1984` (a popular Italian review book chapter) to `bonaparte1985b` (Bonaparte & Novas, *Abelisaurus comahuensis, n.g., n.sp., Carnosauria del Crétacico Tardio de Patagonia*, Ameghiniana, 21: 259–265; in Spanish). The `b` suffix disambiguates from `bonaparte1985` (sole-author Bonaparte 1985 NGR paper describing Carnotaurus). `described:` year corrected from 1984 to 1985. Corpus does not yet contain `bonaparte1985b.md`; once added, re-run extraction. |
| Amargasaurus | `salgado1991` | A | YAML `described_in` corrected from `bonaparte1984` (a popular Italian review listing *Amargasaurus* as nomen nudum "A. groeberi") to `salgado1991` (Salgado & Bonaparte, *Un nuevo sauropodo Dicraeosauridae, Amargasaurus cazaui gen. et sp. nov.*, Ameghiniana, 28(3–4): 333–346; in Spanish — the formal description). `described:` year corrected from 1984 to 1991. Corpus does not yet contain `salgado1991.md`; once added, re-run extraction. |
| Altispinax | `huene1923` + `dames1885` | A | `described_in` (`huene1923`) is the formal genus-erection paper and is correct as-is — Huene 1923 erects *Altispinax* by reassigning *Megalosaurus dunkeri* (Dames 1885). Dames 1885 (the original species description) has been added as a secondary reference. The 1923 paper has only a brief embedded genus erection (no holotype subsection, no diagnosis), which triggered the agent's review-flag. Corpus does not yet contain `dames1885.md`; once added, re-run extraction with **both** the `huene1923` and `dames1885` papers (and without the non-primary filter on the `huene1923` side) so the species-level material from Dames merges with the genus-level erection from Huene. |
| Amurosaurus | `bolotsky1991` | A | The corpus markdown filed under `bolotsky1991` is actually a 2011 book chapter (Bolotsky, Godefroit, Bolotsky & Atuchin in the Hadrosaurs volume), not the 1991 original. The `described_in` citation in the YAML is correct — the corpus file just needs to be replaced with Bolotsky & Kurzanov 1991, Geologiya Tikhookeanskogo obramleniya. |
| Antarctosaurus | `huene1929` | A | YAML `described_in` corrected from `huene1927b` to `huene1929` (Huene 1929, *Los saurisquios y ornitisquios del Cretáceo Argentino*, Anales del Museo de La Plata, series 3, vol. 3, pp. 1–196). Corpus does not yet contain `huene1929.md`; once added, re-run extraction. |
| Campylodoniscus | `carroll1988` | C | Textbook reference, not the original description. |
| Coahuilaceratops | `loewen2010` | C | The corpus markdown filed under `loewen2010` is actually a 2007 symposium short paper (compiled by Braman, Royal Tyrrell Museum) predating the formal description. The `described_in` citation in the YAML is correct — corpus needs the 2010 book chapter (Loewen et al., *New Perspectives on Horned Dinosaurs*, Indiana University Press, pp. 99–116). YAML reference fields also corrected from journal to book at this time. |
| Conchoraptor | `barsbold1986` | C | YAML `described_in` corrected from `maryanska2002` (a 2002 phylogenetic analysis) to `barsbold1986` (Barsbold, *Raubdinosaurier Oviraptoren*, in *Herpetologische Untersuchungen in der Mongolischen Volksrepublik*, Akademia Nauk SSSR, pp. 210–223; in German). Corpus does not yet contain `barsbold1986.md`; once added, re-run extraction. |
| Dromaeosauroides | `christiansen2003` | D | The corpus markdown filed under `christiansen2003` is a 497-line review chapter by Bonde summarising and defending the taxon, not the 2003 *Neues Jahrbuch für Geologie und Paläontologie* original description by Christiansen & Bonde. The `described_in` citation in the YAML is correct — corpus file just needs replacing with the Neues Jahrbuch paper. |
| Dromiceiomimus | `russell1972` + `parks1926` | D | `described_in` (`russell1972`) is the genus-erection paper and is correct as-is. Parks 1926 (the original *Struthiomimus brevetertius* description, reassigned to *Dromiceiomimus* by Russell) has been added as a secondary reference. Corpus does not yet contain `parks1926.md`; once added, re-run extraction with **both** the `russell1972` and `parks1926` papers so the species-level material from Parks merges with the genus-level diagnosis from Russell. |
| Eucamerotus | `hulke1872` | E | YAML `described_in` corrected from `marsh1882` (1882 classification listing *Eucamerotus* as a bare name) to `hulke1872` (Hulke, *Appendix to a "Note on a new and undescribed Wealden Vertebra"*, Quarterly Journal of the Geological Society, 28(1–2): 36–38, doi:10.1144/GSL.JGS.1872.028.01-02.15) — the genus name was first assigned in this 1872 appendix. The earlier Hulke 1870 paper that first describes the material (without naming the genus) has also been added as a secondary reference. `described:` year corrected from 1871 to 1872. Corpus does not yet contain `hulke1872.md`; once added, re-run extraction. |
| Gigantspinosaurus | `ouyang1992` | G | YAML `described_in` corrected from `maidment2006` (a 2006 review identifying only one autapomorphy) to `ouyang1992` (Ouyang, *Discovery of Gigantspinosaurus sichanensis and its scapular spine orientation*, in *Abstracts and Summaries for Youth Academic Symposium on New Discoveries and Ideas in Stratigraphic Paleontology*, pp. 47–49; in Chinese). Corpus does not yet contain `ouyang1992.md`; once added, re-run extraction. |
| Laplatasaurus | `huene1929` | L | YAML `described_in` corrected from `huene1927b` ("Short review of the present knowledge of the Sauropoda", a different Huene 1927 paper that did not describe *Laplatasaurus*) to `huene1929` (Huene, *Los saurisquios y ornitisquios del Cretáceo Argentino*, Anales del Museo de La Plata, series 3, vol. 3, pp. 1–196; in Spanish — the first formal description). The 1927 naming paper (`huene1927c` — *Sichtung der Grundlagen der jetzigen Kenntnis der Sauropoden*, Eclogae Geologica Helveticae) has been added as a secondary reference; this is the paper in which the *Laplatasaurus* name was first introduced. `described:` year corrected from 1927 to 1929. Corpus does not yet contain `huene1929.md`; once added, re-run extraction. |
| Heishansaurus | `bohlin1953` | H | Markdown is missing the article body (Part I, pages 9–59 of the original); only a summary mention survives. |
| Itemirus | `kurzanov1976a` | I | The `kurzanov1976a.md` markdown describes *Alioramus remotus*, not Itemirus medullaris. Wrong-paper-content pattern. Kurzanov did publish on Itemirus (also 1976), so the citation key likely needs disambiguation. |
| Neuquensaurus | `powell1992` | N | Same paper but wrong target taxon — `powell1992.md` is a 655-line monograph describing *Saltasaurus loricatus*; *Neuquensaurus australis* is referenced only in comparison. Powell 1992 erects *Neuquensaurus* in this paper as a new genus for "Titanosaurus" australis, but the bulk of the systematic content is on *Saltasaurus*. Edge case similar to Crichtonpelta — re-running with non-primary filter relaxed should populate. |
| Paranthodon | `carroll1988` | P | Textbook reference (same as Campylodoniscus), not the original description. Original is Owen 1876 (or later — Galton & Coombs 1981 redescription). |
| Pararhabdodon | `casanovascladellas1992` | P | 273-line markdown but agent sentinel'd; possibly translation/non-English issue or wrong-content. Re-investigate corpus markdown. |
| Pawpawsaurus | `lee1996` | P | Markdown only 28 lines — abstract-only; body of Lee 1996 not captured. |
| Peishansaurus | `bohlin1953` | P | Same paper as Heishansaurus (and now Pawpawsaurus pattern) — Bohlin 1953 markdown is 1057 lines but the relevant section on *Peishansaurus philemys* may not be captured, or treated as wrong-target-taxon since Bohlin described many taxa. |
| Phuwiangvenator | `samathi2019` | P | Markdown only 14 lines — abstract-only. |
| Piatnitzkysaurus | `bonaparte1979a` | P | Same paper as Patagosaurus (which extracted successfully). 96 lines of markdown; agent sentinel'd Piatnitzkysaurus side. Likely the paper's Piatnitzkysaurus content is sparse compared to Patagosaurus. |
| Plateosaurus | `sander1992` | P | 907-line paleohistology paper, not the original description. The original Plateosaurus description is Meyer 1837. Issue #1863 candidate. |
| Prosaurolophus | `brown1916` | P | 175-line markdown but agent sentinel'd; investigate. Brown 1916 is the original description so content should be there. |
| Protognathosaurus | `olshevsky1991` | P | Review-flagged — olshevsky1991 is the Dinosaur Genera List, not the primary description. Issue #1863 candidate. Original is Zhang 1988 (or whoever first described *Protognathosaurus*). |
| Protohadros | `head1998` | P | Markdown only 64 lines; borderline sentinel. Re-investigate. |
| Ruehleia | `galton2001` | R | 721-line markdown but agent sentinel'd; possibly wrong-target-taxon (Galton 2001 may cover multiple sauropodomorphs). Re-investigate. |
| Sauroplites | `bohlin1953` | S | Same Bohlin 1953 monograph as Heishansaurus / Peishansaurus. Agent reports "markdown missing dinosaur sections (pages 19–31 with detailed Sauroplites description)" — markdown is 1057 lines but the relevant chapter isn't captured. |
| Spinops | `farke2011` | S | Markdown only 12 lines — abstract or stub-only; body of Farke et al. 2011 not captured. |
| Stegosaurides | `bohlin1953` | S | Bohlin 1953 again. Agent: "only summary reference found; descriptive material on p. 66 is very brief". Likely the *Stegosaurides* section is genuinely a one-paragraph mention in the original, not a corpus problem. |
| Stenopelix | `meyer1857` | S | Markdown 102 lines but agent sentinel'd as boilerplate. Re-investigate — Meyer 1857 is the original *Stenopelix* description so substantive content should exist. |
| Struthiosaurus | `bunzel1870` | S | Markdown only 26 lines — abstract/header-only; body of Bunzel 1870 not captured. |
| Telmatosaurus | `nopcsa1903` | T | Markdown 70 lines but agent sentinel'd. Re-investigate — Nopcsa 1903 is the original *Telmatosaurus transsylvanicus* description so substantive content should exist. |
| Tochisaurus | `kurzanov1991` | T | Markdown only 10 lines — abstract/stub-only; body of Kurzanov & Osmólska 1991 not captured. |
| Tornieria | `sternfeld1911` | T | Markdown only 31 lines — abstract/header-only; body of Sternfeld 1911 not captured. |
| Vagaceratops | `farke2011` | V | Same Farke et al. 2011 markdown as Spinops — only 12 lines, abstract/stub-only. |
| Vayuraptor | `samathi2019` | V | Same Samathi et al. 2019 markdown as Phuwiangvenator — abstract-only (14 lines). |
| Wulagasaurus | `godefroit2008` | W | Markdown only 14 lines — abstract/stub-only. |
| Xixiasaurus | `lü2010` | X | Markdown only 10 lines — abstract/stub-only; body of Lü et al. 2010 not captured. |
| Yandusaurus | `he1979` | Y | YAML `described_in` corrected from `sereno1986` (a 1986 phylogenetic review using *Yandusaurus* only as a terminal taxon) to `he1979` (He, *A newly discovered ornithopod dinosaur Yandusaurus from Zigong, Sichuan*, in *Contributions to International Exchange of Geology. Part 2. Stratigraphy and paleontology*, Geological Publishing House, Beijing, pp. 116–123). Corpus does not yet contain `he1979.md`; once added, re-run extraction. |
| Zapsalis | `marsh1877c` | Z | Markdown 78 lines but agent reports "target taxon not found in paper". Wrong-paper-content pattern — `marsh1877c` may describe different taxa, or the *Zapsalis* portion didn't render. Re-investigate: Marsh 1877 has multiple papers and one of them is the *Zapsalis abradens* description. |

### Pending Resolution Papers

The following have been fixed/updated by the user, but have not yet been processed

| Genus | Citation key | Resolution |
|---|---|---|
| Crichtonpelta | `arbour2015` | Keep `arbour2015` as `described_in` — Arbour 2015 is the formal erection of the *Crichtonpelta benxiensis* combination (re-assigned from *Crichtonsaurus benxiensis*). Re-run extraction without the non-primary filter so the existing markdown is processed. Original *species* description is Lü et al. 2007 (*Crichtonsaurus*); not required for the genus YAML. |

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
| Altispinax | `huene1923` | New genus erected in a single sentence within a broad review of Carnosauria — no holotype subsection, no catalog number, no diagnosis. The 1923 paper is the formal genus erection (renaming *Megalosaurus dunkeri* Dames 1884), so it is taxonomically valid; the agent's review-flag was triggered by the brief, embedded format. Edge case similar to Crichtonpelta and Dromiceiomimus. | huene1923 (this one) for the genus; Dames 1884 for the original *dunkeri* species description. |
| Dromiceiomimus | `russell1972` | Systematic revision — Russell 1972 erects *Dromiceiomimus* as a new genus by reassigning Parks 1926's *Struthiomimus brevitertius*. Edge case similar to Crichtonpelta: this *is* the formal genus erection. | russell1972 (this one). Auto-skip was conservative; re-run without non-primary filter to populate. |

## 3. Real binomial / spelling discrepancies

Filtered from the agent's `binomial_in_paper` flags after removing
cosmetic noise (`gen. et sp. nov.`, capitalisation, ASCII↔ligature
variants). These are nomenclatural questions — the YAML and the
paper genuinely differ on a letter, and the canonical form needs a
cross-check against ICZN / current literature.

| Genus | YAML | In paper | Letter | Note |
|---|---|---|---|---|
| Amargasaurus | *cazaui* | *groeberi* | A | Artifact of the wrong-citation issue (#1863) — the corpus paper lists *A.* as nomen nudum *groeberi*. Will resolve once the citation is corrected. |
| Efraasia | *minor* | *Efraasia diagnostica* | E | Galton 1973 used species epithet *diagnostica*; current accepted form is *minor*. Verify nomenclatural history — possibly subsumed into the older *Sellosaurus minor* via species reassignment. |
| **Gravitholus** | *Stegoceras novomexicanum* | *Gravitholus albertae* | G | **Real data bug** — *Gravitholus*'s type species is *albertae* (Wall & Galton 1979), not *Stegoceras novomexicanum*. The current YAML entry appears mis-keyed; needs hand correction. |

## 4. Correct papers, but not actionable

The following papers are correct, but are not actionable. These do not need to be corrected, but may require supplemental papers to extract material description or diagnostic features.

| Genus | Citation key | Letter | Reason |
|---|---|---|---|
| Microceratus | `mateus2008` | M | Right paper, but Microceratus was declared *nomen dubium* (Sereno 2000) — the citation is a nomenclatural note acknowledging the holotype lacks diagnostic features. No diagnosis to extract. (Not a corpus issue — flagging here so the genus isn't picked up by future re-runs.) |
| Thecocoelurus | `huene1923` | T | Genus erected by Huene 1923 for material previously described by Seeley as *Thecospondylus daviesi*; review-quality paper with no novel diagnosis. Apply skipped (paper_quality=review). Real diagnostic content lives with Seeley's original *Thecospondylus* description. |

## 5. Holotype additions needing specimen_id

During paper-driven backfill, when a YAML lacks a `holotype:` block entirely but the agent's extraction has usable `holotype_material`, a new `holotype:` block is added by hand with `specimen_type` and `material` (and `status: unknown` if no catalog number is determinable from the paper). These entries need a follow-up pass to populate `specimen_id` and `institution` from the literature.

| Genus | Letter | Added during | Notes |
|---|---|---|---|
| Pleurocoelus | P | letter P run | `specimen_type: syntype`, `status: unknown`. Marsh 1888 syntype series; modern literature places material at YPM. |
| Pterospondylus | P | letter P run | `specimen_type: holotype`, `status: unknown`. Jaekel 1914 single dorsal vertebra; original German specimen, modern depository likely GPIT or Berlin MfN. |
| Troodon | T | letter T run | `status: unknown`. Leidy 1856 described from a single tooth without a formal catalog number; tooth has historically been considered lost or destroyed and the original specimen has no surviving museum identifier. |

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
