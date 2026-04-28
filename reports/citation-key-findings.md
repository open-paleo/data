# Citation-key audit — findings

Audit of citation keys across `genera/*.yml` against the local paper corpus at `~/Desktop/open-paleo-papers/markdown/`. Source: `reports/citation-key-audit.json`. Surfaces three classes of bibliographic issue:

1. **True key collisions** — multiple genus YAMLs cite the same key but the inline `references[]` metadata describe different papers. Standard fix: append chronological lowercase letter suffixes (`xu2018a`, `xu2018b`, ...) to disambiguate.
2. **Misfiled corpus content** — a single YAML cites a key, the paper is present in the corpus, but the paper body does not describe the cited genus. Often: same key was reused across two distinct same-author/year papers, and the corpus stored the wrong one.
3. **Reference-metadata inconsistency** — multiple YAMLs cite the same key with materially different `title` or `journal` values. A bibliographic data-quality issue regardless of paper presence.

## Summary

| Bucket | Count | Action |
|---|--:|---|
| clean | 661 | ✅ No action |
| clean-no-paper | 204 | Out of scope (paper not in corpus) |
| clean-multi-taxon | 33 | ✅ Legitimate multi-taxon paper, no action |
| **collision-divergent-refs** | **84** | **Suffix the key (`a`/`b`/`c`...) and update referencing YAMLs** |
| **collision-paper-mismatch** | **13** | Investigate — partial collision or low-mention multi-taxon |
| **misfile-suspected** | **47** | Confirm the corpus markdown matches the YAML's reference; re-fetch if not |
| **inconsistent-refs-no-paper** | **15** | Suffix the key and reconcile references; corpus has neither paper |
| no-paper-multi | 19 | Multi-taxon paper not yet acquired; no action until paper is added |

Total review surface: **159 citation keys** flagged for action (84 true collisions + 15 no-paper collisions + 13 partial-collision + 47 misfiles).

## Recommended naming convention

Adopt the BibTeX/biblatex/Zotero-standard convention for citation keys:

- **Default**: `{firstauthorlowercase}{year}` (e.g. `yates2009`).
- **On collision**: append chronological lowercase letters by publication date (`xu2018a`, `xu2018b`, `xu2018c`). Both/all colliding papers receive a suffix — never `xu2018` plus `xu2018a`, which creates ambiguity about which paper was the implicit "first".
- **Diacritics**: stripped from the author surname (`apesteguia2007`, not `apesteguía2007` — the corpus already does this for filename lookup).

Implementation steps for each collision:

1. Sort the colliding papers chronologically (by published-online date when available, otherwise by month/issue).
2. Assign `a`, `b`, `c` ... in that order.
3. Rename `papers/{key}.md` to `{key}{letter}.md` in the local archive.
4. Update every YAML referencing the old key — both `species.described_in` and `references[].id`.
5. Add an intake-validation check that rejects a new paper with a key already used by a paper with materially different reference metadata.

## Collision-divergent-refs (84)

Multiple YAMLs cite the key with clearly different reference metadata. The corpus has at most one of the underlying papers; the others are unreachable through this key. Each row groups the citing genera by their YAML's reference title — each distinct group represents a separate paper that should get its own suffixed key.

| Key | # papers | Citing genera grouped by paper | Corpus has |
|---|--:|---|---|
| `arbour2014` | 2 | **arbour2014a**: Zaraapelta `[Zoological Journal of the Linnean Society]`<br>**arbour2014b**: Ziapelta `[PLoS ONE]` | `arbour2014a` |
| `arbour2017` | 2 | **arbour2017a**: Ankylosaurus `[Journal of Systematic Palaeontology]`<br>**arbour2017b**: Zuul `[Royal Society Open Science]` | `arbour2017a` |
| `averianov2018` | 2 | **averianov2018a**: Sibirotitan `[Geobios]`<br>**averianov2018b**: Volgatitan `[Biological Communications]` | `averianov2018a` |
| `averianov2021` | 3 | **averianov2021a**: Dzharatitanis `[PLOS ONE]`<br>**averianov2021b**: Kansaignathus `[Doklady Earth Sciences]`<br>**averianov2021c**: Khulsanurus `[Historical Biology]` | `averianov2021a` |
| `averianov2022` | 2 | **averianov2022a**: Dzharaonyx `[Journal of Vertebrate Paleontology]`<br>**averianov2022b**: Ondogurvel `[Cretaceous Research]` | `averianov2022a` |
| `bonaparte1979` | 2 | **bonaparte1979a**: Mussaurus `[Ameghiniana]`<br>**bonaparte1979b**: Patagosaurus, Piatnitzkysaurus, Volkheimeria `[Science]` | `bonaparte1979a` |
| `brown1914` | 3 | **brown1914a**: Anchiceratops `[Bulletin of the American Museum of Natural History]`<br>**brown1914b**: Corythosaurus `[Bulletin of the American Museum of Natural History]`<br>**brown1914c**: Leptoceratops `[Bulletin of the American Museum of Natural History]` | `brown1914a` |
| `calvo2007` | 3 | **calvo2007a**: Futalognkosaurus `[Anais da Academia Brasileira de Ciências]`<br>**calvo2007b**: Macrogryphosaurus `[Arquivos do Museu Nacional, Rio de Janeiro]`<br>**calvo2007c**: Muyelensaurus `[Arquivos do Museu Nacional, Rio de Janeiro]` | `calvo2007a` |
| `carpenter2001` | 2 | **carpenter2001a**: Cedarpelta `[The Armored Dinosaurs. Indiana University Press, Bloomington]`<br>**carpenter2001b**: Hesperosaurus `[The Armored Dinosaurs. Indiana University Press, Bloomington]` | `carpenter2001a` |
| `choiniere2010` | 2 | **choiniere2010a**: Haplocheirus `[Science]`<br>**choiniere2010b**: Zuolong `[Journal of Vertebrate Paleontology]` | `choiniere2010a` |
| `cope1877` | 4 | **cope1877a**: Amphicoelias `[Proceedings of the American Philosophical Society]`<br>**cope1877b**: Camarasaurus `[Paleontological Bulletin]`<br>**cope1877c**: Dystrophaeus `[Proceedings of the American Philosophical Society]`<br>**cope1877d**: Tichosteus `[Proceedings of the American Philosophical Society]` | `cope1877a` |
| `coria2002` | 2 | **coria2002a**: Anabisetia `[Journal of Vertebrate Paleontology]`<br>**coria2002b**: Aucasaurus `[Journal of Vertebrate Paleontology]` | `coria2002a` |
| `coria2013` | 2 | **coria2013a**: Overosaurus `[Zootaxa]`<br>**coria2013b**: Trinisaura `[Cretaceous Research]` | `coria2013a` |
| `csiki2010` | 2 | **csiki2010a**: Balaur `[Proceedings of the National Academy of Sciences]`<br>**csiki2010b**: Paludititan `[Neues Jahrbuch für Geologie und Paläontologie - Abhandlungen]` | `csiki2010a` |
| `dalman2022` | 2 | **dalman2022a**: Bisticeratops `[New Mexico Museum of Natural History and Science Bulletin]`<br>**dalman2022b**: Sierraceratops `[Cretaceous Research]` | `dalman2022a` |
| `dong1983` | 2 | **dong1983a**: Chungkingosaurus, Gongbusaurus, Shunosaurus, Zizhongosaurus `[Palaeontologica Sinica, New Series C, Whole Number]`<br>**dong1983b**: Xiaosaurus `[Vertebrata PalAsiatica]` | `dong1983a` |
| `evans2013` | 2 | **evans2013a**: Acheroraptor `[Naturwissenschaften]`<br>**evans2013b**: Acrotholus `[Nature Communications]` | `evans2013a` |
| `ezcurra2010` | 2 | **ezcurra2010a**: Austrocheirus `[Zootaxa]`<br>**ezcurra2010b**: Chromogisaurus `[Journal of Systematic Palaeontology]` | `ezcurra2010a` |
| `fowler2020` | 2 | **fowler2020a**: Navajoceratops, Terminocavus `[PeerJ]`<br>**fowler2020b**: Trierarchuncus `[Cretaceous Research]` | `fowler2020a` |
| `funston2020` | 2 | **funston2020a**: Citipes `[Vertebrate Anatomy Morphology Palaeontology]`<br>**funston2020b**: Oksoko `[Royal Society Open Science]` | `funston2020a` |
| `galton1985` | 2 | **galton1985a**: Blikanasaurus `[Geobios]`<br>**galton1985b**: Camelotia `[Geobios]` | `galton1985a` |
| `galton2007` | 2 | **galton2007a**: Asylosaurus `[Revue de Paléobiologie]`<br>**galton2007b**: Pantydraco `[Neues Jahrbuch für Geologie und Paläontologie - Abhandlungen]` | `galton2007a` |
| `gates2014` | 2 | **gates2014a**: Adelolophus `[Hadrosaurs]`<br>**gates2014b**: Rhinorex `[Journal of Systematic Palaeontology]` | `gates2014a` |
| `gilmore1933` | 2 | **gilmore1933a**: Alectrosaurus, Bactrosaurus `[Bulletin of the American Museum of Natural History]`<br>**gilmore1933b**: Mongolosaurus, Pinacosaurus `[American Museum Novitates]` | `gilmore1933a` |
| `han2014` | 2 | **han2014a**: Changyuraptor `[Nature Communications]`<br>**han2014b**: Chuanqilong `[PLoS ONE]` | `han2014a` |
| `huene1927` | 3 | **huene1927a**: Antarctosaurus, Laplatasaurus `[Memoirs of the Queensland Museum]`<br>**huene1927b**: Cetiosauriscus `[Eclogae Geologica Helveticae]`<br>**huene1927c**: Loricosaurus `[Boletín de la Academia Nacional de Ciencias de la República Argentina]` | paper present, no clear match |
| `huxley1867` | 2 | **huxley1867a**: Acanthopholis `[Geological Magazine]`<br>**huxley1867b**: Orosaurus `[Quarterly Journal of the Geological Society of London]` | `huxley1867a` |
| `kirkland1998` | 3 | **kirkland1998a**: Eolambia `[Lower and Middle Cretaceous Terrestrial Ecosystems, S. G. Lucas, J. I. Kirkland & J. W. Estep (eds.). New Mexico Museum of Natural History and Science Bulletin]`<br>**kirkland1998b**: Gastonia `[Lower and Middle Cretaceous Terrestrial Ecosystems (S. G. Lucas, J. I. Kirkland, & J. W. Estep, eds.), New Mexico Museum of Natural History and Science Bulletin]`<br>**kirkland1998c**: Nedcolbertia `[Lower and Middle Cretaceous Terrestrial Ecosystems, New Mexico Museum of Natural History and Science Bulletin]` | paper present, no clear match |
| `kobayashi2003` | 2 | **kobayashi2003a**: Fukuisaurus `[Journal of Vertebrate Paleontology]`<br>**kobayashi2003b**: Sinornithomimus `[Acta Palaeontologica Polonica]` | `kobayashi2003a` |
| `kurzanov1976` | 2 | **kurzanov1976a**: Alioramus `[Paleontology and Biostratigraphy of Mongolia. The Joint Soviet-Mongolian Paleontological Expedition, Transactions]`<br>**kurzanov1976b**: Itemirus `[Paleontological Journal]` | `kurzanov1976a` |
| `l2005` | 2 | **l2005a**: Nemegtomaia `[Bulletin of the National Science Museum, Tokyo, Series C]`<br>**l2005b**: Shixinggia `[Acta Palaeontologica Sinica]` | `l2005a` |
| `lambe1914` | 2 | **lambe1914a**: Chasmosaurus, Gryposaurus `[The Ottawa Naturalist]`<br>**lambe1914b**: Gorgosaurus `[The Ottawa Naturalist]` | `lambe1914a` |
| `lee2019` | 2 | **lee2019a**: Gobiraptor `[PLOS ONE]`<br>**lee2019b**: Nemegtonykus `[Scientific Reports]` | `lee2019a` |
| `li2009` | 2 | **li2009a**: Leshansaurus `[Acta Geologica Sinica]`<br>**li2009b**: Xiongguanlong `[Proceedings of the Royal Society B: Biological Sciences]` | `li2009a` |
| `longrich2009` | 2 | **longrich2009a**: Albertonykus `[Cretaceous Research]`<br>**longrich2009b**: Hesperonychus `[Proceedings of the National Academy of Sciences]` | `longrich2009a` |
| `longrich2010` | 2 | **longrich2010a**: Machairasaurus `[Palaeontology]`<br>**longrich2010b**: Texacephale `[Cretaceous Research]` | `longrich2010a` |
| `longrich2013` | 2 | **longrich2013a**: Judiceratops `[Bulletin of the Peabody Museum of Natural History]`<br>**longrich2013b**: Leptorhynchos `[Bulletin of the Peabody Museum of Natural History]` | `longrich2013a` |
| `longrich2024` | 3 | **longrich2024a**: Coahuilasaurus `[Diversity]`<br>**longrich2024b**: Minqaria `[Scientific Reports]`<br>**longrich2024c**: Vectidromeus `[Cretaceous Research]` | `longrich2024a` |
| `lü2013` | 3 | **lü2013a**: Nankangia `[PLoS ONE]`<br>**lü2013b**: Yulong `[Naturwissenschaften]`<br>**lü2013c**: Yunmenglong `[Cretaceous Research]` | `lü2013a` |
| `lü2015` | 2 | **lü2015a**: Huanansaurus `[Scientific Reports]`<br>**lü2015b**: Zhenyuanlong `[Scientific Reports]` | `lü2015a` |
| `malafaia2020` | 2 | **malafaia2020a**: Lusovenator `[Journal of Vertebrate Paleontology]`<br>**malafaia2020b**: Vallibonavenatrix `[Cretaceous Research]` | `malafaia2020a` |
| `marsh1877` | 4 | **marsh1877a**: Allosaurus, Apatosaurus, Zapsalis `[American Journal of Science]`<br>**marsh1877b**: Dryptosaurus `[American Journal of Science]`<br>**marsh1877c**: Nanosaurus `[American Journal of Science]`<br>**marsh1877d**: Stegosaurus `[American Journal of Science]` | `marsh1877a` |
| `marsh1878` | 2 | **marsh1878a**: Diplodocus `[American Journal of Science]`<br>**marsh1878b**: Laosaurus `[American Journal of Science]` | `marsh1878a` |
| `marsh1890` | 2 | **marsh1890a**: Barosaurus, Ornithomimus `[American Journal of Science]`<br>**marsh1890b**: Claosaurus `[American Journal of Science]` | paper present, no clear match |
| `mo2023` | 2 | **mo2023a**: Jiangxititan `[Historical Biology]`<br>**mo2023b**: Ruixinia `[Cretaceous Research]` | `mo2023a` |
| `molnar1980` | 2 | **molnar1980a**: Kakuru `[Alcheringa: An Australasian Journal of Palaeontology]`<br>**molnar1980b**: Minmi `[Memoirs of the Queensland Museum]` | `molnar1980a` |
| `novas2005` | 3 | **novas2005a**: Neuquenraptor `[Nature]`<br>**novas2005b**: Puertasaurus `[Revista del Museo Argentino de Ciencias Naturales]`<br>**novas2005c**: Tyrannotitan `[Naturwissenschaften]` | `novas2005a` |
| `novas2008` | 2 | **novas2008a**: Austroraptor `[Proceedings of the Royal Society B: Biological Sciences]`<br>**novas2008b**: Orkoraptor `[Cretaceous Research]` | `novas2008a` |
| `novas2010` | 2 | **novas2010a**: Jaklapallisaurus, Nambalia `[Earth and Environmental Science Transactions of the Royal Society of Edinburgh]`<br>**novas2010b**: Rahiolisaurus `[Lecture Notes in Earth Sciences]` | `novas2010a` |
| `osborn1924` | 2 | **osborn1924a**: Oviraptor, Saurornithoides, Velociraptor `[American Museum Novitates]`<br>**osborn1924b**: Prodeinodon `[American Museum Novitates]` | `osborn1924a` |
| `ősi2010` | 2 | **ősi2010a**: Ajkaceratops `[Nature]`<br>**ősi2010b**: Pneumatoraptor `[Cretaceous Research]` | `ősi2010a` |
| `pol2011` | 2 | **pol2011a**: Leonerasaurus `[PLoS ONE]`<br>**pol2011b**: Manidens `[Naturwissenschaften]` | `pol2011a` |
| `prieto-márquez2019` | 2 | **prieto-márquez2019a**: Adynomosaurus `[Cretaceous Research]`<br>**prieto-márquez2019b**: Aquilarhinus `[Journal of Systematic Palaeontology]` | `prieto-márquez2019a` |
| `rauhut2005` | 3 | **rauhut2005a**: Brachytrachelopan `[Nature]`<br>**rauhut2005b**: Condorraptor `[Palaeontology]`<br>**rauhut2005c**: Xinjiangovenator `[Journal of Vertebrate Paleontology]` | `rauhut2005a` |
| `rich1999` | 2 | **rich1999a**: Qantassaurus `[Proceedings of the Second Gondwanan Dinosaur Symposium, National Science Museum Monographs]`<br>**rich1999b**: Tehuelchesaurus `[Proceedings of the Second Gondwanan Dinosaur Symposium, National Science Museum Monographs]` | `rich1999a` |
| `riguetti2022` | 2 | **riguetti2022a**: Jakapil `[Scientific Reports]`<br>**riguetti2022b**: Patagopelta `[Journal of Systematic Palaeontology]` | `riguetti2022a` |
| `royo-torres2017` | 2 | **royo-torres2017a**: Mierasaurus `[Scientific Reports]`<br>**royo-torres2017b**: Soriatitan `[Cretaceous Research]` | `royo-torres2017a` |
| `russell1993` | 2 | **russell1993a**: Alxasaurus `[Canadian Journal of Earth Sciences]`<br>**russell1993b**: Sinornithoides `[Canadian Journal of Earth Sciences]` | `russell1993a` |
| `ryan2012` | 2 | **ryan2012a**: Coronosaurus, Xenoceratops `[Canadian Journal of Earth Sciences]`<br>**ryan2012b**: Gryphoceratops, Unescoceratops `[Cretaceous Research]` | `ryan2012a` |
| `salgado2006` | 2 | **salgado2006a**: Antarctopelta `[Geodiversitas]`<br>**salgado2006b**: Zapalasaurus `[Geobios]` | `salgado2006a` |
| `senter2012` | 2 | **senter2012a**: Martharaptor `[PLoS ONE]`<br>**senter2012b**: Yurgovuchia `[PLoS ONE]` | `senter2012a` |
| `sereno2008` | 2 | **sereno2008a**: Aerosteon `[PLoS ONE]`<br>**sereno2008b**: Eocarcharia, Kryptops `[Acta Palaeontologica Polonica]` | `sereno2008a` |
| `shibata2015` | 2 | **shibata2015a**: Koshisaurus `[Zootaxa]`<br>**shibata2015b**: Sirindhorna `[PLOS ONE]` | `shibata2015a` |
| `sullivan2003` | 2 | **sullivan2003a**: Colepiocephale `[Journal of Vertebrate Paleontology]`<br>**sullivan2003b**: Hanssuesia `[Journal of Vertebrate Paleontology]` | `sullivan2003a` |
| `turner2007` | 2 | **turner2007a**: Mahakala `[Science]`<br>**turner2007b**: Shanag `[American Museum Novitates]` | `turner2007a` |
| `wang2013` | 2 | **wang2013a**: Ganzhousaurus `[Zootaxa]`<br>**wang2013b**: Yunganglong `[PLoS ONE]` | `wang2013a` |
| `wang2019` | 2 | **wang2019a**: Ambopteryx `[Nature]`<br>**wang2019b**: Fushanosaurus `[Global Geology]` | `wang2019a` |
| `wilson2003` | 2 | **wilson2003a**: Isisaurus `[Journal of Systematic Palaeontology]`<br>**wilson2003b**: Rajasaurus `[Contributions from the Museum of Paleontology, University of Michigan]` | `wilson2003a` |
| `xu1999` | 2 | **xu1999a**: Beipiaosaurus `[Nature]`<br>**xu1999b**: Sinornithosaurus `[Nature]` | `xu1999a` |
| `xu2000` | 3 | **xu2000a**: Jeholosaurus `[Vertebrata PalAsiatica]`<br>**xu2000b**: Microraptor `[Nature]`<br>**xu2000c**: Nanyangosaurus `[Vertebrata PalAsiatica]` | `xu2000a` |
| `xu2001` | 2 | **xu2001a**: Eshanosaurus `[Journal of Vertebrate Paleontology]`<br>**xu2001b**: Liaoningosaurus `[Naturwissenschaften]` | `xu2001a` |
| `xu2004` | 4 | **xu2004a**: Dilong `[Nature]`<br>**xu2004b**: Graciliraptor `[Vertebrata PalAsiatica]`<br>**xu2004c**: Mei `[Nature]`<br>**xu2004d**: Sinusonasus `[Acta Geologica Sinica]` | `xu2004a` |
| `xu2006` | 3 | **xu2006a**: Guanlong `[Nature]`<br>**xu2006b**: Sonidosaurus `[Acta Geologica Sinica]`<br>**xu2006c**: Yinlong `[Proceedings of the Royal Society B: Biological Sciences]` | `xu2006a` |
| `xu2007` | 2 | **xu2007a**: Gigantoraptor `[Nature]`<br>**xu2007b**: Zhongyuansaurus `[Acta Geologica Sinica]` | `xu2007a` |
| `xu2010` | 5 | **xu2010a**: Banji `[Vertebrata PalAsiatica]`<br>**xu2010b**: Linheraptor `[Zootaxa]`<br>**xu2010c**: Sinoceratops `[Chinese Science Bulletin]`<br>**xu2010d**: Xixianykus `[Zootaxa]`<br>**xu2010e**: Zhuchengceratops `[PLoS ONE]` | `xu2010a` |
| `xu2011` | 4 | **xu2011a**: Linhenykus `[Proceedings of the National Academy of Sciences]`<br>**xu2011b**: Linhevenator `[PLoS ONE]`<br>**xu2011c**: Qiupalong `[Cretaceous Research]`<br>**xu2011d**: Xiaotingia `[Nature]` | `xu2011a` |
| `xu2012` | 2 | **xu2012a**: Philovenator `[Vertebrata PalAsiatica]`<br>**xu2012b**: Yutyrannus `[Nature]` | paper present, no clear match |
| `xu2017` | 2 | **xu2017a**: Jianianhualong `[Nature Communications]`<br>**xu2017b**: Zhongjianosaurus `[Vertebrata PalAsiatica]` | `xu2017a` |
| `xu2018` | 3 | **xu2018a**: Bannykus, Xiyunykus `[Current Biology]`<br>**xu2018b**: Bayannurosaurus `[Science Bulletin]`<br>**xu2018c**: Lingwulong `[Nature Communications]` | `xu2018a` |
| `you2003` | 3 | **you2003a**: Equijubus `[Cretaceous Research]`<br>**you2003b**: Gobititan `[Acta Geologica Sinica (English Edition)]`<br>**you2003c**: Shuangmiaosaurus `[Acta Geologica Sinica]` | `you2003a` |
| `you2005` | 2 | **you2005a**: Auroraceratops `[Acta Geologica Sinica]`<br>**you2005b**: Lanzhousaurus `[Geological Bulletin of China]` | `you2005a` |
| `you2009` | 2 | **you2009a**: Jintasaurus `[Canadian Journal of Earth Sciences]`<br>**you2009b**: Qiaowanlong `[Proceedings of the Royal Society B: Biological Sciences]` | `you2009a` |
| `you2014` | 2 | **you2014a**: Gongpoquansaurus `[Hadrosaurs]`<br>**you2014b**: Panguraptor `[Zootaxa]` | `you2014a` |
| `zhao1993` | 2 | **zhao1993a**: Klamelisaurus `[Vertebrata PalAsiatica]`<br>**zhao1993b**: Monolophosaurus `[Canadian Journal of Earth Sciences]` | `zhao1993a` |

## Inconsistent-refs-no-paper (15)

Same as collision-divergent-refs but the corpus has none of the underlying papers. Definitely a collision; both/all entries need suffixing once papers are acquired.

| Key | # papers | Citing genera grouped by paper |
|---|--:|---|
| `bonaparte1999` | 4 | **bonaparte1999a**: Agustinia `[Y. Tomida, T. H. Rich, and P. Vickers-Rich (eds.), Proceedings of the Second Gondwanan Dinosaur Symposium, National Science Museum Monographs]`<br>**bonaparte1999b**: Dinheirosaurus `[Revista del Museo Argentino de Ciencias Naturales "Bernardino Rivadavia" e Instituto Nacional de Investigación de las Ciencias Naturales, Paleontología]`<br>**bonaparte1999c**: Guaibasaurus `[Proceedings of the Second Gondwanan Dinosaur Symposium, National Science Museum Monographs]`<br>**bonaparte1999d**: Lessemsaurus `[Ameghiniana]` |
| `dong1978` | 2 | **dong1978a**: Micropachycephalosaurus `[Vertebrata PalAsiatica]`<br>**dong1978b**: Yangchuanosaurus `[Ke Xue Tong Bao [Science Newsletter]]` |
| `dong1984` | 2 | **dong1984a**: Datousaurus `[Vertebrata PalAsiatica]`<br>**dong1984b**: Xuanhanosaurus `[Vertebrata PalAsiatica]` |
| `dong1997` | 3 | **dong1997a**: Archaeoceratops `[Sino-Japanese Silk Road Dinosaur Expedition. China Ocean Press, Beijing]`<br>**dong1997b**: Hudiesaurus `[Sino-Japanese Silk Road Dinosaur Expedition. China Ocean Press, Beijing]`<br>**dong1997c**: Siluosaurus `[Sino-Japanese Silk Road Dinosaur Expedition. China Ocean Press, Beijing]` |
| `galton1980` | 2 | **galton1980a**: Callovosaurus `[Neues Jahrbuch für Geologie und Paläontologie - Abhandlungen]`<br>**galton1980b**: Dracopelta `[Geobios]` |
| `gervais1852` | 2 | **gervais1852a**: Aepisaurus `[Zoologie et paléontologie française (animaux vertébrés)]`<br>**gervais1852b**: Oplosaurus `[Liste des ouvrages et mémoires de zoologie et d'anatomie comparée]` |
| `godefroit2012` | 2 | **godefroit2012a**: Batyrosaurus `[Bernissart Dinosaurs and Early Cretaceous Terrestrial Ecosystems]`<br>**godefroit2012b**: Kundurosaurus `[PLoS ONE]` |
| `kellner1999` | 2 | **kellner1999a**: Gondwanatitan `[Proceedings of the Second Gondwanan Dinosaur Symposium, National Science Museum Monographs]`<br>**kellner1999b**: Santanaraptor `[Boletim do Museu Nacional, Nova Série]` |
| `l2008` | 3 | **l2008a**: Dongyangosaurus `[Acta Geologica Sinica (English Edition)]`<br>**l2008b**: Eomamenchisaurus `[Acta Geologica Sinica]`<br>**l2008c**: Luanchuanraptor `[International Dinosaur Symposium in Fukui 2008: Recent Progress of the Study on Asian Dinosaurs and Paleoenvironments. Fukui Prefectural Dinosaur Museum, Fukui]` |
| `l2009` | 2 | **l2009a**: Luoyanggia, Xianshanosaurus `[Journal of the Paleontological Society of Korea]`<br>**l2009b**: Ruyangosaurus `[Geological Bulletin of China]` |
| `leidy1856` | 2 | **leidy1856a**: Palaeoscincus, Troodon `[Proceedings of the Academy of Natural Sciences of Philadelphia]`<br>**leidy1856b**: Thespesius `[Proceedings of the Academy of Natural Sciences of Philadelphia]` |
| `lerzo2024` | 2 | **lerzo2024a**: Campananeyen `[Historical Biology]`<br>**lerzo2024b**: Sidersaura `[Historical Biology]` |
| `lydekker1893` | 2 | **lydekker1893a**: Argyrosaurus `[Anales del Museo de La Plata. Paleontología Argentina]`<br>**lydekker1893b**: Sarcolestes `[Quarterly Journal of the Geological Society of London]` |
| `nopcsa1928` | 3 | **nopcsa1928a**: Polacanthoides `[Geologica Hungarica, Series Palaeontologica]`<br>**nopcsa1928b**: Scolosaurus `[Geologica Hungarica, Series Palaeontologica]`<br>**nopcsa1928c**: Teinurosaurus `[Palaeobiologica]` |
| `xu2002` | 4 | **xu2002a**: Erliansaurus `[Vertebrata PalAsiatica]`<br>**xu2002b**: Incisivosaurus `[Nature]`<br>**xu2002c**: Liaoceratops `[Nature]`<br>**xu2002d**: Sinovenator `[Nature]` |

## Misfile-suspected (47)

A single YAML cites the key, the paper is present in the corpus, but the genus name does not appear in the paper body, in any heading, in the introduction, or in the YAML's reference title. Most likely root causes:

- **Same-key collision with corpus storing the wrong paper** — the YAML's reference is for paper X but `{key}.md` contains paper Y by the same author/year. Resolve by suffixing and re-fetching.
- **Specimen renamed post-publication** — paper used a different name than the modern genus (rare, usually shows up as a synonym in the YAML).
- **Genuinely sparse mention** — old papers (1870s–1920s) sometimes name a genus only in the systematic-paleontology header without repeating it in body prose. Verify before flagging.

| Key | Citing genus | YAML reference title | Body mentions |
|---|---|---|--:|
| `andrews1921` | Sarcosaurus | LVI.—On some ramins of a Theropodous dinosaur from the Lower Lias of Barrow-on-Soa | 2 |
| `barsbold1977` | Adasaurus | O evolutsiy chishcheich dinosavrov [On the evolution of carnivorous dinosaurs] | 1 |
| `bunzel1870` | Struthiosaurus | Notice of a Fragment of a Reptilian Skull from the Upper Cretaceous of Grünbach | 1 |
| `carpenter1995` | Niobrarasaurus | The Dinosaurs of the Niobrara Chalk Formation (Upper Cretaceous, Kansas) | 0 |
| `carroll1977` | Fulengia | ‘Modern’ lizard from the Upper Triassic of China | 0 |
| `cope1872` | Agathaumas | On the existence of Dinosauria in the transition beds of Wyoming | 1 |
| `dallavecchia1998` | Histriasaurus | Remains of Sauropoda (Reptilia, Saurischia) in the Lower Cretaceous (Upper Hauterivian/Lo… | 1 |
| `deklerk2000` | Nqwebasaurus | A new coelurosaurian dinosaur from the Early Cretaceous of South Africa | 0 |
| `forster1998` | Rahonavis | Genus Correction | 0 |
| `galton1979` | Torvosaurus | A new large theropod dinosaur from the Upper Jurassic of Colorado | 0 |
| `galton2001` | Ruehleia | The prosauropod dinosaur Plateosaurus Meyer, 1837 (Saurischia: Sauropodomorpha; Upper Tri… | 0 |
| `haubold1990` | Emausaurus | Ein neuer Dinosaurier (Ornithischia, Thyreophora) aus dem unteren Jura des nördlichen Mit… | 0 |
| `head1998` | Protohadros | A new species of basal hadrosaurid (Dinosauria, Ornithischia) from the Cenomanian of Texas | 0 |
| `horner1979` | Maiasaura | Nest of juveniles provides evidence of family structure among dinosaurs | 0 |
| `hu1964` | Chilantaisaurus | [Carnosaurian remains from Alashan, Inner Mongolia] | 0 |
| `iori2021` | Kurupi | New theropod dinosaur from the Late Cretaceous of Brazil improves abelisaurid diversity | 0 |
| `jaekel1914` | Pterospondylus | Über die Wirbeltierfunde in der oberen Trias von Halberstadt | 2 |
| `ji2005` | Jinfengopteryx | First avialan bird from China | 0 |
| `ji2012` | Ningyuansaurus | A new oviraptorosaur from the Yixian Formation of Jianching, western Liaoning Province, C… | 0 |
| `jin2012` | Hexing | A new basal ornithomimosaur (Dinosauria: Theropoda) from the Early Cretaceous Yixian Form… | 0 |
| `kellner2006` | Maxakalisaurus | On a new titanosaur sauropod from the Bauru Group, Late Cretaceous of Brazil | 0 |
| `lee1996` | Pawpawsaurus | A new nodosaurid ankylosaur (Dinosauria: Ornithischia) from the Paw Paw Formation (Late A… | 0 |
| `leloeuff1993` | Iuticosaurus | European titanosaurids | 0 |
| `loewen2010` | Coahuilaceratops | Horned dinosaurs (Ornithischia: Ceratopsia) from the Upper Cretaceous (Campanian) Cerro d… | 0 |
| `longman1926` | Rhoetosaurus | A giant dinosaur from Durham Downs, Queensland | 1 |
| `lydekker1891` | Calamosaurus | On certain Ornithosaurian and Dinosaurian Remains | 0 |
| `mantell1833` | Hylaeosaurus | The geology of the south-east of England | 0 |
| `mantell1848` | Regnosaurus | On the structure of the jaws and teeth of the Iguanodon | 2 |
| `marsh1882` | Eucamerotus | Classification of the Dinosauria | 0 |
| `marsh1891` | Torosaurus | Notice of new vertebrate fossils | 0 |
| `mateus2008` | Microceratus | Two ornithischian dinosaurs renamed: <i>Microceratops</i> Bohlin 1953 and <i>Diceratops</… | 1 |
| `matthew1922` | Dromaeosaurus | The family Deinodontidae, with notice of a new genus from the Cretaceous of Alberta | 1 |
| `meyer1861` | Archaeopteryx | [Die Feder von Solenhofen] [The feather of Solnhofen] | 1 |
| `nesbitt2015` | Lepidus | The early fossil record of dinosaurs in North America: A new neotheropod from the base of… | 0 |
| `perle1993` | Mononykus | Correction: Flightless bird from the Cretaceous of Mongolia | 2 |
| `seeley1869` | Macrurosaurus | Discovery of Dakosaurus in England | 0 |
| `seeley1874` | Craterosaurus | On the Base of a large Lacertian Cranium from the Potton Sands, presumably Dinosaurian | 0 |
| `sereno2012` | Pegomastax | Taxonomy, morphology, masticatory function and phylogeny of heterodontosaurid dinosaurs | 0 |
| `sternberg1928` | Edmontonia | A new armored dinosaur from the Edmonton Formation of Alberta | 0 |
| `sternfeld1911` | Tornieria | Zur Nomenklatur der Gattung Gigantosaurus Fraas [On the nomenclature of the genus Giganto… | 1 |
| `sues1980` | Zephyrosaurus | Anatomy and relationships of a new hypsilophodontid dinosaur from the Lower Cretaceous of… | 0 |
| `tidwell1999` | Cedarosaurus | New sauropod from the Lower Cretaceous of Utah, USA | 0 |
| `wall1979` | Gravitholus | Notes on pachycephalosaurid dinosaurs (Reptilia: Ornithischia) from North America, with c… | 1 |
| `wieland1909` | Hierosaurus | A new armored saurian from the Niobrara | 1 |
| `xijin1999` | Chaoyangsaurus | The earliest ceratopsian from the Tuchengzi Formation of Liaoning, China | 0 |
| `young1959` | Chialingosaurus | On a new Stegosauria from Szechuan, China | 0 |
| `zhao1986` | Monkonosaurus | [Reptiles] | 0 |

## Collision-paper-mismatch (13)

Multiple YAMLs cite the key, the paper is present, and references appear similar enough not to flag as divergent — but the paper does not describe all citing genera. Mixed signal: could be a partial collision (some refs are wrong), a survey paper that lists genera without describing them in detail, or a low-mention multi-taxon paper.

| Key | Citing genera (✓ = paper describes) |
|---|---|
| `bohlin1953` | Heishansaurus ✗(0), Peishansaurus ✗(0), Sauroplites ✗(0), Stegosaurides ✗(0) |
| `bonaparte1984` | Abelisaurus ✓, Amargasaurus ✗(2) |
| `brett-surman1979` | Gilmoreosaurus ✗(0), Secernosaurus ✗(0) |
| `cope1876` | Diclonius ✓, Dysganus ✓, Monoclonius ✗(0), Paronychodon ✓ |
| `farke2011` | Spinops ✓, Vagaceratops ✗(0) |
| `filippi2011` | Narambuenatitan ✓, Petrobrasaurus ✗(0) |
| `harrison1975` | Bradycneme ✓, Heptasteornis ✗(1) |
| `huene1923` | Altispinax ✗(0), Thecocoelurus ✗(0) |
| `lucas1902` | Dacentrurus ✗(1), Hoplitosaurus ✗(1) |
| `marsh1888` | Pleurocoelus ✗(0), Priconodon ✓ |
| `marsh1889` | Nodosaurus ✗(1), Triceratops ✗(1) |
| `mcdonald2018` | Dynamoterror ✓, Invictarx ✗(0) |
| `young1942` | Chienkosaurus ✓, Sinocoelurus ✗(1), Szechuanosaurus ✓ |

## Legitimate multi-taxon papers (33)

For reference: keys where multiple YAMLs cite the same paper and the paper genuinely describes all of them. No action needed; included so they can be excluded from collision review.

<details><summary>List</summary>

| Key | Citing genera |
|---|---|
| `apesteguía2007` | Amargatitanis, Nopcsaspondylus |
| `barker2021` | Ceratosuchops, Riparovenator |
| `broom1911` | Geranosaurus, Gryponyx |
| `clark2001` | Citipati, Khaan |
| `díaz2025` | Petrustitan, Uriash |
| `galton2009` | Elrhazosaurus, Owenodon |
| `haughton1924` | Lycorhinus, Melanorosaurus |
| `hechenleitner2020` | Bravasaurus, Punatitan |
| `hocknull2009` | Australovenator, Diamantinasaurus, Wintonotitan |
| `hunt1993` | Anasazisaurus, Naashoibitosaurus |
| `hunt1998` | Camposaurus, Caseosaurus |
| `jensen1985` | Supersaurus, Ultrasaurus |
| `kutty2007` | Lamplughsaura, Pradhania |
| `maidment2008` | Loricatosaurus, Stegosaurus |
| `marsh1885` | Anchisaurus, Camptosaurus |
| `maryanska1977` | Saichania, Tarchia |
| `maryaska1974` | Homalocephale, Tylocephale |
| `mcdonald2010` | Hippodraco, Iguanacolossus |
| `motta2016` | Aoniraptor, Taurovenator |
| `norman2010` | Barilium, Hypselospinus |
| `novas2019` | Isasicursor, Nullotitan |
| `osborn1905` | Albertosaurus, Tyrannosaurus |
| `ostrom1970` | Microvenator, Sauropelta, Tenontosaurus |
| `rozadilla2021` | Huallasaurus, Kelumapusaura |
| `russell1972` | Archaeornithomimus, Dromiceiomimus |
| `samathi2019` | Phuwiangvenator, Vayuraptor |
| `sampson2010` | Kosmoceratops, Utahceratops |
| `seeley1879` | Anoplosaurus, Syngonosaurus |
| `sereno1999` | Jobaria, Nigersaurus |
| `sereno2004` | Rugops, Spinostropheus |
| `shen2017` | Daliansaurus, Liaoningvenator |
| `sullivan2011` | Epichirostenotes, Ojoraptorsaurus |
| `wang2021` | Hamititan, Silutitan |

</details>
