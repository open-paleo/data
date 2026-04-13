# Type Species Verification — PBDB Cross-Reference

Verified 1286 genera against PBDB `rid` (describing reference) heuristic.
A species sharing the genus's `rid` was described in the same paper as the
genus — the standard indicator of a type species.

- **Confirmed correct: 1141**
- **Mismatches: 18** (our type species differs from PBDB)
- **Ambiguous: 17** (multiple or no rid matches — need manual check)
- **No valid species in PBDB: 6**
- **Genus not in PBDB: 104** (cannot verify automatically)

---

## Mismatches (18)

| Genus | Ours | PBDB suggests | Notes |
|-------|------|---------------|-------|
| Archaeopteryx | *A. albersdoerferi* | *A. lithographica* | Change to A. lithographica; In 2011, BMNH 37001 was designated the **neotype** for A. lithographica |
| Camptosaurus | *C. aphanoecetes* | *C. dispar* | Change to C. dispar; **Existing data for C. aphanoecetes should be used for C. dispar instead** |
| Eucnemesaurus | *E. entaxonis* | *E. fortis* | Change to E. fortis; Holotype is TrM 119; However, we should flag this genus as disputed because it is "usually" regarded a synonym for Euskelosaurus. |
| Gastonia | *G. lorriemcwhinneyae* | *G. burgei* | Change to G. burgei (Kirkland 1998, holotype CEUM 1307) |
| Gryposaurus | *G. monumentensis* | *G. notabilis* | Change to G. notabilis; Holotype NMC 2278 |
| Lufengosaurus | *L. magnus* | *L. huenei* | Change to L. huenei; Holotype IVPP V15 |
| Mamenchisaurus | *M. hochuanensis* | *M. constructus* | Change to M constructus; Holotype IVPP V. 790; |
| Microraptor | *M. gui* | *M. zhaoianus* | Change to M. zhaoianus; Holotype IVPP V 12330; |
| Miragaia | *M. longispinus* | *M. longicollum* | Change to M. longicollum; Holotype ML 433; |
| Nothronychus | *N. graffami* | *N. mckinleyi* | Change to N. mckinleyi; Holotype MSM P2106; |
| Omeisaurus | *O. luoquanensis* | *O. junghsiensis* | Change to O. junghsiensis; The holotype was never assigned a specimen ID and was lost during WW2 |
| Pachyrhinosaurus | *P. perotorum* | *P. canadensis* | Change to P. canadensis; Holotype NMC 8867; |
| Panoplosaurus | *P. rugosidens* | *P. mirus* | Change to P. mirus; Holotype CMN 2759; |
| Richardoestesia | *Asiamericana asiatica* | *R. gilmorei* | Change to R. gilmorei; Holotype NMC 343; |
| Scolosaurus | *S. thronus* | *S. cutleri* | Change to S. cutleri; Holotype NHMUK PV R.5161 |
| Shri | *S. rapax* | *S. devi* | Change to S. devi; Holotype IGM 100/980; |
| Sinraptor | *S. hepingensis* | *S. dongi* | Change to S. dongi; Holotype IVPP 10600; |
| Stegosaurus | *S. stenops* | *S. armatus* | Keep |
| Yunnanosaurus | *Y. youngi* | *Y. huangi* | Change to Y. huangi; Holotype IVPP V20; |

---

## Ambiguous (17)

These genera had multiple species sharing the genus rid, or no species
matched the rid at all. The rid heuristic is inconclusive here.

| Genus | Ours | Valid species in PBDB | Reason | Notes |
|-------|------|---------------------|--------|-------|
| Agujaceratops | *A. mavericus* | *A. mavericus*, *A. mariscalensis* | no rid match | |
| Archaeornithomimus | *A. bissektensis* | *A. asiaticus*, *A. bissektensis* | no rid match | |
| Camptosaurus | *C. aphanoecetes* | *C. dispar*, *C. aphanoecetes* | no rid match | Also in mismatches above via #1853 |
| Carcharodontosaurus | *C. saharicus* | *C. saharicus*, *C. iguidensis* | no rid match | |
| Cetiosaurus | *C. philippsii* | *C. philippsii*, *C. oxoniensis* | no rid match | |
| Chasmosaurus | *C. belli* | *C. russelli*, *C. belli* | no rid match | |
| Dicraeosaurus | *D. hansemanni* | *D. hansemanni*, *D. sattleri* | ambiguous rid | Both species share genus rid |
| Dryosaurus | *D. altus* | *D. elderae*, *D. altus* | no rid match | |
| Galeamopus | *G. hayi* | *G. hayi*, *G. pabsti* | no rid match | |
| Haplocanthosaurus | *H. priscus* | *H. priscus*, *H. delfsi* | no rid match | |
| Iguanodon | *I. bernissartensis* | *I. bernissartensis*, *I. major*, *I. galvensis* | no rid match | |
| Megalosaurus | *M. bucklandii* | *M. tibetensis*, *M. bucklandii*, *M. dapukaensis* | no rid match | |
| Mochlodon | *M. priscus* | *M. priscus*, *M. vorosi* | no rid match | |
| Ornithomimus | *O. minutus* | *O. minutus*, *O. velox*, *O. tenuis*, *O. edmontonicus* | ambiguous rid | *O. velox* and *O. tenuis* share genus rid |
| Polacanthus | *P. rudgwickensis* | *P. rudgwickensis*, *P. foxii* | no rid match | |
| Sphaerotholus | *S. buchholtzae* | *S. edmontonensis*, *S. triregnum*, *S. buchholtzae*, *S. lyonsi*, *S. goodwini* | ambiguous rid | *S. buchholtzae* and *S. goodwini* share genus rid; previously flagged in #1853 |
| Struthiosaurus | *S. austriacus* | *S. languedocensis*, *S. austriacus*, *S. transylvanicus* | no rid match | |

---

## No Valid Species in PBDB (6)

These genera exist in PBDB but have no valid species entries (all may be
nomen dubium or not yet entered).

| Genus | Ours | PBDB notes |
|-------|------|------------|
| Altispinax | *A. dunkeri* | Huene 1923; no species entered |
| Hanssuesia | *Troodon sternbergi* | Sullivan 2003; species name uses wrong genus |
| Minotaurasaurus | *M. ramachandrani* | Miles and Miles 2009; no species entered |
| Qianzhousaurus | *Q. sinensis* | Lü et al. 2014; no species entered |
| Tienshanosaurus | *T. chitaiensis* | Young 1937; species listed as nomen dubium |
| Zigongosaurus | *Z. fuxiensis* | Hou et al. 1976; no species entered |

---

## Not in PBDB (104)

These genera were not found in PBDB at all. They are mostly obscure,
dubious, or very recently described taxa. Cannot verify type species
automatically.

| Genus | Ours |
|-------|------|
| Acanthopholis | *A. horrida* |
| Aepisaurus | *A. elephantinus* |
| Algoasaurus | *A. bauri* |
| Astrodon | *A. johnstoni* |
| Australotitan | *A. cooperensis* |
| Beipiaognathus | *B. jii* |
| Betasuchus | *B. bredai* |
| Brachyceratops | *B. montanensis* |
| Bradycneme | *B. draculae* |
| Bruhathkayosaurus | *B. matleyi* |
| Campylodoniscus | *C. ameghinoi* |
| Chialingosaurus | *C. kuani* |
| Chingkankousaurus | *C. fragilis* |
| Chondrosteosaurus | *C. gigas* |
| Cionodon | *C. arctatus* |
| Compsosuchus | *C. solus* |
| Craterosaurus | *C. pottonensis* |
| Cristatusaurus | *C. lapparenti* |
| Dandakosaurus | *D. indicus* |
| Diclonius | *D. pentagonus* |
| Diplotomodon | *D. horrificus* |
| Dolichosuchus | *D. cristatus* |
| Dysganus | *D. encaustus* |
| Eucamerotus | *E. foxi* |
| Fulengia | *F. youngi* |
| Fulgurotherium | *F. australe* |
| Geranosaurus | *G. atavus* |
| Glishades | *G. ericksoni* |
| Gravitholus | *G. albertae* |
| Gryponyx | *G. africanus* |
| Gwyneddosaurus | *G. erici* |
| Halticosaurus | *H. longotarsus* |
| Heishansaurus | *H. pachycephalus* |
| Heptasteornis | *H. andrewsi* |
| Hierosaurus | *H. sternbergii* |
| Hypselosaurus | *H. priscus* |
| Hypsibema | *H. crassicauda* |
| Iliosuchus | *I. incognitus* |
| Inosaurus | *I. tedreftensis* |
| Iuticosaurus | *I. valdensis* |
| Jiutaisaurus | *J. xidiensis* |
| Kakuru | *K. kujani* |
| Koparion | *K. douglassi* |
| Kulceratops | *K. kulensis* |
| Kundurosaurus | *K. nagornyi* |
| Laosaurus | *L. celer* |
| Loncosaurus | *L. argentinus* |
| Loricosaurus | *L. scutatus* |
| Macrurosaurus | *M. semnus* |
| Maleevus | *M. disparoserratus* |
| Marmarospondylus | *M. robustus* |
| Microceratus | *M. gobiensis* |
| Microhadrosaurus | *M. nanshiungensis* |
| Minmi | *M. paravertebra* |
| Monkonosaurus | *M. lawulacus* |
| Morinosaurus | *M. typus* |
| Neosodon | *N. praecursor* |
| Ojoraptorsaurus | *O. boerei* |
| Ornithomimoides | *O. barasimlensis* |
| Orosaurus | *O. capensis* |
| Orthogoniosaurus | *O. matleyi* |
| Ozraptor | *O. subotaii* |
| Pachysuchus | *P. imperfectus* |
| Palaeopteryx | *P. thomsoni* |
| Palaeoscincus | *P. costatus* |
| Peishansaurus | *P. rutilensis* |
| Phaedrolosaurus | *P. ilikensis* |
| Phyllodon | *P. henkeli* |
| Podokesaurus | *P. holyokensis* |
| Poekilopleuron | *P. bucklandii* |
| Polacanthoides | *P. ponderosus* |
| Polyodontosaurus | *P. grandis* |
| Polyonax | *P. mortuarius* |
| Priconodon | *P. crassus* |
| Priodontognathus | *P. phillipsii* |
| Prodeinodon | *P. mongoliensis* |
| Pteropelyx | *P. grallipes* |
| Pterospondylus | *P. trielbae* |
| Pukyongosaurus | *P. millenniumi* |
| Qinlingosaurus | *Q. luonanensis* |
| Rapator | *R. ornitholestoides* |
| Regnosaurus | *R. northamptoni* |
| Rugocaudia | *R. cooneyi* |
| Siamosaurus | *S. suteethorni* |
| Siluosaurus | *S. zhangqiani* |
| Sinocoelurus | *S. fragilis* |
| Stegosaurides | *S. olenevi* |
| Syngonosaurus | *S. macrocercus* |
| Szechuanosaurus | *S. campi* |
| Tatisaurus | *T. oehleri* |
| Teinurosaurus | *T. sauvagei* |
| Texacephale | *T. langstoni* |
| Tharosaurus | *T. indicus* |
| Thecocoelurus | *T. daviesi* |
| Thecospondylus | *T. horneri* |
| Thespesius | *T. occidentalis* |
| Tianchisaurus | *T. nedegoapeferima* |
| Tichosteus | *T. lucasanus* |
| Trimucrodon | *T. cuneatus* |
| Wakinosaurus | *W. satoi* |
| Willinakaqe | *W. salitralensis* |
| Wyleyia | *W. valdensis* |
| Zhejiangosaurus | *Z. lishuiensis* |
| Zizhongosaurus | *Z. chuanchengensis* |
