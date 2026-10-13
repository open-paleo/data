# *Aragosaurus*

## Does *Aragosaurus* take Royo-Torres and colleagues' UTM position?

*2026-10-12*

**Conclusion.** Yes, read on WGS84: 40.661665, -0.879339. The paper prints a UTM pair for Las Zabacheras with no zone or datum; Galve lies in zone 30, which fixes the zone, and the two datums in use give positions 236 m apart, a bounded uncertainty at a site the paper also places 150 m north of the village. The record takes the WGS84 reading and the note gives the ED50 one. Governs `location.coordinates` on [*Aragosaurus ischiaticus*](../../../genera/A/Aragosaurus.yml).

**Evidence.**
- royo-torres2014a, p. 2: "Las Zabacheras … 150 m north of Galve village … (grid coordinates Universal Transverse Mercator 679 266 and 4 503 362)".
- Our conversion: zone 30N on WGS84, 40.661665, -0.879339; on ED50, 40.659803, -0.88069.

**Ruled out.**
- *No coordinate until a datum is stated.* Unlike [*Trimucrodon*](../T/Trimucrodon.md)'s grid, whose origin is unknown, this one is fixed to within the two datums.

**Open.** The datum the authors used.

## References

- `royo-torres2014a`: Royo-Torres, R.; Upchurch, P.; Mannion, P. D.; Mas, R.; Cobos, A.; Gascó, F.; Alcalá, L.; Sanz, J. L. (2014). The anatomy, phylogenetic relationships, and stratigraphic position of the Tithonian-Berriasian Spanish sauropod dinosaur Aragosaurus ischiaticus. *Zoological Journal of the Linnean Society* 171(3): 623-655. doi:10.1111/zoj.12144
