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

| Genus | Citation key | Letter | Reason | User Notes |
|---|---|---|---|
| Anchisaurus | `marsh1885` | A | BHL OCR missed the actual page (Marsh 1885 sits on p. 169 of a long journal volume); only a garbled "Anchisauridae" fragment remains. |
| Camptosaurus | `marsh1885` | C | Same BHL OCR issue as Anchisaurus — Marsh 1885 page not captured. |
| Campylodoniscus | `carroll1988` | C | Textbook reference, not the original description. |
| Heishansaurus | `bohlin1953` | H | Markdown is missing the article body (Part I, pages 9–59 of the original); only a summary mention survives. |
| Hoplitosaurus | `lucas1902` | H | Empty / boilerplate-only markdown. |
| Itemirus | `kurzanov1976a` | I | The `kurzanov1976a.md` markdown describes *Alioramus remotus*, not Itemirus medullaris. Wrong-paper-content pattern. Kurzanov did publish on Itemirus (also 1976), so the citation key likely needs disambiguation. |
| Lanzhousaurus | `you2005a` | L | The `you2005a.md` markdown describes *Auroraceratops rugosus*, not Lanzhousaurus magnidens. Wrong-paper-content pattern — the citation key should point to You et al. 2005 on Lanzhousaurus (different paper). |
| Liaoningvenator | `shen2017` | L | The `shen2017.md` markdown describes *Daliansaurus liaoningensis*, not Liaoningvenator curriei. Wrong-paper-content pattern — Liaoningvenator was named by Shen et al. 2017a in *Acta Geologica Sinica* (different Shen 2017 paper). |
| Lavocatisaurus | `canudo2018` | L | Markdown is abstract-only (12 lines); the systematic palaeontology body is missing from the corpus copy. |
| Lepidus | `nesbitt2015` | L | Markdown is abstract-only (10 lines); systematic palaeontology body is missing from the corpus copy. |
| Macrurosaurus | `seeley1869` | M | Abstract / boilerplate-only markdown (26 lines); main paper body absent. |
| Microceratus | `mateus2008` | M | Right paper, but Microceratus was declared *nomen dubium* (Sereno 2000) — the citation is a nomenclatural note acknowledging the holotype lacks diagnostic features. No diagnosis to extract. (Not a corpus issue — flagging here so the genus isn't picked up by future re-runs.) |
| Narambuenatitan | `filippi2011` | N | Markdown is abstract-only (14 lines); systematic palaeontology body absent. |
| Nebulasaurus | `xing2013` | N | Markdown is abstract-only (10 lines); systematic palaeontology body absent. |
| Niobrarasaurus | `carpenter1995` | N | Markdown is abstract-only (30 lines); main paper body absent. |
| Nodocephalosaurus | `sullivan1999` | N | Markdown is abstract-only (26 lines); main paper body absent. |
| Nigersaurus | `sereno1999` | N | The `sereno1999.md` markdown contains text from unrelated papers on laser physics, x-ray sources, and neuroscience — not the Nigersaurus description. Wrong-paper-content pattern (Sereno 1999 *Science*-issue page mismatch from publisher PDF/OCR). |
| Neuquensaurus | `powell1992` | N | Same paper but wrong target taxon — `powell1992.md` is a 655-line monograph describing *Saltasaurus loricatus*; *Neuquensaurus australis* is referenced only in comparison. Powell 1992 erects *Neuquensaurus* in this paper as a new genus for "Titanosaurus" australis, but the bulk of the systematic content is on *Saltasaurus*. Edge case similar to Crichtonpelta — re-running with non-primary filter relaxed should populate. |

### Pending Resolution Papers

The following have been fixed/updated by the user, but have not yet been processed

| Genus | Citation key | User Notes |
|---|---|---|---|
| Hypsibema | `cope1869a` | Not empty, just a short description |
| Mononykus | `perle1993` | A new paper, perle1993a, has been added with the actual description (perle1993a is the nomenclature correction) |
| Musankwa | `barrett2024` | Corpus paper has been fixed |
| Nemegtomaia | `lü2005b` | A new paper, lu2004 has been added with the actual description (lu2005b is the nomenclature correction) |

### Resolved Papers

Resolved (corpus paper updated and re-extracted on 2026-05-01):
Achelousaurus (`sampson1995`), Baryonyx (`charig1986`), Camarillasaurus
(`sánchez-hernández2012`), Chaoyangsaurus (`xijin1999`), Cruxicheiros
(`benson2010`), Daxiatitan (`you2008`), Einiosaurus (`sampson1995`),
Eocarcharia (`sereno2008a`), Galvesaurus (`barco2005`), Invictarx
(`mcdonald2018`). Altispinax (`huene1923`) re-extracted but moved to
section 2 — see below.

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
| Abelisaurus | `bonaparte1984` | Popular Italian review book; cites the formal description as a manuscript in preparation. | Bonaparte & Novas 1985 |
| Adasaurus | `barsbold1977` | Translated evolutionary survey; *Adasaurus* appears only in a figure caption. | Barsbold 1983 (or wherever the formal description is) |
| Altispinax | `huene1923` | New genus erected in a single sentence within a broad review of Carnosauria — no holotype subsection, no catalog number, no diagnosis. The 1923 paper is the formal genus erection (renaming *Megalosaurus dunkeri* Dames 1884), so it is taxonomically valid; the agent's review-flag was triggered by the brief, embedded format. Edge case similar to Crichtonpelta and Dromiceiomimus. | huene1923 (this one) for the genus; Dames 1884 for the original *dunkeri* species description. |
| Amargasaurus | `bonaparte1984` | Same review book as Abelisaurus; lists *Amargasaurus* as nomen nudum *"A. groeberi"*. | Salgado & Bonaparte 1991 (*A. cazaui*) |
| Amurosaurus | `bolotsky1991` | Corpus has a 2011 book chapter, not the 1991 original. | Bolotsky & Kurzanov 1991 |
| Antarctosaurus | `huene1927b` | Broader review; *Antarctosaurus* mentioned only in passing. | Huene 1929 (Anales del Museo de La Plata) |
| Laplatasaurus | `huene1927b` | Same broad sauropod review as Antarctosaurus. *Laplatasaurus* announced as forthcoming; formal description is in Huene 1929 monograph (*Anales del Museo de La Plata*). | Huene 1929 (Anales del Museo de La Plata) |
| Coahuilaceratops | `loewen2010` | 2007 symposium short paper predating the formal description (compiled by Braman, Royal Tyrrell Museum). | The 2010 formal description (Loewen et al., New Perspectives on Horned Dinosaurs) — likely a different file in the corpus. |
| Conchoraptor | `maryanska2002` | Phylogenetic analysis of Oviraptorosauria — not the primary description. *Conchoraptor* is used as a terminal taxon. | Barsbold 1986 (original description). |
| Crichtonpelta | `arbour2015` | Edge case — agent classified as "review" because it's a broad ankylosaurid revision, but the new combination *Crichtonpelta benxiensis* is formally erected here (re-assigned from *Crichtonsaurus benxiensis*). The data the agent extracted is fine; the auto-skip was conservative. Consider re-running this one without the non-primary filter. | arbour2015 (this one) for the *combination*; original species description is Lü et al. 2007 (*Crichtonsaurus*). |
| Dromaeosauroides | `christiansen2003` | Review chapter by Bonde (not Christiansen) summarising and defending the taxon. | Christiansen & Bonde 2003 original description. |
| Dromiceiomimus | `russell1972` | Systematic revision — Russell 1972 erects *Dromiceiomimus* as a new genus by reassigning Parks 1926's *Struthiomimus brevitertius*. Edge case similar to Crichtonpelta: this *is* the formal genus erection. | russell1972 (this one). Auto-skip was conservative; re-run without non-primary filter to populate. |
| Eucamerotus | `marsh1882` | *Eucamerotus* appears only as a bare name in a list of European sauropod genera. No description, no diagnosis. | The original description is Hulke 1872 (or later — verify). marsh1882 is not a description paper at all. |
| Gigantspinosaurus | `maidment2006` | Taxonomic review — not the original description. Identifies only one confirmed autapomorphy. | Ouyang 1992 (original description). |

## 3. Translations of formal descriptions

The cited paper key resolves to an English translation of an
originally non-English formal description. Translations preserve
holotype and diagnosis content, so the data is usable — but the
metadata is misleading (the citation key implies the translator's
year, not the formal-description year). Worth reconciling: link
both the original paper and the translation in the genus YAML's
`references:`, and point `described_in` at the original.

| Genus | Citation key | Letter | Translation of |
|---|---|---|---|
| Abrosaurus | `ouyang1989` | A | Chinese (Zigong Dinosaur Museum Newsletter) |
| Ampelosaurus | `leloeuff1995` | A | French (Comptes Rendus) — translated by M. C. Lamanna |
| Andesaurus | `calvo1991` | A | Spanish (Ameghiniana) — translated by J. A. Wilson |
| Aralosaurus | `rozhdestvensky1968` | A | Russian (monograph) |
| Argentinosaurus | `bonaparte1993` | A | Spanish (Ameghiniana) — translated by M. C. Lamanna |
| Avimimus | `kurzanov1981` | A | Russian (Trudy SSMPE) |
| Bellusaurus | `dong1990` | B | Chinese (Vertebrata PalAsiatica vol. 28 no. 1) — translated by Will Downs (1992) |
| Ceratonykus | `alifanov2009` | C | Russian (Paleontologicheskii Zhurnal) — English translation, DOI 10.1134/S0031030109010109 |
| Chuanjiesaurus | `fang2000` | C | Chinese (2000 stratigraphic congress proceedings) — translated by Will Downs (2002) |
| Chungkingosaurus | `dong1983a` | C | Chinese (Dong, Zhou & Zhang 1983 monograph) — translated by Will Downs (1999) |
| Coloradisaurus | `bonaparte1978` | C | Original 1978 paper used name *Coloradia brevis* — name replaced by *Coloradisaurus* in Lambert 1983 after *Coloradia* was found preoccupied. Citation is the original description but under the now-superseded genus name. |
| Daanosaurus | `ye2005` | D | Chinese primary description with appended English abstract. Agent flagged as translation but data is from the original. |
| Enigmosaurus | `barsbold1983` | E | Russian monograph translated into English. *Enigmosaurus* is one of several new taxa described in the work. |
| Epachthosaurus | `powell1990` | E | English translation (by J. A. Wilson) of Powell 1990 Spanish-language congress abstract (Congreso Argentino de Paleontología). |
| Garudimimus | `barsbold1981` | G | English translation (by Siskron and Welles) of Barsbold 1981 Russian monograph. |
| Genusaurus | `accarie1995` | G | English translation by Matthew Carrano (1995) of the French original. |
| Gongbusaurus | `dong1983a` | G | Chinese monograph; English translation. |
| Gongxianosaurus | `he1998` | G | English translation by Will Downs (1999) of Chinese paper (Acta Geologica Sichuan vol. 18 no. 1, 1998). |

## 4. Filename / encoding quirks

| File | Issue | Genus / letter | Notes |
|---|---|---|---|
| `d'emic2013.md` | Filename uses U+2019 (right single quotation mark, curly apostrophe) instead of an ASCII apostrophe. The agent's `Read` tool returned permission-denied on first pass; retry with the path passed verbatim succeeded. | Astrophocaudia / A | The YAML's `described_in` key matches the filename byte-for-byte, so renaming requires updating both. Apply scripts should normalise quote variants when key-matching as a defensive measure. |
| `BXGMV` not in `institutions.yaml` | Crichtonpelta's holotype catalog `BXGMV0012` (Beipiao Geological Museum, China) wasn't recognised by the specimen-ID stripper, so the catalog token survived into the applied `material` field. Consider adding `BXGMV` to `institutions.yaml`. | Crichtonpelta / C | One-off; only surfaced this letter. |

## 5. Real binomial / spelling discrepancies

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
