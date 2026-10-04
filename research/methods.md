# Methods

## Rules stated in CONTRIBUTING.md

*2026-10-04*

**Rule.** These rules are stated in [CONTRIBUTING.md](../CONTRIBUTING.md), which governs where it and this file differ. They are listed here with the cases that showed each one was needed.

- **A species' age is its type horizon's.** Referred material from other beds goes in the notes, and a reworked type takes the age of its source beds ([Age: `period` and `stages`](../CONTRIBUTING.md#age-period-and-stages)). Cases: *Heterodontosaurus* (see [Clarens](stratigraphy/c/clarens.md)); [*Craterosaurus*](../genera/C/Craterosaurus.yml), reworked into the Potton Nodule Bed (see [Woburn Sands](stratigraphy/w/woburn-sands.md)).
- **A unit's stages are the union of what its sources publish**, and a plain either-or between two readings ("Kimmeridgian or Neocomian") contributes both and every stage between, while a boundary hedge whose two stages are not adjacent ("late Barremian or earliest Albian") adds none ([Age](../CONTRIBUTING.md#age-period-and-stages)).
- **A maximum depositional age, or a lava flow above or below, is a limit, not an age** ([Reading ages on the chart](../CONTRIBUTING.md#reading-ages-on-the-chart)). Cases: [Hasandong](stratigraphy/h/hasandong.md), the Suining, and [Mengyin](stratigraphy/m/mengyin.md) for a floor and ceiling bracket done correctly.
- **A stated stage is carried over; a bare number is placed on the current chart** ([Reading ages on the chart](../CONTRIBUTING.md#reading-ages-on-the-chart)). Cases: [Morrison Tithonian labels](topics/morrison-tithonian-labels.md); [Lujiatun](stratigraphy/l/lujiatun.md), 0.015 Myr above the current base of the Barremian.
- **A span "to Paleocene" gives the period, not the Danian**; the Danian needs a source placing the boundary inside the unit ([Age](../CONTRIBUTING.md#age-period-and-stages)). Cases: [Prince Creek](stratigraphy/p/prince-creek.md), [Yezo](stratigraphy/y/yezo.md).
- **A parent is dated from its own sources, and a child outside it is a finding, never a reason to widen it** ([Age](../CONTRIBUTING.md#age-period-and-stages)). Cases: [Tiantai](stratigraphy/t/tiantai.md), [Ganzhou](stratigraphy/g/ganzhou.md).
- **`institution` takes Sabaj's current code**, with superseded codes kept as aliases, a code from the literature where Sabaj has none, and the ISO-suffix rule for a genuine collision ([Institution Registry](../CONTRIBUTING.md#institution-registry)). Cases: `GSM`, whose specimens in the data are all British and so alias to the British Geological Survey, not the Georgian museum; [*Magnamanus*](genera/M/Magnamanus.md), whose MNS is the Museo Numantino de Soria, not Stuttgart.
- **A variant is another name papers print for the unit**, never a spelling, rank word or our own translation ([Stratigraphic Registry](../CONTRIBUTING.md#stratigraphic-registry)). Case: "Glauconitic Chalk" for the [Craie glauconieuse](stratigraphy/c/craie-glauconieuse.md), which appears only in a translation and collides with a Northern Ireland unit.

**Why.** Each of these was once stated in both files, and the two drifted apart: this file held three stage rules that contradicted the union rule, and an institution rule that contradicted Sabaj's standing.

**Exceptions.** None.

## Decide a species' stage on statements about its horizon, not about its formation

*2026-09-30*

**Rule.** When sources disagree on a taxon's stage, sort each statement by whether it dates the type horizon or the formation as a whole, and decide on the horizon statements. If none exists, the taxon takes its unit's range. Decides `stage` on species records.

**Why.** Most apparent conflicts are between a formation-wide range and a narrower horizon age. For [*Oryctodromeus*](../genera/O/Oryctodromeus.yml) every Albian vote concerns the Blackleaf broadly, while the describing paper dates "this portion of the formation" as Cenomanian (see [*Oryctodromeus*](genera/O/Oryctodromeus.md)).

**Exceptions.** None.

## A parent unit's range repeated for a child unit is the parent's statement

*2026-10-01*

**Rule.** When a paper gives a member or bed the full range of its formation (or a formation the range of its group), citing the parent's source, treat it as the parent's statement, not as a dating of the child. Decides `stages` on child units.

**Why.** The Puesto Antigual Member was given "Barremian–lower Aptian" by a paper that cited only a source dating the whole La Amarga Formation; the paper that names the member puts it in the Barremian (see [Puesto Antigual](stratigraphy/p/puesto-antigual.md)).

**Exceptions.** None.

## A numeric age of about 97–99.5 Ma labelled Albian is an old-chart label

*2026-10-02*

**Rule.** Treat a date of roughly 97–99.5 Ma described as Albian, or as "at the Albian–Cenomanian boundary", as a pre-2012 calibration (the boundary was then about 97.5–99.6 Ma); on the current chart (base Cenomanian 100.5 Ma) it is Cenomanian. Decides `stages` on mid-Cretaceous units of the Western Interior and elsewhere.

**Why.** The Mussentuchit and the [Terra Cotta Clay](stratigraphy/t/terra-cotta-clay.md) lost their Albian on this test: their "Albian" rested on dates or maxima of about 97–99 Ma, and the boundary was once placed at the top of the Mowry Shale.

**Exceptions.** A unit whose own bed is dated older than 100.5 Ma keeps the Albian (*Abydosaurus*: a maximum of 104.46 Ma below and Dakota at 101.4 Ma above).

## An epoch in `period` needs a reading that supports it

*2026-10-03*

**Rule.** For each epoch in `period` with no matching stage, find the reading behind it. A superseded epoch is dropped, with the reason in the notes. A possibility, hedge, outer bound or passing label ("cannot be completely ruled out", a table label) is not a reading: drop it and note why. A live, own-voice reading is kept, as a dispute if it conflicts with the rest. Decides `period`, `dispute`.

**Why.** Applied to every epoch without stages, the test dropped fourteen, among them the Kayenta's Late Triassic and Middle Jurassic (both superseded), the Las Leoneras's Late Triassic (a possibility) and the Dinosaur Beds' Late Jurassic (an outer bound); it kept the Caiuá's and Wangshi's as disputes (see [Kayenta](stratigraphy/k/kayenta.md)). It also showed the cost of getting the class wrong: the Suining's Late Jurassic was first dropped and then restored as a live reading.

**Exceptions.** None.

## A reported spread is other authors' readings, and a bound licenses nothing

*2026-09-30*

**Rule.** Read an age span by what kind of statement it is before recording it. A reported spread ("has been reported to range from…") lists other authors' endpoints: trace each to its original before it adds a stage. A bounded negative ("pre-Aptian", "older than X") excludes X and licenses nothing; "no older than X" includes X. A paper's own plain either-or contributes both readings and every stage between, and a boundary hedge whose stages are not adjacent adds none, per [CONTRIBUTING.md](../CONTRIBUTING.md#age-period-and-stages). Decides `stages`.

**Why.** The Djadokhta's "Cenomanian to Early Maastrichtian" is a list of earlier views, and the same paper determines a Campanian age (see [Djadokhta](stratigraphy/d/djadokhta.md)); the Lakota's "pre-Aptian" excludes the Aptian (see [Lakota](stratigraphy/l/lakota.md)).

**Exceptions.** None.

## Count each original statement of an age once

*2026-09-30*

**Rule.** Trace each statement of a unit's or taxon's age to its original source and count each original once. A relayed statement adds nothing to the reading it relays. An explicit supersession ("now regarded as…", or authors narrowing their own earlier dating) moves the older reading to the reference notes, since a superseded dating is not a dispute. Decides `stages`, `stage`, `dispute`.

**Why.** Tallies measure repetition. *Jiangshanosaurus*'s twelve Albian statements all descend from one Rb-Sr date (see [*Jiangshanosaurus*](genera/J/Jiangshanosaurus.md)); the Bayanshiree's Campanian traces to two early readings that their own authors later narrowed (see [Bayanshiree](stratigraphy/b/bayanshiree.md)).

**Exceptions.** None.

## Count an edited book and its chapters as one source

*2026-10-04*

**Rule.** When the reference store has an entry for an edited book and separate entries for its chapters, a statement found in both is one source, dated to the book. Cite the chapter, which names the authors who made the statement. This applies the rule on counting each original statement once to a book cited both whole and in parts. Decides `stages`, `stage` and `dispute` where a count of sources includes such a book.

**Why.** weishampel2004a is the whole of *The Dinosauria* (2nd edition), and eleven of its chapters have their own entries, among them upchurch2004a and weishampel2004b (the distribution chapter). The Tiourarén Hauterivian–Barremian age of *Jobaria* appears in Upchurch and colleagues' Table 13.1 and in the distribution chapter. Counting the book's entry and each chapter's entry finds it four times, but it is one 2004 statement. A compilation row is also weak evidence for each unit in it: Galton and Upchurch's Table 12.1 gives *Massospondylus* the single age "Hettangian–Pliensbachian" across eight unit entries in three countries (galton2004a, p. 235), a range for the taxon, not a date for each unit.

**Exceptions.** None.

## A matrix identification can give a formation, never a locality

*2026-09-30*

**Rule.** When a specimen's provenance rests only on the rock adhering to it, record the formation (with a note that it is a matrix identification) and leave `locality` empty; the region goes no further than the matrix allows. Decides `location.formation`, `location.locality`, `location.region`.

**Why.** [*Priodontognathus*](genera/P/Priodontognathus.md) has no collection record; its Calcareous Grit comes from the matrix, and the two candidate areas suggested in 1875 lie in different counties.

**Exceptions.** None.

## "X of the Y" is a place, not a formation name

*2026-09-30*

**Rule.** A phrase such as "the Chalk of the Pays de Caux" names where a unit crops out; do not record it as a formation. Find the formal unit, usually in the regional work the paper cites. Formal English names put the geographic term first; French names put it last (Craie de Rouen), and some traditional names have no geographic term at all (Craie glauconieuse). Decides `location.formation`.

**Why.** *Caletodraco* was described from "the Late Cretaceous Chalk of the Pays de Caux"; its formation is the Craie glauconieuse (see [*Caletodraco*](genera/C/Caletodraco.md)).

**Exceptions.** None.

## Take a type specimen's number from the designating paper, not a compilation

*2026-10-04*

**Rule.** Take `type_specimen.specimen_id` from the paper that designates the type, or from a later paper that states a renumbering, and never from a compilation's specimen table or list (for example jones2026a/b/c or molina-pérez2019a/2020a). A compilation that disagrees goes under Ruled out, not into the record. Decides `type_specimen.specimen_id`.

**Why.** The compilations carry errors that no primary source has: "IVPP 3" for *Mamenchisaurus hochuanensis* ([Mamenchisaurus](genera/M/Mamenchisaurus.md)), "MT 65" and "TrM 65" for *Gigantoscelus* ([Gigantoscelus](genera/G/Gigantoscelus.md)), "IVPP V88402a/b" for *Alxasaurus* ([Alxasaurus](genera/A/Alxasaurus.md)), and an element number given as the *Ruehleia* specimen ([Ruehleia](genera/R/Ruehleia.md)).

**Exceptions.** When the designating paper gives no number (*Antarctosaurus*, *Mamenchisaurus hochuanensis*), use the earliest primary paper that does, and say so in the note.

## A `specimen_id` takes the registry's prefix and the institution's established form

*2026-10-04*

**Rule.** Write a `specimen_id` as the collection prefix that `institutions.yaml` records for the institution, then the number. Take the separator and padding from the form already established for that institution in the data, not from the describing paper's punctuation, and when one record's id is normalized, normalize every id with that prefix together. Each catalogue number is listed on its own, never as a range. When the literature applies one number to two different specimens, keep both and qualify each as `<id> sensu <first author> <year>`. Decides `type_specimen.specimen_id`.

**Why.** Papers punctuate one collection's numbers inconsistently, sometimes within a single article: the MLL number of *Pilmatueia* and *Lajasvenator* is printed MLL-PV-005, MLL-Pv-005 and MLL-PV-Pv-005 (see [MLL-Pv 005](topics/mll-pv-005.md)), which is also the contested-number case. Older papers print Royal Tyrrell numbers unpadded, as TMP 2001.26.1 for [*Albertaceratops*](../genera/A/Albertaceratops.yml); the number is the same as the stored TMP 2001.026.0001. [*Saurolophus*](genera/S/Saurolophus.md) carries the first `sensu` pair.

**Exceptions.** A different number, not a different format of the same number, is a change of specimen and needs the designating paper (see the rule above on taking a type's number from the designating paper).

## The registry lists only units a record or another unit names

*2026-10-04*

**Rule.** [CONTRIBUTING.md](../CONTRIBUTING.md#stratigraphic-registry) gives an entry to every unit a record's `location` names. A stratigraphic unit gets an entry in `stratigraphy/` when a taxon record names it in `location` (formation, member, group and the other unit ranks), or when another entry names it in `parent` or `contains`. A unit that appears only in the literature, or only in a research note weighing the evidence, gets no entry. The one addition is a unit needed to settle a dispute, or one that adopting a reading would make a record or parent name. Decides which entries exist in `stratigraphy/`, and whether a `parent` may be set.

**Why.** An entry no record uses is never checked against a fossil's horizon, and the regional literature names far more units than the dataset needs. A `parent` or `contains` value with no entry behind it cannot be checked for rank or age, so a unit named that way is listed even when no taxon record uses it. The Calcaire de Rognac is the worked addition: it is what separates the Lower from the Upper Argiles Rutilantes, so placing a taxon in either one forces it (see [Grès à Reptiles](topics/grès-à-reptiles.md)).

**Exceptions.** A bed named in `location.bed` passes the same test, but its entry goes in the `beds` list of its nearest containing unit rather than in a file of its own, because a bed's label ("83", "L9", "Bonebed I") usually means something only within one section or quarry. A variant spelling is not a unit and follows the rule on variant spellings.

## References

- `weishampel2004a`: Weishampel, D. B.; Dodson, P.; Osmólska, H. (2004). The Dinosauria, Second Edition. University of California Press, Berkeley.
- `upchurch2004a`: Upchurch, P.; Barrett, P. M.; Dodson, P. (2004). Sauropoda. In *The Dinosauria, 2nd edition*, pp. 259-322. University of California Press.
- `weishampel2004b`: Weishampel, D. B.; Barrett, P. M.; Coria, R. A.; Le Loeuff, J.; Xu, X.; Zhao, X.; Sahni, A.; Gomani, E. M. P.; Noto, C. R. (2004). Dinosaur distribution. In *The Dinosauria, 2nd edition*, pp. 517-606. University of California Press. doi:10.1525/california/9780520242098.003.0027
- `galton2004a`: Galton, P. M.; Upchurch, P. (2004). Prosauropoda. In *The Dinosauria, 2nd edition*, pp. 232-258. University of California Press.
- `jones2026a`: Jones, B. (2026). The Princeton Encyclopedia of Dinosaurs: Ornithischians. Princeton University Press.
- `molina-pérez2019a`: Molina-Pérez, R.; Larramendi, A. (2019). Dinosaur Facts and Figures: The Theropods and Other Dinosauriformes. Princeton University Press.
