# *Trimucrodon*

## Can Thulborn's map reference for Porto Pinheiro be converted to a coordinate?

*2026-10-06*

**Conclusion.** Not yet. Thulborn (1973) prints "0° 13′ W., 39° 13′ N." from the Carta Militar de Portugal but does not say which meridian his longitudes are measured from, and his other two map references cannot be measured from Greenwich. Converting the reference needs that meridian's offset from a source. The record carries no coordinate meanwhile. Governs the empty `location.coordinates` on [*Trimucrodon cuneatus*](../../../genera/T/Trimucrodon.yml).

**Evidence.**
- thulborn1973a, p. 118, The Porto Pinheiro ornithischians: "Map reference: Carta Militar de Portugal, Sheet 349 (Lourinhã), 0° 13′ W., 39° 13′ N."
- thulborn1973a, p. 90: Pedrógão at "Carta Militar de Portugal, Sheet 272 (Vieira de Leiria), 0° 11' E., 39° 55' N."; p. 108: Guimarota at "Sheet 297 (Leiria), 0° 20' E., 39° 44' N."

**Ruled out.**
- *A Greenwich reading.* The earlier deletion tested the reference against Greenwich and found no match. Pedrógão and Guimarota both lie in western Portugal, so their eastern longitudes show the references are measured from a meridian other than Greenwich (our inference).
- *A conversion from a remembered offset.* The meridian the Carta Militar used, and its offset from Greenwich, are not stated in any source read.

**Open.** The meridian. A source stating the Carta Militar's prime meridian and its offset would let the reference convert, to arc-minute precision. The deleted pair, 39.216393, -9.343696, lies about 420 m from a reading of the reference against the Lisbon meridian, which suggests it was a converted copy of it (our inference).

## Is Thulborn's "Porto Pinheiro" the same site as Porto Dinheiro?

*2026-09-08*

**Conclusion.** Yes. Thulborn (1973) names the *Trimucrodon* site "Porto Pinheiro", the form the Berlin collectors used. Later work writes Porto Dinheiro and names it as the type locality of *Trimucrodon cuneatus*. Bonaparte and Mateus (1999) put "Pinheiro" in quotation marks when crediting the Berlin team's work there. The mammal *Pinheirodon* keeps the older form in its name. Governs `location.locality: Porto Dinheiro` on [*Trimucrodon cuneatus*](../../../genera/T/Trimucrodon.yml).

**Evidence.**
- thulborn1973a, p. 118, The Porto Pinheiro ornithischians: "Map reference: Carta Militar de Portugal, Sheet 349 (Lourinhã), 0° 13′ W., 39° 13′ N."
- bonaparte1999a, p. 13: the collections made by "Drs. Henkel, Kuhne, Krusat, and Krebs, from the Freie Universität, Berlin, at the Guimarota coal mine, and at Porto "Pinheiro"".
- mateus2009b, p. 253: "The exposures around Porto Dinheiro (Lourinhã Municipality) have provided the majority of the dinosaur finds ... and the locality is the stratotype for Dinheirosaurus lourinhanensis and Trimucrodon cuneatus, and the mammal Pinheirodon."

**Ruled out.**
- *Porto Pinheiro as a separate site.* Mateus and Milàn (2009) give Porto Dinheiro as the *Trimucrodon* type locality. That the Lourinhã map sheet Thulborn cites covers the same coast is an inference from the sheet name, not checked on the sheet.

**Open.** Nothing.

## References

- `thulborn1973a`: Thulborn, R. A. (1973). Teeth of ornithischian dinosaurs from the Upper Jurassic of Portugal, with description of a hypsilophodontid (Phyllodon henkeli gen. et sp. nov.) from the Guimarota lignite. *Memórias dos Serviços Geológicos de Portugal* 22: 89-134.
- `bonaparte1999a`: Bonaparte, J. F.; Mateus, O. (1999). A new diplodocid, Dinheirosaurus lourinhanensis gen. et sp. nov., from the Late Jurassic beds of Portugal. *Revista del Museo Argentino de Ciencias Naturales "Bernardino Rivadavia" e Instituto Nacional de Investigación de las Ciencias Naturales, Paleontología* 5(2): 13-29.
- `mateus2009b`: Mateus, O.; Milàn, J. (2009). A diverse Upper Jurassic dinosaur ichnofauna from central-west Portugal. *Lethaia* 43: 245-257. doi:10.1111/j.1502-3931.2009.00190.x
