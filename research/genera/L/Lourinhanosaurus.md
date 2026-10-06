# *Lourinhanosaurus*

## On which datum is Mateus's grid reference recorded?

*2026-10-06*

**Conclusion.** WGS84. The record carries 39.247975, -9.338978, the nominal reading of the grid reference MD707443 in UTM zone 29 on WGS84 (our conversion). The paper names no datum; read on the European Datum 1950 it would lie about 240 m to the southwest, at 39.246128, -9.340371, within the uncertainty a six-figure reference already carries. Governs `location.coordinates` on [*Lourinhanosaurus antunesi*](../../../genera/L/Lourinhanosaurus.yml).

**Evidence.**
- mateus1998a, p. 114, Locality and age: "The dinosaur was discovered at Peralta, about 75 Km NW of Lisbon (Portugal), near Lourinhã (UTM coordinates: MD707443)".

**Ruled out.**
- *No position printed.* The coordinate was deleted although the describing paper prints a grid reference, which converts as a printed coordinate (see [methods](../../methods.md#a-survey-description-or-an-area-range-is-not-converted-into-a-point)).
- *The deleted pair, 39.14, -9.19.* It lies about 17.6 km from the grid reference and no source read prints it.

**Open.** The datum. A source naming the map series or datum the reference was read from would settle the 240 m.

## Was the *Lourinhanosaurus* holotype found at Peralta or at Vale Bravo, and where is the site?

*2026-08-29*

**Conclusion.** Peralta, near Lourinhã. The describing paper names Peralta and gives the site a six-figure UTM grid reference, MD707443. In UTM zone 29S, the zone that covers Lourinhã, the centre of that 100 m square converts to 39.247975, -9.338978 on WGS84, or 39.246128, -9.340371 if the reference is on the European Datum 1950 (our conversion). The paper does not name its datum. Governs `location.locality: Peralta` on [*Lourinhanosaurus antunesi*](../../../genera/L/Lourinhanosaurus.yml), and bears on `location.coordinates` for the same record.

**Evidence.**
- mateus1998a, p. 114, Locality and age: "The dinosaur was discovered at Peralta, about 75 Km NW of Lisbon (Portugal), near Lourinhã (UTM coordinates: MD707443)".
- carrano2012a, p. 234: "Peralta, near Lourinhã, Estremadura, Portugal; Sobral Formation".

**Ruled out.**
- *The grid reference for the Lusotitan lectotype.* Mocho and colleagues also call the *Lusotitan* site "The Peralta quarry" (mocho2016a, Geological setting), but no source ties Mateus's grid reference to that specimen. It is this holotype's position only.

**Open.** Vale Bravo. Antunes and Mateus (2003), with the describer as second author, write that "The holotype of the species, a partial skeleton (ML 370), was collected at Vale Bravo" (antunes2003a, p. 81), and list "Vale Bravo, Porto das Barcas and Paimogo" as the species' localities (p. 80). They never mention Peralta for this taxon and do not say Vale Bravo is a correction. If Vale Bravo is a place name inside the Peralta area, the two papers agree. A map or gazetteer placing Vale Bravo relative to grid square MD7044 would settle this.

## References

- `mateus1998a`: Mateus, O. (1998). Lourinhanosaurus antunesi, a new Upper Jurassic allosauroid (Dinosauria: Theropoda) from Lourinhã, Portugal. *Memórias da Academia de Ciências de Lisboa* 37: 111-124.
- `carrano2012a`: Carrano, M. T.; Benson, R. B. J.; Sampson, S. D. (2012). The phylogeny of Tetanurae (Dinosauria: Theropoda). *Journal of Systematic Palaeontology* 10(2): 211-300. doi:10.1080/14772019.2011.630927
- `mocho2016a`: Mocho, P.; Royo-Torres, R.; Ortega, F. (2016). New data of the Portuguese brachiosaurid Lusotitan atalaiensis (Sobral Formation, Upper Jurassic). *Historical Biology* 29(6): 789-817. doi:10.1080/08912963.2016.1247447
- `antunes2003a`: Antunes, M. T.; Mateus, O. (2003). Dinosaurs of Portugal. *Comptes Rendus Palevol* 2(1): 77-95. doi:10.1016/s1631-0683(03)00003-4
