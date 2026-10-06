# *Deinocheirus*

## Does the *Deinocheirus* type locality have a site number within Altan Uul III?

*2026-08-17*

**Conclusion.** No. Osmólska and Roniewicz (1970) give the type locality as Altan Uul III and cite Gradziński and colleagues' (1969) Text-fig. 6 for the exact spot. That figure is a sketch map on which the three skeletons collected there are numbered 1 to 3. The *Deinocheirus* forelimbs are number 2, so "2" is a label for a skeleton on one figure and not a site designation. The same paper gives Altan Uul III's exposures as a range of latitude and longitude, which is not converted into a point. Governs `location.locality: Altan Uul III` and the empty `location.coordinates` on [*Deinocheirus mirificus*](../../../genera/D/Deinocheirus.yml).

**Evidence.**
- osmólska1970a, p. 5: the skeleton "was found by Prof. Z. Kielan-Jaworowska at Altan Ula III locality … its exact location is given by Gradziński et al. (l. c., Text-fig. 6"; p. 8: "Type locality: Altan Ula III, Nemegt Basin, Gobi Desert, Mongolian People's Republic."
- gradziński1969a, p. 47, Fig. 6 caption: "Sketch-map of locality Altan Ula III … Skeletons indicated by numbers: 1 - fragmentary skeleton of large Tarbosaurus sp., 2 - extremely long (2.5 m) fore limbs and shoulder girdle of an unknown theropod dinosaur, 3 - fragmentary skeleton of large Tarbosaurus sp."
- gradziński1969a, p. 46: "The exposures extend over the area between 100°28'40"-100°30' longitude E, and 43°34'20"-43°37' latitude N".

**Ruled out.**
- *"Site 2" as part of the locality.* The number of the skeleton on Text-fig. 6, not a named or numbered site.
- *43.566387, 100.48278.* The pair stored before, which no source read prints. Its latitude, 43°33'59", falls south of the exposure range Gradziński and colleagues give for Altan Uul III.

**Open.** Nothing.

## Are ZPAL MgD-I/6, IGM 100/18 and MPC-D 100/18 one specimen?

*2026-08-01*

**Conclusion.** Yes. Osmólska and Roniewicz (1970) designate the shoulder girdle and forelimbs as the type under the Polish number MgD-I/6, and Lee and colleagues (2014) give the specimen's current number at the Mongolian Paleontological Center as MPC-D 100/18, "formerly ZPal MgD-I/6". Governs `type_specimen.specimen_id: [MPC-D 100/18]` on [*Deinocheirus mirificus*](../../../genera/D/Deinocheirus.yml).

**Evidence.**
- osmólska1970a, p. 8: "Type specimen: Shoulder girdle and fore limbs (Z. Pal. No. MgD-I/6)".
- lee2014a, p. 257: "Holotype. Paleontological Center of Mongolian Academy of Sciences (Ulaanbaatar, Mongolia) MPC-D 100/18 (formerly ZPal MgD-I/6) includes pectoral girdles, forelimbs, and fragments of vertebrae, ribs and gastralia".

**Ruled out.**
- *ZPAL MgD-I/6 as the current number.* Molina-Pérez and Larramendi (2019) give "*Deinocheirus mirificus* ZPAL MgD-I/6" (molina-pérez2019a, Chronology of theropods considered largest historically), the number before the specimen went to Ulaanbaatar.
- *IGM 100/18 as a different specimen.* Jones (2026) gives "IGM 100/18—forelimbs and fragments" (jones2026c, p. 503). IGM is a former code of the same institution, which `institutions.yaml` keeps as an alias of MPC, and the number is the same.

**Open.** Nothing.

## References

- `osmólska1970a`: Osmólska, H.; Roniewicz, E. (1970). Deinocheiridae, a new family of theropod dinosaurs. *Palaeontologia Polonica* 21: 5-19.
- `gradziński1969a`: Gradziński, R.; Kaźmierczak, J.; Lefeld, J. (1969). Geographical and geological data from the Polish-Mongolian Palaeontological Expeditions. *Palaeontologia Polonica* 19: 33-82.
- `lee2014a`: Lee, Y. N.; Barsbold, R.; Currie, P. J.; Kobayashi, Y.; Lee, H. J.; Godefroit, P.; Escuillié, F. O.; Chinzorig, T. (2014). Resolving the long-standing enigmas of a giant ornithomimosaur Deinocheirus mirificus. *Nature* 515(7526): 257-260. doi:10.1038/nature13874
- `molina-pérez2019a`: Molina-Pérez, R.; Larramendi, A. (2019). Dinosaur Facts and Figures: The Theropods and Other Dinosauriformes. Princeton University Press.
- `jones2026c`: Jones, B. (2026). The Princeton Encyclopedia of Dinosaurs: Theropods. Princeton University Press.
