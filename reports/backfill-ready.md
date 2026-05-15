# Backfill-ready genera

Cross-reference of genera missing `species.holotype.material` and/or `diagnostic_features` (from `reports/missing-fields.md`) against the local paper corpus (`~/Desktop/open-paleo-papers/markdown/`).

Generated: 2026-05-15.

## Summary

- **Ready to queue** (paper in corpus, fields missing): **86**
- **Blocked — wrong-paper-content / partial extract** (paper key in corpus but flagged in `corpus-paper-report.md` section 1, or known-partial extract): 13
- **Blocked — no markdown** (paper still needs to be added to the corpus): 165
- **Total missing material/diagnostic_features:** 264

The `bohlin1953` (Bohlin 1953, *Fossil reptiles from Mongolia and Kansu*) markdown in the corpus is a partial extract — backfill against it has been consistently sentinel'ing. A physical copy is on order; until that lands and is scanned, all five `bohlin1953`-keyed genera are treated as blocked.

Process notes: the paper-driven backfill workflow is at `reports/paper-driven-backfill.md`. Run `npm run build-extraction-prompts -- --letter X` then dispatch the prompts and `npm run apply-paper-fields -- --letter X --apply`.

## Ready to queue, by letter

### A (7)

| Genus | Describing paper | Missing |
|---|---|---|
| Agathaumas | `cope1872` | material |
| Alwalkeria | `chatterjee1987` | diagnostic_features |
| Amargastegos | `ulansky2014b` | diagnostic_features |
| Amphicoelias | `cope1877c` | both |
| Anteavis | `martínez2025` | both |
| Archaeornithomimus | `russell1972` | material |
| Avaceratops | `dodson1986` | both |

### B (4)

| Genus | Describing paper | Missing |
|---|---|---|
| Bolong | `wu2010` | both |
| Bothriospondylus | `owen1874` | diagnostic_features |
| Brachyceratops | `gilmore1914a` | both |
| Bustingorrytitan | `salgado2023` | material |

### C (8)

| Genus | Describing paper | Missing |
|---|---|---|
| Calamospondylus | `fox1866b` | both |
| Ceratops | `marsh1888b` | diagnostic_features |
| Cetiosaurus | `owen1841` | material |
| Chasmosaurus | `lambe1914b` | material |
| Compsosuchus | `huene1933` | both |
| Crichtonpelta | `arbour2015` | both |
| Crichtonsaurus | `dong2002` | diagnostic_features |
| Cumnoria | `seeley1888a` | material |

### D (8)

| Genus | Describing paper | Missing |
|---|---|---|
| Dacentrurus | `lucas1902` | both |
| Datousaurus | `dong1984b` | both |
| Diclonius | `cope1876` | material |
| Dilophosaurus | `welles1970` | both |
| Dryptosauroides | `huene1933` | diagnostic_features |
| Dryptosaurus | `marsh1877b` | both |
| Dysganus | `cope1876` | material |
| Dystrophaeus | `cope1877a` | both |

### E (3)

| Genus | Describing paper | Missing |
|---|---|---|
| Elaphrosaurus | `janensch1920` | both |
| Euoplocephalus | `lambe1910` | diagnostic_features |
| Euskelosaurus | `huxley1866` | diagnostic_features |

### F (3)

| Genus | Describing paper | Missing |
|---|---|---|
| Fabrosaurus | `ginsburg1964` | diagnostic_features |
| Foskeia | `dieudonné2026` | diagnostic_features |
| Fushanosaurus | `wang2019b` | both |

### G (4)

| Genus | Describing paper | Missing |
|---|---|---|
| Gigantosaurus | `seeley1869b` | diagnostic_features |
| Gigantoscelus | `vanhoepen1916` | both |
| Gilmoreosaurus | `brett-surman1979` | diagnostic_features |
| Gorgosaurus | `lambe1914a` | both |

### H (5)

| Genus | Describing paper | Missing |
|---|---|---|
| Haolong | `huang2026` | both |
| Huabeisaurus | `pang2000` | both |
| Huayangosaurus | `dong1982` | both |
| Huayracursor | `hechenleitner2025` | both |
| Hypsirhophus | `cope1878` | diagnostic_features |

### I (2)

| Genus | Describing paper | Missing |
|---|---|---|
| Indosaurus | `huene1933` | diagnostic_features |
| Indosuchus | `huene1933` | diagnostic_features |

### J (3)

| Genus | Describing paper | Missing |
|---|---|---|
| Jiangxisaurus | `wei2013` | both |
| Jinfengopteryx | `ji2005` | diagnostic_features |
| Jiutaisaurus | `wu2006` | both |

### K (2)

| Genus | Describing paper | Missing |
|---|---|---|
| Khankhuuluu | `voris2025` | diagnostic_features |
| Koshisaurus | `shibata2015b` | material |

### L (6)

| Genus | Describing paper | Missing |
|---|---|---|
| Labocania | `molnar1974` | both |
| Laevisuchus | `huene1933` | both |
| Laplatasaurus | `huene1929` | material |
| Lexovisaurus | `hoffstetter1957` | diagnostic_features |
| Liaoningotitan | `zhou2018` | both |
| Liubangosaurus | `mo2010` | both |

### M (3)

| Genus | Describing paper | Missing |
|---|---|---|
| Microceratus | `mateus2008` | both |
| Microcoelus | `lydekker1893a` | diagnostic_features |
| Micropachycephalosaurus | `dong1978b` | both |

### O (2)

| Genus | Describing paper | Missing |
|---|---|---|
| Ornithomimoides | `huene1933` | both |
| Orthomerus | `seeley1883` | diagnostic_features |

### P (5)

| Genus | Describing paper | Missing |
|---|---|---|
| Pelorosaurus | `mantell1850` | diagnostic_features |
| Phyllodon | `thulborn1973` | both |
| Platytholus | `horner2022` | both |
| Prodeinodon | `osborn1924a` | diagnostic_features |
| Pukyongosaurus | `dong2001` | diagnostic_features |

### R (1)

| Genus | Describing paper | Missing |
|---|---|---|
| Ruyangosaurus | `lü2009a` | both |

### S (8)

| Genus | Describing paper | Missing |
|---|---|---|
| Sasayamagnomus | `tanaka2024` | both |
| Scansoriopteryx | `czerkas2002` | material |
| Scelidosaurus | `owen1859` | material |
| Shantungosaurus | `hu1973` | both |
| Shixinggia | `lü2005a` | both |
| Sinocalliopteryx | `ji2007` | diagnostic_features |
| Sinopeltosaurus | `ulansky2014b` | diagnostic_features |
| Suchosaurus | `owen1842` | diagnostic_features |

### T (4)

| Genus | Describing paper | Missing |
|---|---|---|
| Thecocoelurus | `huene1923` | diagnostic_features |
| Titanosaurus | `lydekker1877` | diagnostic_features |
| Trachodon | `leidy1856b` | diagnostic_features |
| Tuojiangosaurus | `dong1977` | both |

### U (1)

| Genus | Describing paper | Missing |
|---|---|---|
| Ultrasaurus | `kim1983` | diagnostic_features |

### X (3)

| Genus | Describing paper | Missing |
|---|---|---|
| Xiaosaurus | `dong1983b` | diagnostic_features |
| Xixiposaurus | `sekiya2010` | both |
| Xuwulong | `you2011` | both |

### Y (1)

| Genus | Describing paper | Missing |
|---|---|---|
| Yangchuanosaurus | `dong1978a` | both |

### Z (3)

| Genus | Describing paper | Missing |
|---|---|---|
| Zavacephale | `chinzorig2025` | diagnostic_features |
| Zhongyuansaurus | `xu2007a` | both |
| Zigongosaurus | `hou1976` | both |

## Blocked — wrong-paper-content / partial extract

These genera have a markdown file under their `described_in` key, but the content is unusable: either flagged in `corpus-paper-report.md` section 1 (wrong paper, wrong target taxon, missing article body, or boilerplate-only), or a known partial extract awaiting a fuller copy. Running the backfill will produce a sentinel JSON. Needs a corpus re-fetch first.

| Genus | Letter | Describing paper | Missing | Reason |
|---|---|---|---|---|
| Amurosaurus | A | `bolotsky1991` | both | wrong paper (2011 chapter, not 1991 original) |
| Chiayusaurus | C | `bohlin1953` | diagnostic_features | partial extract; physical copy on order |
| Coahuilaceratops | C | `loewen2010` | material | wrong paper (2007 abstract, not 2010 chapter) |
| Dromaeosauroides | D | `christiansen2003` | both | wrong paper (Bonde review chapter) |
| Heishansaurus | H | `bohlin1953` | both | partial extract; physical copy on order |
| Neuquensaurus | N | `powell1992` | both | wrong target taxon (paper is about Saltasaurus) |
| Paranthodon | P | `carroll1988` | both | textbook reference, not original description |
| Peishansaurus | P | `bohlin1953` | diagnostic_features | partial extract; physical copy on order |
| Protognathosaurus | P | `olshevsky1991` | both | Dinosaur Genera List, not primary description |
| Ruehleia | R | `galton2001` | both | agent sentinel'd; possibly wrong target taxon |
| Sauroplites | S | `bohlin1953` | diagnostic_features | partial extract; physical copy on order |
| Stegosaurides | S | `bohlin1953` | both | partial extract; physical copy on order |
| Zapsalis | Z | `marsh1877c` | diagnostic_features | target taxon not present in markdown |

## Blocked — no corpus markdown

Listed for reference. These need the describing paper added to the corpus before the backfill can run.

### A (15)

| Genus | Missing describing paper | Missing fields |
|---|---|---|
| Abrictosaurus | `hopson1975` | both |
| Achillobator | `perle1999` | both |
| Aegyptosaurus | `stromer1932` | both |
| Aeolosaurus | `powell1987` | both |
| Aletopelta | `ford2001` | both |
| Alioramus | `kurzanov1976b` | both |
| Alvarezsaurus | `bonaparte1991` | both |
| Amtosaurus | `kurzanov1978` | both |
| Amygdalodon | `cabrera1947` | both |
| Anserimimus | `barsbold1988` | both |
| Archaeoceratops | `dong1997c` | both |
| Arrhinoceratops | `parks1925` | both |
| Asiaceratops | `nessov1989` | both |
| Astigmasaura | `bellardini2025` | both |
| Atlascopcosaurus | `rich1989` | both |

### B (6)

| Genus | Missing describing paper | Missing fields |
|---|---|---|
| Batyrosaurus | `godefroit2012a` | both |
| Beipiaognathus | `hu2016` | both |
| Betasuchus | `huene1932` | both |
| Brachylophosaurus | `sternberg1953` | both |
| Breviceratops | `kurzanov1990` | both |
| Bruhathkayosaurus | `yadagiri1987` | both |

### C (16)

| Genus | Missing describing paper | Missing fields |
|---|---|---|
| Callovosaurus | `galton1980a` | both |
| Campananeyen | `lerzo2024b` | both |
| Carcharodontosaurus | `stromer1931` | diagnostic_features |
| Cariocecus | `bertozzo2025` | both |
| Carnotaurus | `bonaparte1985a` | both |
| Cetiosauriscus | `huene1927c` | both |
| Chakisaurus | `nogueira2024` | both |
| Chindesaurus | `long1995` | diagnostic_features |
| Chingkankousaurus | `young1958` | both |
| Chinshakiangosaurus | `yeh1975` | both |
| Chuandongocoelurus | `he1984` | both |
| Chubutisaurus | `delcorro1975` | both |
| Cienciargentina | `simón2025` | both |
| Cionodon | `cope1874` | both |
| Conchoraptor | `barsbold1986` | both |
| Corythosaurus | `brown1914b` | both |

### D (8)

| Genus | Missing describing paper | Missing fields |
|---|---|---|
| Dashanpusaurus | `peng2005` | both |
| Deinocheirus | `kielanjaworowska1969` | both |
| Dinodocus | `owen1884` | diagnostic_features |
| Diplotomodon | `leidy1868` | both |
| Dolichosuchus | `huene1932` | diagnostic_features |
| Duriatitan | `barrett2010` | both |
| Dyoplosaurus | `parks1924` | both |
| Dysalotosaurus | `virchow1919` | diagnostic_features |

### E (4)

| Genus | Missing describing paper | Missing fields |
|---|---|---|
| Edmontonia | `sternberg1928` | both |
| Embasaurus | `riabinin1931` | both |
| Emiliasaura | `coria2025` | both |
| Euronychodon | `antunes1991` | diagnostic_features |

### F (1)

| Genus | Missing describing paper | Missing fields |
|---|---|---|
| Fulgurotherium | `huene1932` | both |

### G (5)

| Genus | Missing describing paper | Missing fields |
|---|---|---|
| Gigantspinosaurus | `ouyang1992` | both |
| Gondwanatitan | `kellner1999a` | both |
| Gremlin | `ryan2023` | both |
| Guaibasaurus | `bonaparte1999b` | both |
| Gwyneddosaurus | `bock1945` | diagnostic_features |

### H (5)

| Genus | Missing describing paper | Missing fields |
|---|---|---|
| Harpymimus | `barsbold1984` | both |
| Horshamosaurus | `blows2015` | diagnostic_features |
| Hudiesaurus | `dong1997a` | both |
| Hulsanpes | `osmólska1982` | diagnostic_features |
| Hypacrosaurus | `brown1913` | both |

### I (3)

| Genus | Missing describing paper | Missing fields |
|---|---|---|
| Iliosuchus | `huene1932` | diagnostic_features |
| Inawentu | `filippi2024` | both |
| Itemirus | `kurzanov1976a` | both |

### J (4)

| Genus | Missing describing paper | Missing fields |
|---|---|---|
| Janenschia | `wild1991` | both |
| Jaxartosaurus | `riabinin1937` | both |
| Jingiella | `ren2024` | both |
| Jingshanosaurus | `zhang1995` | both |

### K (4)

| Genus | Missing describing paper | Missing fields |
|---|---|---|
| Kaijiangosaurus | `he1984` | both |
| Kelmayisaurus | `dong1973` | diagnostic_features |
| Kotasaurus | `yadagiri1988` | both |
| Kurupi | `iori2021` | diagnostic_features |

### L (11)

| Genus | Missing describing paper | Missing fields |
|---|---|---|
| Lambeosaurus | `parks1923` | both |
| Lametasaurus | `matley1924` | both |
| Lapparentosaurus | `bonaparte1986a` | both |
| Leaellynasaura | `rich1989` | diagnostic_features |
| Leptoceratops | `brown1914c` | both |
| Ligabueino | `bonaparte1996` | both |
| Liliensternus | `welles1984` | diagnostic_features |
| Lophorhothon | `langston1960` | both |
| Loricosaurus | `huene1927a` | both |
| Luanchuanraptor | `lü2008c` | diagnostic_features |
| Luoyanggia | `lü2009b` | diagnostic_features |

### M (9)

| Genus | Missing describing paper | Missing fields |
|---|---|---|
| Magnosaurus | `huene1932` | diagnostic_features |
| Magyarosaurus | `huene1932` | both |
| Mamenchisaurus | `young1954` | both |
| Mandschurosaurus | `riabinin1930` | diagnostic_features |
| Mantellisaurus | `paul2007` | both |
| Microhadrosaurus | `dong1979` | diagnostic_features |
| Mongolosaurus | `gilmore1933b` | both |
| Monkonosaurus | `zhao1986` | both |
| Montanoceratops | `sternberg1951` | both |

### N (6)

| Genus | Missing describing paper | Missing fields |
|---|---|---|
| Nanshiungosaurus | `dong1979` | diagnostic_features |
| Neovenator | `hutt1996` | both |
| Nevadadromeus | `bonde2022` | both |
| Ninjatitan | `gallina2021` | both |
| Noasaurus | `bonaparte1980` | both |
| Notoceratops | `tapia1919` | diagnostic_features |

### O (3)

| Genus | Missing describing paper | Missing fields |
|---|---|---|
| Ohmdenosaurus | `wild1978` | diagnostic_features |
| Orthogoniosaurus | `dasgupta1930` | diagnostic_features |
| Ouranosaurus | `taquet1972` | both |

### P (19)

| Genus | Missing describing paper | Missing fields |
|---|---|---|
| Pachysuchus | `young1951` | both |
| Palaeopteryx | `jensen1981` | both |
| Panoplosaurus | `lambe1919` | both |
| Pararhabdodon | `casanovascladellas1993` | both |
| Parksosaurus | `sternberg1937` | both |
| Parvicursor | `karhu1996` | both |
| Patagonykus | `novas1994` | both |
| Patagopelta | `riguetti2022b` | both |
| Pellegrinisaurus | `salgado1996` | both |
| Phaedrolosaurus | `dong1973` | both |
| Pinacosaurus | `gilmore1933b` | both |
| Planicoxa | `dicroce2001` | both |
| Plateosauravus | `huene1932` | both |
| Pneumatoraptor | `ősi2010b` | diagnostic_features |
| Poekilopleuron | `eudesdeslongchamps1836` | diagnostic_features |
| Polacanthoides | `nopcsa1928a` | both |
| Polyodontosaurus | `gilmore1932` | diagnostic_features |
| Polyonax | `cope1874` | both |
| Probactrosaurus | `rozhdestvensky1966` | both |

### Q (3)

| Genus | Missing describing paper | Missing fields |
|---|---|---|
| Qinlingosaurus | `xue1996` | both |
| Qiupalong | `xu2011b` | both |
| Quilmesaurus | `coria2001` | both |

### R (4)

| Genus | Missing describing paper | Missing fields |
|---|---|---|
| Rapator | `huene1932` | diagnostic_features |
| Rayososaurus | `bonaparte1996` | both |
| Rinchenia | `barsbold1997` | both |
| Riojasaurus | `bonaparte1969` | both |

### S (12)

| Genus | Missing describing paper | Missing fields |
|---|---|---|
| Saltasaurus | `bonaparte1980` | both |
| Santanaraptor | `kellner1999b` | both |
| Saurolophus | `brown1912` | both |
| Scolosaurus | `nopcsa1928b` | both |
| Scutellosaurus | `colbert1981` | both |
| Segisaurus | `camp1936` | both |
| Shamosaurus | `tumanova1983` | both |
| Shanyangosaurus | `xue1996` | both |
| Siamosaurus | `buffetaut1986` | both |
| Sierraceratops | `dalman2022b` | both |
| Siluosaurus | `dong1997b` | diagnostic_features |
| Spondylosoma | `huene1942` | both |

### T (15)

| Genus | Missing describing paper | Missing fields |
|---|---|---|
| Talarurus | `maleev1952` | both |
| Tanius | `wiman1929` | both |
| Tatisaurus | `simmons1965` | both |
| Tehuelchesaurus | `rich1999a` | both |
| Teinurosaurus | `nopcsa1928c` | diagnostic_features |
| Tendaguria | `bonaparte2000` | both |
| Tienshanosaurus | `young1937` | both |
| Timimus | `rich1994` | both |
| Titanomachya | `pérez-moreno2024` | both |
| Torvosaurus | `galton1979` | both |
| Trimucrodon | `thulborn1975` | diagnostic_features |
| Tsagantegia | `tumanova1993` | both |
| Tsintaosaurus | `young1958` | both |
| Tugulusaurus | `dong1973` | both |
| Turanoceratops | `nessov1989` | both |

### U (1)

| Genus | Missing describing paper | Missing fields |
|---|---|---|
| Udanoceratops | `kurzanov1992` | diagnostic_features |

### V (5)

| Genus | Missing describing paper | Missing fields |
|---|---|---|
| Valdosaurus | `galton1977` | both |
| Velocipes | `huene1932` | diagnostic_features |
| Velocisaurus | `bonaparte1991` | both |
| Vitosaura | `velandia2025` | both |
| Vulcanodon | `raath1972` | both |

### W (1)

| Genus | Missing describing paper | Missing fields |
|---|---|---|
| Walgettosuchus | `huene1932` | both |

### X (1)

| Genus | Missing describing paper | Missing fields |
|---|---|---|
| Xianshanosaurus | `lü2009b` | both |

### Y (3)

| Genus | Missing describing paper | Missing fields |
|---|---|---|
| Yandusaurus | `he1979` | both |
| Yeneen | `filippi2026` | both |
| Yuanyanglong | `hao2025` | diagnostic_features |

### Z (1)

| Genus | Missing describing paper | Missing fields |
|---|---|---|
| Zephyrosaurus | `sues1980` | diagnostic_features |
