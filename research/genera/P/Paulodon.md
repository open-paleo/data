# *Paulodon*

## How is the Paulodon type site's UTM position converted?

*2026-09-01*

**Conclusion.** As UTM zone 30N on ETRS89, giving 40.6459, −0.8839. The papers print an easting and northing with no zone or datum; zone 30N is the only zone that contains Galve, and the older ED50 datum would move the point about 230 m. Governs `location.coordinates: [40.6459, -0.8839]` on [*Paulodon galvensis*](../../../genera/P/Paulodon.yml).

**Evidence.**
- verdú2015a, p. 254, Type locality: "The site SC-1 lies within the SIBELCO EUROPE clay mine in Galve (Fig. 1), Province of Teruel, Aragón, Spain (Universal Transverse Mercator grid coordinates 678925,96 and 4501598,87)".
- sancarlo2025a, p. 311, Locality and horizon: the same sentence and figures.
- Read as zone 30N, 678925.96 E, 4501598.87 N converts to 40.645866, −0.883860 on ETRS89 and to 40.644027, −0.885153 on ED50 (our calculation).

**Ruled out.**
- *40.7, −0.85.* The record stored this pair until 2026-09-01. It is about 6.7 km from the printed position.
- *SC-2.* Verdú and colleagues (2015) distinguish "The adult type site San Cristobal 1 (SC-1) and the perinate site San Cristobal 2 (SC-2)", which "are near to one another but represent different levels" (verdú2015a, p. 251); the holotype is from SC-1.

**Open.** The datum the authors used; neither paper states it. The two readings differ by about 230 m.

## References

- `verdú2015a`: Verdú, F. J.; Royo-Torres, R.; Cobos, A.; Alcalá, L. (2015). Perinates of a new species of Iguanodon (Ornithischia: Ornithopoda) from the lower Barremian of Galve (Teruel, Spain). *Cretaceous Research* 56: 250-264. doi:10.1016/j.cretres.2015.05.010
- `sancarlo2025a`: Sancarlo, F.; Mandorlo, D.; Ford, T. L. (2025). Reassessment of Iguanodon galvensis classification. *Mesozoic* 2(4): 302-312. doi:10.11646/mesozoic.2.4.3
