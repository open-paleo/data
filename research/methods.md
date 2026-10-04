# Methods

## A species' period and stages describe its type horizon only

*2026-10-03*

**Rule.** Date a species record by the horizon of its holotype (or other name-bearing type). Referred material from other horizons goes in the notes, not in `period` or `stage`. Decides `period` and `stage` on species records.

**Why.** A species can be known from several horizons, and adding each one's age widens the record beyond what the type shows. *Heterodontosaurus* keeps the Sinemurian–Pliensbachian of its lower Clarens holotype; a referred upper Elliot skeleton does not add the Hettangian (see [Clarens](stratigraphy/c/clarens.md)).

**Exceptions.** A reworked type takes the age of its source beds, with the depositional age of the bed it was found in recorded in the note: [*Craterosaurus*](../genera/C/Craterosaurus.yml) is Neocomian although it comes from the Aptian–Albian Potton Nodule Bed (see [Woburn Sands](stratigraphy/w/woburn-sands.md)).

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

## A maximum depositional age never sets stages on its own

*2026-10-03*

**Rule.** A detrital-zircon (or other) maximum depositional age is a floor: the unit is no older than it. It does not fix the unit's stages, and it is not a ceiling for any unit beneath. Record it in the notes; set stages from evidence that dates the unit, and where a maximum age conflicts with that evidence, record a dispute. Decides `stages`, `dispute`.

**Why.** The [Hasandong](stratigraphy/h/hasandong.md) was first narrowed to the Albian on a single-grain maximum age, then corrected to Aptian–Albian with a dispute, because other evidence keeps the Aptian. The [Suining](../stratigraphy/s/suining.yml)'s Aptian rested only on a maximum age ("We interpret this age as the maximum depositional age", wang2019c) and was dropped. A Hupyeongdong bracket built from the maximum ages of the units above it was withdrawn, and the Mackunda's Turonian came from the overlying Winton's maximum age (see [Mengyin](stratigraphy/m/mengyin.md) for a floor-and-ceiling bracket done correctly).

**Exceptions.** Where the dating paper argues that the youngest grains are syndepositional, the age may support a stage, but say so and keep the dispute open (see [Sao Khua](stratigraphy/s/sao-khua.md)).

## Carry over a stated relation; re-place a bare number on the current chart

*2026-10-02*

**Rule.** Stages are read against the chart in `schema.yml` (ICS v2024/12). When a source states a relation (a stage, a zone, a magnetochron, "above the boundary"), carry the relation over as stated. When it gives a bare number with a stage label read off an older chart, re-place the number on the current chart and drop the old label. A number that falls between the older and current position of a moved boundary is recorded with both readings. Decides `stages`, `stage`.

**Why.** Boundaries have moved: the base of the Aptian from 125 Ma (GTS 2004) to 121.4 Ma, the base of the Tithonian from 150.8 or 152.1 Ma to 149.2 Ma. Morrison "early Tithonian" labels on dates of about 150 Ma are Kimmeridgian on the current chart (see [Morrison Tithonian labels](topics/morrison-tithonian-labels.md)); the Lujiatun's 125.755 Ma sits 0.015 Myr above the current base of the Barremian (see [Lujiatun](stratigraphy/l/lujiatun.md)). A magnetochron placement is a relation: re-check which stage holds that chron on the current chart (the Sânpetru, whose start in C32n is Maastrichtian on the current placement).

**Exceptions.** A stage that comes from a zone fossil or a stated boundary relation governs over a number in the same source.

## A numeric age of about 97–99.5 Ma labelled Albian is an old-chart label

*2026-10-02*

**Rule.** Treat a date of roughly 97–99.5 Ma described as Albian, or as "at the Albian–Cenomanian boundary", as a pre-2012 calibration (the boundary was then about 97.5–99.6 Ma); on the current chart (base Cenomanian 100.5 Ma) it is Cenomanian. Decides `stages` on mid-Cretaceous units of the Western Interior and elsewhere.

**Why.** The Mussentuchit and the [Terra Cotta Clay](stratigraphy/t/terra-cotta-clay.md) lost their Albian on this test: their "Albian" rested on dates or maxima of about 97–99 Ma, and the boundary was once placed at the top of the Mowry Shale.

**Exceptions.** A unit whose own bed is dated older than 100.5 Ma keeps the Albian (*Abydosaurus*: a maximum of 104.46 Ma below and Dakota at 101.4 Ma above).

## A span "to Paleocene" gives the period, not the Danian

*2026-10-03*

**Rule.** A unit takes `Danian` (or a later Paleogene stage) only when a source places the Cretaceous–Paleogene boundary within it. A stated span such as "late Campanian to Paleocene" adds `Paleocene` to `period` but no Paleogene stage. Decides `stages` and `period`.

**Why.** The [Prince Creek](stratigraphy/p/prince-creek.md) and the [Yezo](stratigraphy/y/yezo.md) reach the Paleocene in their sources, but none places the boundary within them ("The Cretaceous/Palaeogene boundary sequence has not been detected in the Hakobuchi Formation", takashima2004a); the Scollard and the Denver take the Danian because sources place the boundary inside them.

**Exceptions.** None.

## An epoch in `period` needs a reading that supports it

*2026-10-03*

**Rule.** For each epoch in `period` with no matching stage, find the reading behind it. A superseded epoch is dropped, with the reason in the notes. A possibility, hedge, outer bound or passing label ("cannot be completely ruled out", "Late Jurassic – Aptian, with strongest support for…", a table label) is not a reading: drop it and note why. A live, own-voice reading is kept, as a dispute if it conflicts with the rest. Decides `period`, `dispute`.

**Why.** Applied to every epoch without stages, the test dropped fourteen, among them the Kayenta's Late Triassic and Middle Jurassic (both superseded), the Las Leoneras's Late Triassic (a possibility) and the Dinosaur Beds' Late Jurassic (an outer bound); it kept the Caiuá's and Wangshi's as disputes (see [Kayenta](stratigraphy/k/kayenta.md)). It also showed the cost of getting the class wrong: the Suining's Late Jurassic was first dropped and then restored as a live reading.

**Exceptions.** None.

## A group is dated on its own evidence, never widened to fit a child

*2026-10-01*

**Rule.** A group (or other parent) takes its age from, in order: (1) a source dating it directly; (2) a source dating it through its members; (3) the union of the ages of every member in a published scheme. A child unit dated outside its parent is a finding to resolve by reading the sources, never a reason to widen the parent. Decides `stages` on groups and other parents.

**Why.** Several parents had been widened to match one dated child, which made them too wide where that child was wrong and too narrow where other members were undated (Ancholme, Tiantai, Yongkang, Ganzhou). Resolving the children instead corrected both sides (see [Tiantai](stratigraphy/t/tiantai.md) and [Ganzhou](stratigraphy/g/ganzhou.md)).

**Exceptions.** None.

## A reported spread, a disjunction or a bound does not license the stages in between

*2026-09-30*

**Rule.** Read an age span by what kind of statement it is before recording its interior stages. Only a determination (the paper's own dated span) licenses every stage between its ends. A reported spread ("has been reported to range from…") gives other authors' endpoints; a disjunction ("latest Albian or earliest Cenomanian") is a refusal to choose and goes to a dispute or the notes; a bounded negative ("pre-Aptian", "older than X") excludes X and licenses nothing; "no older than X" includes X. Decides `stages`, `dispute`.

**Why.** The Djadokhta's "Cenomanian to Early Maastrichtian" is a list of earlier views, and the same paper determines a Campanian age (see [Djadokhta](stratigraphy/d/djadokhta.md)); the Lakota's "pre-Aptian" excludes the Aptian (see [Lakota](stratigraphy/l/lakota.md)).

**Exceptions.** None.

## Non-adjacent stages from different sources are never joined

*2026-09-19*

**Rule.** `stages` lists stages oldest first and contiguous. When two sources give stages that are not adjacent, do not fill the gap: one reading goes to `dispute`, or to the notes as superseded. A span wider than the sources plausibly cover usually means one source does not belong. Decides `stages`, `dispute`.

**Why.** Filling the gap asserts the stages in between, which no source states. The Cutzamala's Maastrichtian palynology went to a dispute rather than widening the range; the Tiourarén's old Hauterivian–Barremian went to the notes (see [Tiourarén](stratigraphy/t/tiourarén.md)).

**Exceptions.** None.

## Weigh age evidence by kind, not by count

*2026-09-30*

**Rule.** Trace each statement of a unit's or taxon's age to its original source and count each original once. Weigh radiometric dating of the fossil's own beds over biostratigraphy of the horizon, over a phylogenetic bracket, over a compilation table. One explicit supersession ("now regarded as…") outweighs many repetitions of the older reading. Decides `stages`, `stage`, `dispute`.

**Why.** Tallies measure repetition. *Jiangshanosaurus*'s twelve Albian statements all descend from one Rb-Sr date (see [*Jiangshanosaurus*](genera/J/Jiangshanosaurus.md)); the Bayanshiree's Campanian traces to two early readings that their own authors later narrowed (see [Bayanshiree](stratigraphy/b/bayanshiree.md)).

**Exceptions.** None.

## Count an edited book and its chapters as one source

*2026-10-04*

**Rule.** When the reference store has an entry for an edited book and separate entries for its chapters, a statement found in both is one source, dated to the book. Cite the chapter, which names the authors who made the statement. This applies the rule "Weigh age evidence by kind, not by count" to a book cited both whole and in parts. Decides `stages`, `stage` and `dispute` where a count of sources includes such a book.

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

## `institution` is the registry key for the collection that holds the type

*2026-10-04*

**Rule.** Set `type_specimen.institution` to the key in `institutions.yaml` for the collection that holds the type. Choose the key by the prefix that dinosaur specimens from that collection actually carry, checked against the describing paper's repository statement and the fossil's locality. Sabaj's (2020) list of collection codes seeds the registry and settles a genuine collision (one abbreviation, two institutions), but it is not the authority on which code to use. A paper's variant or obsolete code is mapped through the registry's aliases, not adopted as the key. Decides `type_specimen.institution`, and the keys and `aliases` in `institutions.yaml`.

**Why.** Sabaj's list is built for ichthyology and herpetology collections, and a museum's code for fishes or reptiles is often not the one its fossil catalogue uses. Following a code to the letter misfiles specimens: `GSM` once aliased to the Georgian National Museum filed British [*Acanthopholis*](../genera/A/Acanthopholis.yml) in Tbilisi until the alias moved to the British Geological Survey, the only GSM in the data. The same collision runs the other way for [*Magnamanus*](genera/M/Magnamanus.md), whose MNS is the Museo Numantino de Soria, not Stuttgart.

**Exceptions.** A prefix that names a site or excavation (ANA, To, LH) is not an institution code ([Protathlitis](genera/P/Protathlitis.md), [Tazoudasaurus](genera/T/Tazoudasaurus.md)); if the paper names no repository, `institution` is UNKNOWN.

## A `specimen_id` takes the registry's prefix and the institution's established form

*2026-10-04*

**Rule.** Write a `specimen_id` as the collection prefix that `institutions.yaml` records for the institution, then the number. Take the separator and padding from the form already established for that institution in the data, not from the describing paper's punctuation, and when one record's id is normalized, normalize every id with that prefix together. Each catalogue number is listed on its own, never as a range. When the literature applies one number to two different specimens, keep both and qualify each as `<id> sensu <first author> <year>`. Decides `type_specimen.specimen_id`.

**Why.** Papers punctuate one collection's numbers inconsistently, sometimes within a single article: the MLL number of *Pilmatueia* and *Lajasvenator* is printed MLL-PV-005, MLL-Pv-005 and MLL-PV-Pv-005 (see [MLL-Pv 005](topics/mll-pv-005.md)), which is also the contested-number case. Older papers print Royal Tyrrell numbers unpadded, as TMP 2001.26.1 for [*Albertaceratops*](../genera/A/Albertaceratops.yml); the number is the same as the stored TMP 2001.026.0001. [*Saurolophus*](genera/S/Saurolophus.md) carries the first `sensu` pair.

**Exceptions.** A different number, not a different format of the same number, is a change of specimen and needs the designating paper (see the rule above on taking a type's number from the designating paper).

## The registry lists only units a record or another unit names

*2026-10-04*

**Rule.** A stratigraphic unit gets an entry in `stratigraphy/` when a taxon record names it in `location` (formation, member, group and the other unit ranks), or when another entry names it in `parent` or `contains`. A unit that appears only in the literature, or only in a research note weighing the evidence, gets no entry. The one addition is a unit needed to settle a dispute, or one that adopting a reading would make a record or parent name. Decides which entries exist in `stratigraphy/`, and whether a `parent` may be set.

**Why.** An entry no record uses is never checked against a fossil's horizon, and the regional literature names far more units than the dataset needs. A `parent` or `contains` value with no entry behind it cannot be checked for rank or age, so a unit named that way is listed even when no taxon record uses it. The Calcaire de Rognac is the worked addition: it is what separates the Lower from the Upper Argiles Rutilantes, so placing a taxon in either one forces it (see [Grès à Reptiles](topics/grès-à-reptiles.md)).

**Exceptions.** Beds and quarry levels named only in `location.bed` (Bonebed I, the Hypsilophodon Bed) need no entry. A variant spelling is not a unit and follows the next rule.

## A variant spelling must be printed in the literature

*2026-09-19*

**Rule.** Record as a variant only a spelling printed in a published source. Renderings produced by our own transcription or translation do not count. Decides `variants`.

**Why.** Machine translation and OCR produce plausible forms that no author used: "Glauconitic Chalk" for the Craie glauconieuse appears only in a translation of a French paper, and collides with a Northern Ireland unit of that name (see [Craie glauconieuse](stratigraphy/c/craie-glauconieuse.md)).

**Exceptions.** None.

## References

- `wang2019c`: Wang, J.; Norell, M. A.; Pei, R.; Ye, Y.; Chang, S. C. (2019). Surprisingly young age for the mamenchisaurid sauropods in South China. *Cretaceous Research* 104: 104176. doi:10.1016/j.cretres.2019.07.006
- `takashima2004a`: Takashima, R.; Kawabe, F.; Nishi, H.; Moriya, K.; Wani, R.; Ando, H. (2004). Geology and stratigraphy of forearc basin sediments in Hokkaido, Japan: Cretaceous environmental events on the north-west Pacific margin. *Cretaceous Research* 25: 365-390. doi:10.1016/j.cretres.2004.02.004
- `weishampel2004a`: Weishampel, D. B.; Dodson, P.; Osmólska, H. (2004). The Dinosauria, Second Edition. University of California Press, Berkeley.
- `upchurch2004a`: Upchurch, P.; Barrett, P. M.; Dodson, P. (2004). Sauropoda. In *The Dinosauria, 2nd edition*, pp. 259-322. University of California Press.
- `weishampel2004b`: Weishampel, D. B.; Barrett, P. M.; Coria, R. A.; Le Loeuff, J.; Xu, X.; Zhao, X.; Sahni, A.; Gomani, E. M. P.; Noto, C. R. (2004). Dinosaur distribution. In *The Dinosauria, 2nd edition*, pp. 517-606. University of California Press. doi:10.1525/california/9780520242098.003.0027
- `galton2004a`: Galton, P. M.; Upchurch, P. (2004). Prosauropoda. In *The Dinosauria, 2nd edition*, pp. 232-258. University of California Press.
- `jones2026a`: Jones, B. (2026). The Princeton Encyclopedia of Dinosaurs: Ornithischians. Princeton University Press.
- `molina-pérez2019a`: Molina-Pérez, R.; Larramendi, A. (2019). Dinosaur Facts and Figures: The Theropods and Other Dinosauriformes. Princeton University Press.
