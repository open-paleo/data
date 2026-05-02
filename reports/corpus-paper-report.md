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
| Achelousaurus | `sampson1995` | A | Publisher boilerplate only; article body absent. |
| Altispinax | `huene1923` | A | Publisher boilerplate only. |
| Anchisaurus | `marsh1885` | A | BHL OCR missed the actual page (Marsh 1885 sits on p. 169 of a long journal volume); only a garbled "Anchisauridae" fragment remains. |
| Baryonyx | `charig1986` | B | Publisher boilerplate only. |

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
| Amargasaurus | `bonaparte1984` | Same review book as Abelisaurus; lists *Amargasaurus* as nomen nudum *"A. groeberi"*. | Salgado & Bonaparte 1991 (*A. cazaui*) |
| Amurosaurus | `bolotsky1991` | Corpus has a 2011 book chapter, not the 1991 original. | Bolotsky & Kurzanov 1991 |
| Antarctosaurus | `huene1927b` | Broader review; *Antarctosaurus* mentioned only in passing. | Huene 1929 (Anales del Museo de La Plata) |

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

## 4. Filename / encoding quirks

| File | Issue | Genus / letter | Notes |
|---|---|---|---|
| `d'emic2013.md` | Filename uses U+2019 (right single quotation mark, curly apostrophe) instead of an ASCII apostrophe. The agent's `Read` tool returned permission-denied on first pass; retry with the path passed verbatim succeeded. | Astrophocaudia / A | The YAML's `described_in` key matches the filename byte-for-byte, so renaming requires updating both. Apply scripts should normalise quote variants when key-matching as a defensive measure. |

## 5. Real binomial / spelling discrepancies

Filtered from the agent's `binomial_in_paper` flags after removing
cosmetic noise (`gen. et sp. nov.`, capitalisation, ASCII↔ligature
variants). These are nomenclatural questions — the YAML and the
paper genuinely differ on a letter, and the canonical form needs a
cross-check against ICZN / current literature.

| Genus | YAML | In paper | Letter | Note |
|---|---|---|---|---|
| Acanthopholis | *horrida* | *horridus* | A | Latin gender emendation; modern accepted form is *horrida*. Informational only. |
| Amargasaurus | *cazaui* | *groeberi* | A | Artifact of the wrong-citation issue (#1863) — the corpus paper lists *A.* as nomen nudum *groeberi*. Will resolve once the citation is corrected. |
| Baurutitan | *britoi* | *brítoi* | B | Diacritic difference (Latin *í*). Verify whether the original 2005 paper uses the accent and what the modern accepted form is. |

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
- **Ahshislesaurus mcdonaldi** vs *wimani* and **Athenar
  antiquitatum** vs *bermani* (both A): both were caused by
  hand-typing species names into dispatch prompts instead of
  interpolating from the work-queue file. The agent dutifully
  flagged each; both entries were re-run with the correct names.
  The `build-extraction-prompts.ts` script now eliminates this
  class of error by emitting prompts mechanically from parsed YAML.
