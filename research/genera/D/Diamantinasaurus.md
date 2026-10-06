# *Diamantinasaurus*

## Does the printed Elderslie Station coordinate give the position of the *Diamantinasaurus* holotype?

*2026-08-19*

**Conclusion.** No. Beeston and colleagues (2024) print one point for Elderslie Station, the pastoral property, and attach it to four localities at once, the Matilda Site among them; the same point serves Elderslie localities of other taxa. It is the station's position, not the site's, and no coordinate is recorded. Governs the empty `location.coordinates` and `location.locality: Matilda Site, Elderslie Station` on [*Diamantinasaurus matildae*](../../../genera/D/Diamantinasaurus.yml).

**Evidence.**
- hocknull2009a, p. 4, Type Locality: "AODL 85, ''Matilda Site'', Elderslie Station, approximately 60 km north-west of Winton, western central Queensland, Australia".
- beeston2024a, p. 94, Systematic Palaeontology: "Localities. AODL 0085, AODL 0122, AODL 0215 and AODL 0252, Elderslie Station (22°17′26.02″S, 142°28′18.83″E), ~60 km west of Winton".
- beeston2024a, pp. 95–97: the same point is printed for "AODL 0137, Elderslie Station" (p. 95), for "QM L313, Elderslie Station" (p. 96), the *Wintonotitan wattsi* type locality, and for "AODL 0079, AODL 0117 and AODL 0125, Elderslie Station" (p. 97).

**Ruled out.**
- *[−22.290561, 142.471897].* This is Beeston and colleagues' station point converted. It covers several sites on one property and marks none of them.
- *The pair formerly stored, [−22.199722, 142.52861].* It matches no printed value, and lies about 12 km from the station point.

**Open.** The Matilda Site's own position. A source printing one for AODL 85 would settle it.

## Is the *Diamantinasaurus* holotype from the upper Winton Formation?

*2026-08-19*

**Conclusion.** The record carries `part: upper` on the informal three-fold zonation of the Winton, which Poropat and colleagues (2021) apply to both known individuals, holotype included, within quotation marks. Hocknull and colleagues (2021) put the type locality at least 350 m above the formation's base and warn that the zonation may be diachronous. Governs `location.part: upper` on [*Diamantinasaurus matildae*](../../../genera/D/Diamantinasaurus.yml).

**Evidence.**
- poropat2021a, p. 610, Abstract: "*Diamantinasaurus matildae* is represented by two individuals from the Cenomanian–lower Turonian 'upper' Winton Formation".
- hocknull2021a, p. 17: "the highest zircon population was sampled at the D. matildae type locality, which sits at least 350 m from the Winton Formation base".
- hocknull2021a, p. 15: "we urge caution in using this proposed stratigraphic sequence for palaeontological interpretations due to the diachronous uncertainty of it".

**Ruled out.**
- *Rigby and colleagues (2022) as the source for the holotype.* Their "Upper Winton Formation" (rigby2022a, p. 3) is the horizon line for AODF 663, a referred specimen from the Oliver site, AODL 0122.

**Open.** Whether "upper" holds for the Matilda Site under a zonation tied to a measured section there. Hocknull and colleagues write that "any further refinement will require much greater control of both stratigraphy and chronometric age" (hocknull2021a, p. 18).

## Is the *Diamantinasaurus* holotype AODF 603 or AODF 836?

*2026-08-01*

**Conclusion.** AODF 603, the "Matilda" skeleton. AODF 836 is a later specimen referred to the species. Governs `type_specimen.specimen_id: [AODF 603]` on [*Diamantinasaurus matildae*](../../../genera/D/Diamantinasaurus.yml).

**Evidence.**
- hocknull2009a, p. 4, Systematic Palaeontology: "Holotype. AODF 603: Right scapula, right and left humeri, right ulna, near complete right metacarpus".
- poropat2025a, p. 2598: "Previously referred specimens AODF 0836 (AODL 0127)—partial skull and postcranial skeleton".

**Ruled out.**
- *AODF 836.* Molina-Pérez and Larramendi (2020) give "*Diamantinasaurus matildae* | AODF 836" in a brain-size table (molina-pérez2020a, Animal Intelligence), while their own list of titanosaurs gives AODF 603 for the species. It is a referred specimen.
- *AODF 0603 as a different number.* Jones (2026) prints "AODF 0603" (jones2026b, p. 382), as Poropat and colleagues do; it is the same number with a leading zero.

**Open.** Nothing.

## References

- `hocknull2009a`: Hocknull, S. A.; White, M. A.; Tischler, T. R.; Cook, A. G.; Calleja, N. D.; Sloan, T.; Elliott, D. A. (2009). New Mid-Cretaceous (Latest Albian) Dinosaurs from Winton, Queensland, Australia. *PLoS ONE* 4(7): e6190. doi:10.1371/journal.pone.0006190
- `beeston2024a`: Beeston, S. L.; Poropat, S. F.; Mannion, P. D.; Pentland, A. H.; Enchelmaier, M. J.; Sloan, T.; Elliott, D. A. (2024). Reappraisal of sauropod dinosaur diversity in the Upper Cretaceous Winton Formation of Queensland, Australia, through 3D digitisation and description of new specimens. *PeerJ* 12: e17180. doi:10.7717/peerj.17180
- `poropat2021a`: Poropat, S. F.; Kundrát, M.; Mannion, P. D.; Upchurch, P.; Tischler, T. R.; Elliott, D. A. (2021). Second specimen of the Late Cretaceous Australian sauropod dinosaur Diamantinasaurus matildae provides new anatomical information on the skull and neck of early titanosaurs. *Zoological Journal of the Linnean Society* 192: 610-674. doi:10.1093/zoolinnean/zlaa173
- `hocknull2021a`: Hocknull, S. A.; Wilkinson, M.; Lawrence, R. A.; Konstantinov, V.; Mackenzie, S.; Mackenzie, R. (2021). A new giant sauropod, Australotitan cooperensis gen. et sp. nov., from the mid-Cretaceous of Australia. *PeerJ* 9: e11317. doi:10.7717/peerj.11317
- `rigby2022a`: Rigby, S. L.; Poropat, S. F.; Mannion, P. D.; Pentland, A. H.; Sloan, T.; Rumbold, S. J.; Webster, C. B.; Elliott, D. A. (2022). A juvenile Diamantinasaurus matildae (Dinosauria: Titanosauria) from the Upper Cretaceous Winton Formation of Queensland, Australia, with implications for sauropod ontogeny. *Journal of Vertebrate Paleontology* 41(6): e2047991. doi:10.1080/02724634.2021.2047991
- `poropat2025a`: Poropat, S. F.; Tosolini, A. M. P.; Beeston, S. L.; Enchelmaier, M. J.; Pentland, A. H.; Mannion, P. D.; Upchurch, P.; Chin, K.; Korasidis, V. A.; Bell, P. R.; Enriquez, N. J.; Holman, A. I.; Brosnan, L. M.; Elson, A. L.; Tripp, M.; Scarlett, A. G.; Godel, B.; Madden, R. H. C.; Rickard, W. D. A.; Bevitt, J. J.; Tischler, T. R.; Croxford, T. L. M.; Sloan, T.; Elliott, D. A.; Grice, K. (2025). Fossilized gut contents elucidate the feeding habits of sauropod dinosaurs. *Current Biology* 35(11): 2597-2613.e7. doi:10.1016/j.cub.2025.04.053
- `molina-pérez2020a`: Molina-Pérez, R.; Larramendi, A. (2020). Dinosaur Facts and Figures: The Sauropods and Other Sauropodomorphs. Princeton University Press.
- `jones2026b`: Jones, B. (2026). The Princeton Encyclopedia of Dinosaurs: Sauropods. Princeton University Press.
