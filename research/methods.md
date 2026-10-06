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

## A thesis never carries a value alone

*2026-10-05*

**Rule.** A thesis is gray literature. Where a published version exists, cite that instead. A thesis never sole-sources a name, rank, containment or age, and it cannot perform a nomenclatural act under either the zoological or the stratigraphic codes. It may contribute an observation alongside a published source, and its store entry records that it is a thesis, so a reader can see its standing. Decides every field a source can support.

**Why.** For the [Reuchenette](../stratigraphy/r/reuchenette.yml), the thesis asserts a late Oxfordian to late Kimmeridgian age, while the published version by Jank and colleagues (2006) hedges the Oxfordian in its own title, "?Oxfordian, Kimmeridgian *sensu gallico*" (jank2006a, title). Citing the thesis would have taken the stronger claim with its hedge stripped off (see [Reuchenette](stratigraphy/r/reuchenette.md)).

**Exceptions.** None.

## A personal communication is not a published determination

*2026-10-05*

**Rule.** An age, unit or placement that a paper attributes to a personal communication, its own or one it relays, does not count as a reading. It can weigh in a live debate between published readings, and the reference note says so, but it never adds a stage or a value on its own. Decides `stages`, `stage`, `dispute` and `location` fields.

**Why.** For the [Kota](../stratigraphy/k/kota.yml), Buffetaut (2000) writes that the formation "may in fact be as recent as Early Cretaceous on the basis of palynology; G. V. R. Prasad, personal communication" (buffetaut2000a, main text). Counting it would have stretched the unit from the Jurassic into the Early Cretaceous on a determination nobody has published.

**Exceptions.** None.

## A reference work corroborates but almost never carries a value alone

*2026-10-05*

**Rule.** A reference work or catalogue, such as *The Dinosauria* distribution chapter, an encyclopedia or a stratigraphic lexicon, is used to check a reading and to find the literature behind it. It extends a range a primary source establishes, and its note says so. It does not carry a value no primary source gives. Follow its citations to the primary, which is where the value is decided. Decides every field a source can support.

**Why.** Most reference works cite their sources, so they are good for smell tests and leads, but a compilation row repeats a reading rather than making one. White's (1973) catalogue lists *Gigantoscelus* from the "Upper Triassic, Stormberg Series, Bushveld Sandstone" (white1973a, Alphabetical Listing of Genera), and it was once the only source cited for the [Bushveld Sandstone](../stratigraphy/b/bushveld-sandstone.yml)'s Late Triassic. It was dropped as a source, and the unit's age now rests on other readings.

**Exceptions.** A reference work that makes an original observation or argument of its own, rather than compiling, counts for that observation as a primary source would. This is rare, and the reference note names what the work adds.

## A slip that its own document contradicts is not a reading

*2026-10-05*

**Rule.** When a paper states a value that the same document contradicts, whether in its own table, its bibliography or the same sentence, and the error is plainly typographical or a passing slip, read the paper by what it clearly means. Exclude the slip without needing outside evidence, and say in the note why it was excluded where a later reader might count it. Apply the rule by its intent, not its letter: it covers a misprinted stage or epoch, not a considered statement that disagrees with the paper's own table. Decides `stages`, `stage`, `period` and `dispute`.

**Why.** For the [Wessex](../stratigraphy/w/wessex.yml), Carrano and colleagues (2012) report a specimen "from the Wessex Formation (Berriasian) of the Isle of Wight" (carrano2012a, Fragmentary occurrences), while their own bibliography gives the title of the paper they relay as "A new large basal tetanuran (Dinosauria: Theropoda) from the Wessex Formation (Barremian) of the Isle of Wight" (carrano2012a, References). One occurrence of each, inside one document, settles it.

**Exceptions.** None.

## A stage boundary inside a unit gives the far stage only as a lower bound

*2026-10-05*

**Rule.** A source stating that a stage boundary falls inside a unit licenses both stages it names. When it names only one side ("the base of the Aptian passes through the unit"), the unit takes the older stage as a minimum extent, not as its full extent: the unit reaches below the boundary, and the source doesn't say how far. Neither close the list at that stage, nor truncate a range that another source carries deeper. Decides `stages` on registry units. This refines CONTRIBUTING's rule for a span that crosses an epoch boundary ([Age](../CONTRIBUTING.md#age-period-and-stages)).

**Why.** Bonsor and colleagues (2023) write that "the base of the Aptian passes through the unit" for the [Vectis](../stratigraphy/v/vectis.yml)'s youngest member (bonsor2023a, Stratigraphy), naming only the Aptian. Treating the boundary as fixing the unit's base would have cut it at the Barremian–Aptian boundary. The Vectis's Barremian rests instead on Barker and colleagues (2020), who give "Vectis Formation (Barremian to lower Aptian)" directly (barker2020a, introduction).

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

## A coordinate is recorded only when a source prints it for this specimen

*2026-09-01*

**Rule.** `location.coordinates` holds a position only when a source prints it for the holotype's site: in the text, a table, an appendix, a supplement, or as a printed label tied to the site in a figure. Before deleting a stored pair, read every source on the specimen, not only the describing paper. A dot on a locator map, a reference point near the site, a settlement's center, a basin centroid or another specimen's site is not the specimen's position. Decides `location.coordinates`.

**Why.** Most stored pairs were seeded from collection databases rather than papers, and a large share were wrong rather than merely unsourced: [*Abydosaurus*](../genera/A/Abydosaurus.yml) carried the Carnegie Quarry visitor center, printed in a caption as a landmark 375 m from the locality. The chase matters as much as the deletion. [*Acantholipan*](../genera/A/Acantholipan.yml)'s coordinates are real and printed in a 2011 paper, while its 2018 describing paper withholds them, and [*Linhenykus*](../genera/L/Linhenykus.yml)'s appear in its later osteology though the describing paper offers them only on request.

**Exceptions.** A paper that withholds the position ("on file at the repository", or restricted by law) does not supply a coordinate, and a coarse pair it offers in place of the real one is never recorded: "General coordinates for Udan Sayr are 43 deg N, 103 deg E" refuses a position rather than giving one. A shared, round or unevenly precise pair is a reason to read the sources, never a verdict on its own.

## A coordinate no source can be found for is deleted, not held

*2026-09-01*

**Rule.** When no source read for the specimen prints a stored value, the value comes out, even if the describing paper is not available to read. Restoring it waits for the source. Decides `location.coordinates`, and any other value that rests on no source.

**Why.** An unsourced coordinate is not a neutral placeholder. Enough stored pairs proved to be geocodes, centroids or another specimen's site that an unverified one is more likely wrong than right, and it reads to every consumer as sourced. An empty field is honestly unknown. Units, localities and regions usually survive a missing describing paper, because later work restates them; coordinates rarely do, because they are seldom reprinted.

**Exceptions.** None. A specific, obtainable source that would settle the value does not keep it in place meanwhile.

## A degraded copy of a printed coordinate is corrected, not deleted

*2026-09-03*

**Rule.** When a stored pair is a damaged copy of a value a source prints, correct it to the printed value. Convert the printed degrees, minutes and seconds yourself and compare. Decides `location.coordinates`.

**Why.** A stored pair is often neither published nor invented but a real value that lost precision on the way in, and deleting it throws away a real position. [*Sinornithoides*](../genera/S/Sinornithoides.yml) stored the arcminutes as decimals (39°36' as 39.36, about 35 km out), [*Vouivria*](../genera/V/Vouivria.yml) had its seconds truncated, and [*Daemonosaurus*](../genera/D/Daemonosaurus.yml)'s source prints an eastern longitude for a New Mexico site, a typesetting error read as west. A scan that drops the degree marks ("1650 46.92ʺS") still holds a convertible value.

**Exceptions.** Where a correction would mean choosing which of several printed digits is wrong, the value is not repaired.

## A survey description or an area range is not converted into a point

*2026-08-14*

**Rule.** Never compute a coordinate from a Public Land Survey section, a township and range, a map-sheet square, a bounding range for a collecting area, or the endpoints of a measured section. Record the site's own designation in `locality` where it is one. A six-figure national grid reference resolves to about 100 m and is a printed coordinate. Decides `location.coordinates`, `location.locality`.

**Why.** The center of a square mile or a valley is a plausible-looking pair with no owner. [*Zuul*](../genera/Z/Zuul.yml)'s stored pair was the center of the survey section its paper gives in place of a position, in the same sentence that says the GPS point is held at the Royal Ontario Museum. [*Xiaotingia*](../genera/X/Xiaotingia.yml)'s was the midpoint of another author's measured section of the right formation. [*Dracoraptor*](../genera/D/Dracoraptor.yml)'s Ordnance Survey reference, printed twice, converts.

**Exceptions.** The test is the size of what the source names, not whether the notation looks technical: a grid reference to 100 m converts, a survey section does not.

## Every `location` value is the holotype's

*2026-09-03*

**Rule.** Tie each locality, horizon and coordinate to a specimen number before taking it. A value a paper gives for a paratype, a referred specimen or another taxon at the same site does not go in the record's `location`. A code or site name is a locality only when a paper prints it for this holotype. Decides every field in `location`.

**Why.** Locality strings migrate between records at one site as coordinates do, and are harder to catch because a place name reads as evidence. [*Yuxisaurus*](../genera/Y/Yuxisaurus.yml) carried the locality sentence of the *Irisosaurus* holotype; [*Zuniceratops*](../genera/Z/Zuniceratops.yml) carried its own paratype's bone bed; [*Kryptops*](../genera/K/Kryptops.yml) carried G138, which its paper's figure caption assigns to *Eocarcharia*; [*Acrotholus*](../genera/A/Acrotholus.yml) carried the paratype's site, 8 km from the holotype's. A finer-sounding designation deserves more suspicion, not less.

**Exceptions.** None.

## A locality names the site and nothing else

*2026-08-31*

**Rule.** `locality` holds the site's name. A specimen number, a formation, a stratigraphic height or a bed goes in its own field, and a county, province or district goes in `region`. A site paired with a containing property or a reference point is a good locality ("Rock Hole, Rosebery Downs Station"). Where no site name exists, a bearing is written out in full ("10 km east-northeast of Cerro Barcino"). An institution's name is a locality only as a museum locality number or a landmark in a bearing; on its own it is where the specimen is kept. Decides `location.locality`.

**Why.** Records folded other fields into the string ("Paso Córdova (Bajo de la Carpa)", "Sierra de Mogna (148 m)"), and [*Velocisaurus*](genera/V/Velocisaurus.md) carried its university with a coordinate on the museum, geocoded from where the specimen is kept.

**Exceptions.** Where the source names no site, an administrative division is the finest available and stays, particularly in China, where `regions.yaml` stops at the province: [*Baiyinosaurus*](../genera/B/Baiyinosaurus.yml)'s paper gives a district and a coordinate but no site name.

## A name echoing the genus is not evidence of the site

*2026-09-03*

**Rule.** Check a locality that echoes the genus or species name against the type-locality line, and a genus named for a place against the sources on where the holotype came from. Decides `location.locality`.

**Why.** A name-source migrates into the locality field without ever having been a site. [*Daxiatitan*](../genera/D/Daxiatitan.yml)'s "Daxia" is the river it is named for, and its quarry is over 60 km away; the etymology paragraph and the type-locality line are usually different sentences saying different things. In the other direction, *Itemirus* is named for Itemir and did not come from there.

**Exceptions.** None.

## A region may be derived from the locality, checked against today's boundaries

*2026-09-08*

**Rule.** Keep a `region` code that follows from the named site even when no paper prints the subdivision, since where a place lies is geography rather than a claim. Check the code against the current subdivision, not against one that merely exists, and check a nineteenth- or early-twentieth-century county against later splits. Decides `location.region`.

**Why.** [*Ajnabia*](../genera/A/Ajnabia.yml) carried the code of a neighboring Moroccan province rather than Khouribga's, the recycled-code trap `regions.yaml` warns about. [*Torosaurus*](../genera/T/Torosaurus.yml)'s Converse County was right when written and the site now lies in Niobrara County after a split.

**Exceptions.** None.

## A stored value has no standing a new one lacks

*2026-08-31*

**Rule.** Keeping a value already in a record is the same decision as adding it, and needs the same sourcing. Decides any field.

**Why.** The records were seeded rather than sourced, so a stored value was also put there by someone and carries no presumption in its favor. For [*Ischioceratops*](../genera/I/Ischioceratops.yml), keeping a neighboring taxon's formation had been treated as a lighter call than inferring one from the same kind of evidence; it is not.

**Exceptions.** None.

## `group` only when no formation is given

*2026-09-03*

**Rule.** Record `group` when the sources stop at group rank, and not alongside a `formation`. Decides `location.group`.

**Why.** Records drift into carrying both, one at a time, each looking reasonable alone. [*Sauroniops*](../genera/S/Sauroniops.yml) is the legitimate shape: no source places its holotype in the Gara Sbaa, so its formation came out and the Kem Kem at group rank remained.

**Exceptions.** None.

## `formation` holds the modern name, with a source for it

*2026-09-10*

**Rule.** Record the unit's current name where a source gives it, and leave its old names to the unit's registry entry. A describing paper that uses a superseded name is not a rival reading: find the revising paper and take its name. Where no primary source gives the modern name, keep the current value and say what would settle it. A live argument in the primary literature over which unit holds the type is a dispute, and the record stays at the describing paper's assignment with the argument in the notes. Decides `location.formation`, `location.notes`.

**Why.** Older papers use names later redefined under them: before 1993 the beds now in the Dinosaur Park Formation were included in the Oldman, so an older paper's "Oldman Formation" for Dinosaur Provincial Park is the name of its time, not a rival reading. It does not move the specimen wholesale either, because the Park exposes the upper Oldman too; [*Stegoceras*](../genera/S/Stegoceras.yml) carries Dinosaur Park because a later source places its holotype there (see [Oldman and Dinosaur Park](topics/oldman-and-dinosaur-park.md)). [*Agathaumas*](../genera/A/Agathaumas.yml) keeps its value because its modern assignment rests only on a compilation. [*Aerosteon*](../genera/A/Aerosteon.yml)'s Anacleto-or-Plottier argument is live, so it stays a note.

**Exceptions.** None.

## A value in `formation` must be a formation, and the right one for the site

*2026-09-03*

**Rule.** Check that someone erected the value as a lithostratigraphic unit, at formation rank, and that the unit's outcrop reaches the type locality. An age term with a lithology, a sequence, an informal local name or a numbered subdivision nobody erects empties the field, with what the source does say in the notes. Decides `location.formation`.

**Why.** [*Embasaurus*](../genera/E/Embasaurus.yml)'s "Neocomian Sands" is an age term and a lithology. [*Stenopelix*](../genera/S/Stenopelix.yml)'s "Obernkirchen Sandstein" is real rock under its real name two ranks below a formation, so the question that catches it is "at what rank". [*Chilantaisaurus*](../genera/C/Chilantaisaurus.yml)'s Ulansuhai was a real formation that does not reach its locality (see [Maortu and Dashuigou](topics/maortu-and-dashuigou-miaogou.md)): an age that disagrees with itself across one unit is the sign of two rock bodies under one name.

**Exceptions.** None.

## A member takes a formal name; a position goes in `part`

*2026-09-01*

**Rule.** `member` holds a proper name. "The upper member" is `part: upper`. A descriptive phrase ("layer m", "fossiliferous level 3") is not a name and is not recorded. A queried member ("?Upper Member") goes in the notes. Lower, middle and upper are never part of a formal name however many papers print the combined form, so "Lower Shaximiao Formation" is `formation: Shaximiao`, `part: lower`. Decides `location.member`, `location.part`.

**Why.** Consistent printing is not formality: three papers writing "Lower Shaximiao Formation" are three papers using an informal convention. A word that only looks positional is still formal (Alto Shale), a positional word attached to the age ("Upper Maastrichtian") gives no `part`, and a word that is part of a place name is not a position: *Bajo* in Bajo de la Carpa is never "Lower La Carpa".

**Exceptions.** None.

## `part` attaches to the finest named unit

*2026-09-03*

**Rule.** Before adding a `part`, find which unit the source's positional word attaches to, and add it only when that unit is the finest one the record names. Decides `location.part`.

**Why.** [*Iguanacolossus*](../genera/I/Iguanacolossus.yml) keeps `part: lower` because its paper places the holotype in "the lower Yellow Cat" and the Yellow Cat is its finest unit. [*Invictarx*](../genera/I/Invictarx.yml) does not get one: "Juans Lake Beds, upper part of the Allison Member" locates the beds, which are that upper part, so with the bed recorded `part: upper` would assert a position inside the bed that no source gives.

**Exceptions.** None.

## A different spelling of a unit is not evidence of different rock

*2026-09-03*

**Rule.** Before treating an unfamiliar or shortened unit name as a different unit, find the authority the source cites for it and whether that authority combines or separates the bodies of rock. A paper writing a name "sensu" an author follows that author's scheme. Decides `location.formation`, `location.member`.

**Why.** "Wulansuhai" is the spelling Bayan Mandahu papers print for the Ulansuhai; "Bombarral Sub-basin" is the Consolação under an older name; a bare "Porto Novo Member" usually means the combined Praia da Amoreira-Porto Novo (see [Lusitanian Basin members](topics/lusitanian-basin-members.md)). Each was once misread as a different unit.

**Exceptions.** None.

## A house spelling governs place names, and never the name a unit was erected under

*2026-09-10*

**Rule.** Where a site or unit name has several transliterations, the dataset uses one form everywhere, applied to every record at once when it is settled. Mongolian place names follow the gazetteer of Benton and colleagues (2000) (benton2000c). A unit keeps the name it was erected under, even where the gazetteer changes the place name it was built from. Decides `location.locality`, `location.formation`, `location.member`.

**Why.** The Djadokhta Formation's lower member was erected as the Bayn Dzak Member, so [*Velociraptor*](../genera/V/Velociraptor.yml) keeps `member: Bayn Dzak` while the site is Bayan Zag; an earlier sweep had wrongly moved four members to the locality form. Reading the gazetteer whole matters: the dataset once enforced "Djadochta", and Benton's preamble names Djadokhta among the names that "do not change". A corpus count tells which spelling is common, not which is right: [*Yamaceratops*](../genera/Y/Yamaceratops.yml)'s "Khugenetslavkant" outnumbers the correct Khugenetjavkhlant because nine papers copied the describing paper's typo.

**Exceptions.** None.

## A record's note carries what no field and no reference note holds

*2026-09-03*

**Rule.** Before writing a location note, say in one line what it carries that no field and no reference note in the record holds: a superseded name and who replaced it, a number no field takes, a value that belongs to another specimen, a measured position, a straddle the schema cannot express. If nothing, write no note. A reference note says what one paper holds; a location note says what no single paper's note can, such as a conflict between sources. A note does not open by announcing an empty field, does not depend on the value the field used to hold, does not explain how we derived a value, and does not state a practice common across the dataset. Decides `location.notes` and the other notes fields.

**Why.** Notes written without this test were cut by the dozen: one said only that the paper names no bed, which the empty field already shows; another parsed only against the locality the field had before it was corrected; two recorded that a US paper gives a survey section instead of a coordinate, which US papers of that era routinely do.

**Exceptions.** A note about the literature failing to record something is a finding and belongs: "Where the type came from was never recorded" opens a note correctly.

## A unit's naming history belongs to the unit

*2026-08-24*

**Rule.** When a unit has been renamed, synonymized or re-ranked, that history goes in the unit's registry entry, and a genus record carries the current value with a reference to the paper behind it. Decides `location.notes`.

**Why.** A history written on one genus would have to be repeated on every other in the same unit. [*Caudipteryx*](../genera/C/Caudipteryx.yml)'s note tracing Chaomidianzi to the Jianshangou Member was true and useful, and was moved for that reason.

**Exceptions.** A note on why this specimen cannot be placed belongs on the record.

## Every work cited is in the record's references, whether or not it has been read

*2026-10-05*

**Rule.** Supersedes the 2026-09-02 entry, which had an unread paper cut from the note. Every author and year that appears in a record, whether in a note, a description, a dispute or a quotation that itself cites a work, has a matching entry in that record's `references`, read or not. The rule applies to registry units as well as genera and clades. A claim is still decided on sources that have been read; a cited but unread work is a pointer, not evidence. Decides `references` and notes prose.

**Why.** A reader who sees "Author (Year)" needs to find the work it names. Keeping the work in the references also lets the record be checked again once the paper is obtained, which a cut citation does not. Dropping an unread citation lost both and left the sentence pointing at nothing.

**Exceptions.** None.

## Every author cited in a note is in the record's references

*2026-09-02*

**Rule.** Each author and year a note cites must appear in the record's `references`, and must be a paper that has been read. A paper that has been read but is missing from the list is added; one that has not been read is cut from the note, and the sentence rests on a source that has. Decides notes prose, `references`.

**Why.** Prose names people rather than keys, so nothing else checks it. [*Polyonax*](../genera/P/Polyonax.yml) cited Carpenter and Young without either in its references; a *Parasaurolophus* note cited a paper nobody had read, and now rests on two that endorse the same reading.

**Exceptions.** None.

## References

- `weishampel2004a`: Weishampel, D. B.; Dodson, P.; Osmólska, H. (2004). The Dinosauria, Second Edition. University of California Press, Berkeley.
- `upchurch2004a`: Upchurch, P.; Barrett, P. M.; Dodson, P. (2004). Sauropoda. In *The Dinosauria, 2nd edition*, pp. 259-322. University of California Press, Berkeley.
- `weishampel2004b`: Weishampel, D. B.; Barrett, P. M.; Coria, R. A.; Le Loeuff, J.; Xu, X.; Zhao, X.; Sahni, A.; Gomani, E. M. P.; Noto, C. R. (2004). Dinosaur distribution. In *The Dinosauria, 2nd edition*, pp. 517-606. University of California Press, Berkeley. doi:10.1525/california/9780520242098.003.0027
- `galton2004a`: Galton, P. M.; Upchurch, P. (2004). Prosauropoda. In *The Dinosauria, 2nd edition*, pp. 232-258. University of California Press, Berkeley.
- `jank2006a`: Jank, M.; Wetzel, A.; Meyer, C. A. (2006). A calibrated composite section for the Late Jurassic Reuchenette Formation in northwestern Switzerland (?Oxfordian, Kimmeridgian sensu gallico, Ajoie-Region). *Eclogae Geologicae Helvetiae* 99: 175-191. doi:10.1007/s00015-006-1187-8
- `buffetaut2000a`: Buffetaut, E.; Suteethorn, V.; Cuny, G.; Tong, H.; Le Loeuff, J.; Khansubha, S.; Jongautchariyakul, S. (2000). The earliest known sauropod dinosaur. *Nature* 407(6800): 72-74. doi:10.1038/35024060
- `white1973a`: White, T. E. (1973). Catalogue of the genera of dinosaurs. *Annals of Carnegie Museum* 44: 117-155. doi:10.5962/p.243870
- `carrano2012a`: Carrano, M. T.; Benson, R. B. J.; Sampson, S. D. (2012). The phylogeny of Tetanurae (Dinosauria: Theropoda). *Journal of Systematic Palaeontology* 10(2): 211-300. doi:10.1080/14772019.2011.630927
- `bonsor2023a`: Bonsor, J. A.; Lockwood, J. A. F.; Leite, J. V.; Scott-Murray, A.; Maidment, S. C. R. (2023). The osteology of the holotype of the British iguanodontian dinosaur Mantellisaurus atherfieldensis. *Monographs of the Palaeontographical Society* 177(665): 1-63. doi:10.1080/02693445.2023.2234156
- `barker2020a`: Barker, C. T.; Naish, D.; Clarkin, C. E.; Farrell, P.; Hullmann, G.; Lockyer, J.; Schneider, P.; Ward, R. K. C.; Gostling, N. J. (2020). A highly pneumatic middle Cretaceous theropod from the British Lower Greensand. *Papers in Palaeontology* 6(4): 661-679. doi:10.1002/spp2.1338
- `jones2026a`: Jones, B. (2026). The Princeton Encyclopedia of Dinosaurs: Ornithischians. Princeton University Press.
- `molina-pérez2019a`: Molina-Pérez, R.; Larramendi, A. (2019). Dinosaur Facts and Figures: The Theropods and Other Dinosauriformes. Princeton University Press.
- `benton2000c`: Benton, M. J.; Shishkin, M. A.; Unwin, D. M.; Kurochkin, E. N. (2000). Mongolian place names and stratigraphic terms. In *The Age of Dinosaurs in Russia and Mongolia (Benton, M. J.; Shishkin, M. A.; Unwin, D. M.; Kurochkin, E. N., eds.)*, pp. xxii-xxviii. Cambridge University Press, Cambridge.
