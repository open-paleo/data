# Couche III

## What do the cited works say about the age of Couche III?

*2026-11-23*

**Conclusion.** Maastrichtian throughout. Kocsis and colleagues (2013), who write the bed "Bed III", correlate its isotope values with the latest Maastrichtian. Of the works cited, only Longrich and colleagues (2026) date the lower part separately: its shark fauna resembles that of the upper part, so they read it as late but not latest Maastrichtian, with its exact age unknown. Governs `stages: [Maastrichtian]` on [Couche III](../../../stratigraphy/c/couche-iii.yml).

**Evidence.**
- longrich2026a, p. 3, Geological Setting: "Couche III is late Maastrichtian, Couche II is Paleocene, and Couches 0 and I are Early Eocene in age"; for the lower part, "Its precise age is unknown, but the shark fauna resembles that of Upper Couche III".
- kocsis2013a, p. 74, Abstract: "The isotope data from the older Paleocene (Bed IIb) and Cretaceous (upper Bed III) beds in the Ouled Abdoun Basin can be correlated with the latest Danian–early Selandian and the latest Maastrichtian global isotope record, respectively."
- kocsis2013a, p. 75: in the Ganntour Basin "the top phosphate level (L2) most possibly correlates with the upper part of Bed III (from superior bone bed) of the Ouled Abdoun Basin"; p. 76: "Because the Cretaceous beds are very condensed in the Ouled Abdoun area, samples from the Ganntour Basins at Ben Guerir were acquired to widen our stratigraphic range."
- kocsis2013a, p. 85: in Bed III "while the δ18OPO4 values show a small positive shift, the carbon isotope values decrease. This variation can correspond to the latest Maastrichtian, when it is compared to the high-resolution deep-sea record from the Shatsky Rise".

**Ruled out.** Nothing.

**Open.** The age of the lower part within the late Maastrichtian, which Longrich and colleagues (2026) call unknown. It does not change the stage.

## Should Upper and Lower Couche III be separate entries?

*2026-10-02*

**Conclusion.** No. Couche III is one informal unit, a working division of the phosphate mining industry, and "upper" and "lower" are positions within it, recorded in `location.part`. Both parts are Maastrichtian, so two entries would carry the same stages and differ only in their notes; the gap between them is finer than a stage. Governs one entry for [Couche III](../../../stratigraphy/c/couche-iii.yml), `location.part: upper` on [*Ajnabia odysseus*](../../../genera/A/Ajnabia.yml), [*Chenanisaurus barbaricus*](../../../genera/C/Chenanisaurus.yml), [*Minqaria bata*](../../../genera/M/Minqaria.yml) and [*Taleta taleta*](../../../genera/T/Taleta.yml), and `location.part: lower` on [*Phosphatotitan khouribgaensis*](../../../genera/P/Phosphatotitan.yml).

**Evidence.**
- longrich2017a, p. 41: "The phosphates are divided locally by OCP into a series of beds or 'couches'"; p. 42: the designations exist "primarily for the use of the local phosphate mining industry and are not intended for the purposes of stratigraphic or biostratigraphic correlation".
- longrich2026a, p. 3: "Upper Couche III is of latest Maastrichtian age, and dates to the final million years of the Maastrichtian. Lower Couche III appears to be slightly older … suggesting it is late, but not latest, Maastrichtian in age"; "A significant period of time (≥1 Ma) separates the upper and lower Couche III".

**Ruled out.**
- *Upper Couche III and Lower Couche III as named units.* They are positions, and the rule that a position goes in `part`, not in a member name, applies (see [methods](../../methods.md)). No source erects either as a unit.

**Open.** Nothing.

## References

- `longrich2026a`: Longrich, N. R.; Pérez-Moreno, A.; Díez Díaz, V.; Pereda-Suberbiola, X.; Bardet, N.; Jalil, N. E. (2026). A Titanosaurian Sauropod with South American Affinities (Lognkosauria: Argentinosauridae) from the Late Maastrichtian of Morocco and Evidence for Dinosaur Endemism in Africa. *Diversity* 18(5). doi:10.3390/d18050241
- `kocsis2013a`: Kocsis, L.; Gheerbrant, E.; Mouflih, M.; Cappetta, H.; Yans, J.; Amaghzaz, M. (2013). Comprehensive stable isotope investigation of marine biogenic apatite from the late Cretaceous-early Eocene phosphate series of Morocco. *Palaeogeography, Palaeoclimatology, Palaeoecology* 394: 74-88. doi:10.1016/j.palaeo.2013.11.002
- `longrich2017a`: Longrich, N. R.; Pereda-Suberbiola, X.; Jalil, N. E.; Khaldoune, F.; Jourani, E. (2017). An abelisaurid from the latest Cretaceous (late Maastrichtian) of Morocco, North Africa. *Cretaceous Research* 76: 40-52. doi:10.1016/j.cretres.2017.03.021
