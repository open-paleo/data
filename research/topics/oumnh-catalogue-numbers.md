# OUMNH catalogue numbers

## How should Oxford University Museum of Natural History specimen numbers be written?

*2026-10-07*

**Conclusion.** As `OUMNH PAL-J.` followed by the six-digit, zero-padded number the museum's own catalog gives, as in `OUMNH PAL-J.013505`. Part suffixes such as `/A14` are left off when a record cites the whole specimen. Supersedes the open question on the catalog form in the 2026-10-07 entry of [*Megalosaurus*](../genera/M/Megalosaurus.md). Governs `specimen_id` on [*Cetiosaurus*](../../genera/C/Cetiosaurus.yml), [*Cumnoria*](../../genera/C/Cumnoria.yml), [*Eustreptospondylus*](../../genera/E/Eustreptospondylus.yml), [*Juratyrant*](../../genera/J/Juratyrant.yml), [*Magnosaurus*](../../genera/M/Magnosaurus.yml), [*Megalosaurus*](../../genera/M/Megalosaurus.yml) and [*Metriacanthosaurus*](../../genera/M/Metriacanthosaurus.yml).

**Evidence.**
- The museum's Collections Online catalog (oumnh.ox.ac.uk/collections-online, read 2026-10-07) gives every specimen in this form. The *Megalosaurus* lectotype is "PAL-J.013505. Lectotype. Megalosaurus. bucklandii.", with the subtitle "Palaeontology. PAL-J.013505". The other records read are PAL-J.013605 (*Cetiosaurus oxoniensis*, syntype), PAL-J.003303 (*Cumnoria prestwichii*), PAL-J.013558 (*Eustreptospondylus oxoniensis*), PAL-J.003311 (*Juratyrant langhami*), PAL-J.012143 (*Magnosaurus nethercombensis*) and PAL-J.012144 with part suffixes (*Metriacanthosaurus parkeri*). Each matches the number and taxon a record already carried, so only the format changed.
- The museum's own published 3D models carry the same form, for example "Plesiosaur jaw (OUMNH PAL-J.028586)" and "Bony fish (OUMNH PAL-J.003001)".
- nicholls2025a, written at the museum, prints "OUMNH PAL-J.13505" and pads some numbers to five digits ("OUMNH PAL-J.03303/A04").
- `institutions.yaml` gives the collection prefix as `OUMNH`.

**Ruled out.**
- *The forms the literature prints.* Papers write "OUMNH J.13505" (benson2008c, Systematic palaeontology), "OUM J13505", "OUMNH J13505" and other variants, none with the `PAL-` department prefix or six-digit padding. As with Royal Tyrrell numbers, whose papers print "TMP 2001.26.1" for the stored "TMP 2001.026.0001", the paper's punctuation does not set the stored form when the museum publishes its own.
- *Dropping `PAL-`.* It is part of the catalog number, as `PV` is for the Natural History Museum (see [NHMUK catalogue prefixes](nhmuk-catalogue-prefixes.md)).

**Open.** Nothing.

## References

- `nicholls2025a`: Nicholls, E. L.; Newell, S. M.; Howlett, E. A. (2025). History of the Megalosaurus type material on public display. *Earth Sciences History* 44(1): 267–292. doi:10.17704/1944-6187-44.1.267
- `benson2008c`: Benson, R. B. J.; Barrett, P. M.; Powell, H. P.; Norman, D. B. (2008). The taxonomic status of Megalosaurus bucklandii (Dinosauria, Theropoda) from the Middle Jurassic of Oxfordshire, UK. *Palaeontology* 51(2): 419–424. doi:10.1111/j.1475-4983.2008.00751.x
