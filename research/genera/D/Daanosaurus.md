# *Daanosaurus*

## Was the *Daanosaurus* holotype found in Da'an District?

*2026-08-17*

**Conclusion.** No. Ye and colleagues (2005) give the type locality as Yongan Town in Yantan District (Yantanqu) of Zigong City, and the genus name refers to the district where the Zigong Dinosaur Museum stands. Yantan is a district, not a second site name, so the locality is the town alone. Governs `location.locality: Yongan Town` and `location.region: CN-SC` on [*Daanosaurus zhangi*](../../../genera/D/Daanosaurus.yml).

**Evidence.**
- ye2005a, p. 175, Etymology: "'Da'an' refers to the administrative district in which the Zigong Dinosaur Museum is located" (translated).
- ye2005a, p. 176, Locality: "Yongan Town, Yantan District, Zigong City, Sichuan Province" (translated); also p. 175: excavated in late 2002 "from the Upper Shaximiao Formation in Yongan Town, Yantan District, Zigong City" (translated).

**Ruled out.**
- *Da'an District as the find site.* The etymology names the museum's district, and the locality line names a different one.
- *"Yongan, Yantan" as the locality.* Yantan is the district containing Yongan Town; `regions.yaml` has no code below CN-SC, so the district cannot go in `region` either.

**Open.** The site within Yongan Town. Peng and colleagues' (2005) book on the Zigong Jurassic faunas, which has not been read, may give it.

## Is *Daanosaurus* Oxfordian, or Kimmeridgian–Tithonian?

*2026-08-03*

**Conclusion.** Kimmeridgian–Tithonian. Ye and colleagues (2005) date the holotype only to the Late Jurassic, in the upper Shaximiao. The one stage-level age read for that part of the formation is the "?Kimmeridgian–?Tithonian" Sánchez-Fenollosa and Cobos (2025) give the upper-member stegosaurs. Applying it to *Daanosaurus* is our inference from the shared unit, not a statement about this horizon. Governs `period.stage: [Kimmeridgian, Tithonian]` on [*Daanosaurus zhangi*](../../../genera/D/Daanosaurus.yml).

**Evidence.**
- ye2005a, p. 176: "Age and formation: Late Jurassic; Shangshaximiao Formation" (translated).
- sánchez-fenollosa2025a, p. 181: "*G. sichuanensis* (upper Shaximiao Formation, ?Kimmeridgian–?Tithonian, China)".

**Ruled out.**
- *Oxfordian.* Jones (2026) gives "Shangshaximiao Fm., China, Late Jurassic, Oxfordian" (jones2026b, p. 376), the same stage it gives the lower-member *Dashanpusaurus* and *Datousaurus* (p. 379). The Oxfordian of the lower member rests on Wang and colleagues' (2018) youngest detrital zircon, "159 ± 2 Ma, as the maximum depositional age of the Lower Shaximiao Formation" (wang2018a, p. 1497). That is a limit on beds below this horizon, not an age for it. That Jones takes the Oxfordian from Wang and colleagues is an inference; the table cites no source for the age.

**Open.** A date from the upper Shaximiao itself, preferably near Yongan Town, would settle it.

## References

- `ye2005a`: Ye, Y.; Gao, Y. H.; Jiang, S. (2005). A new genus of sauropod from Zigong, Sichuan. *Vertebrata PalAsiatica* 43(3): 175-181.
- `sánchez-fenollosa2025a`: Sánchez-Fenollosa, S.; Cobos, A. (2025). New insights into the phylogeny and skull evolution of stegosaurian dinosaurs: an extraordinary cranium from the European Late Jurassic (Dinosauria: Stegosauria). *Vertebrate Zoology* 75: 165-189. doi:10.3897/vz.75.e146618
- `jones2026b`: Jones, B. (2026). The Princeton Encyclopedia of Dinosaurs: Sauropods. Princeton University Press.
- `wang2018a`: Wang, J.; Ye, Y.; Pei, R.; Tian, Y.; Feng, C.; Zheng, D.; Chang, S. C. (2018). Age of Jurassic basal sauropods in Sichuan, China: A reappraisal of basal sauropod evolution. *GSA Bulletin* 130(9-10): 1493-1500. doi:10.1130/b31910.1
