/**
 * Import module for the contribution wizard. Fetches structured dinosaur
 * data from PBDB, Wikipedia, and Wikidata, mapping values to the wizard's
 * controlled vocabularies. PBDB is preferred for stratigraphic, locality,
 * and ecological data; Wikipedia/Wikidata fill in descriptions, etymology,
 * and identifiers.
 */
window.DataImport = (function ()
{
    "use strict";

    const pbdbApiBase = "https://paleobiodb.org/data1.2";
    const wikidataApiBase = "https://www.wikidata.org";
    const wikipediaApiBase = "https://en.wikipedia.org/w/api.php";

    /**
     * Orchestrates PBDB, Wikipedia, and Wikidata API calls in parallel to
     * extract genus data, returning a results object keyed by wizard field
     * header. PBDB results are mapped first; Wikipedia and Wikidata fill gaps.
     *
     * @param name - The genus name to search for.
     * @returns A promise resolving to a results object with field mappings.
     */
    async function fetchGenus(name)
    {
        const results = {};
        const cleanName = name.trim();

        const [pbdbResult, wikitextData, wikidataResult] = await Promise.allSettled([
            fetchPbdb(cleanName),
            parseWikitext(cleanName),
            searchWikidata(cleanName).then(
                (qid) =>
                {
                    if (qid)
                    {
                        return fetchWikidataEntity(qid);
                    }

                    return null;
                },
            ),
        ]);

        const pbdb = pbdbResult.status === "fulfilled" ? pbdbResult.value : null;
        const wikitext = wikitextData.status === "fulfilled" ? wikitextData.value : null;
        const wikidata = wikidataResult.status === "fulfilled" ? wikidataResult.value : null;

        if (!pbdb && !wikitext && !wikidata)
        {
            return results;
        }

        if (pbdb)
        {
            mapPbdbResults(pbdb, results);
        }

        if (wikitext)
        {
            mapWikitextResults(wikitext, results);
        }

        if (wikidata)
        {
            mapWikidataResults(wikidata, results);
        }

        if (pbdb && pbdb.doi)
        {
            try
            {
                const reference = await fetchDoiReference(pbdb.doi);

                if (reference && reference.authors && reference.year && reference.title)
                {
                    const surname = (reference.authors ?? "").split(",")[0].trim().toLowerCase().replace(/\s+/g, "");

                    reference.id = `${surname}${reference.year}`;

                    results["References"] = {
                        value: [reference],
                        displayValue: `${reference.authors} (${reference.year}) \u2014 ${reference.title}`,
                        source: "PBDB",
                        fieldType: "references",
                    };
                }
            }
            catch
            {
                // DOI resolution failed — skip reference import
            }
        }

        if (results["Stage"] && !results["Period"])
        {
            const period = window.OpenPaleo.getPeriodForStage(results["Stage"].value);

            if (period)
            {
                results["Period"] = {
                    value: period,
                    source: results["Stage"].source,
                    fieldType: "select",
                };
            }
        }

        const identifierLines = collectIdentifiers(results);

        if (identifierLines.length > 0)
        {
            results["External identifiers"] = {
                value: identifierLines.join("\n"),
                source: "PBDB / Wikidata",
                fieldType: "textarea",
            };
        }

        return results;
    }

    /**
     * Fetches genus data from the PBDB taxa endpoint and the first
     * occurrence for locality data, returning a combined result object.
     *
     * @param name - The genus name to search for.
     * @returns A promise resolving to a PBDB data object, or null.
     */
    async function fetchPbdb(name)
    {
        const taxonParams = new URLSearchParams({
            name: name,
            show: "attr,app,class,ecospace",
            vocab: "pbdb",
        });

        const taxonResponse = await fetch(`${pbdbApiBase}/taxa/single.json?${taxonParams}`);

        if (!taxonResponse.ok)
        {
            return null;
        }

        const taxonData = await taxonResponse.json();
        const taxon = taxonData.records?.[0];

        if (!taxon)
        {
            return null;
        }

        const result = {
            taxonName: taxon.taxon_name ?? "",
            taxonNumber: taxon.taxon_no ?? "",
            authority: taxon.taxon_attr ?? "",
            diet: taxon.diet ?? "",
            locomotion: taxon.motility ?? "",
            earlyInterval: taxon.early_interval ?? "",
            lateInterval: taxon.late_interval ?? "",
            family: taxon.family ?? "",
            order: taxon.order ?? "",
        };

        const referenceNo = taxon.reference_no ?? "";

        const [childResult, occurrenceResult, referenceResult, holotypeResult] = await Promise.allSettled([
            fetchPbdbTypeSpecies(name),
            fetchPbdbOccurrence(name),
            referenceNo ? fetchPbdbReferenceDoi(referenceNo) : Promise.resolve(null),
            fetchPbdbHolotype(name),
        ]);

        if (childResult.status === "fulfilled" && childResult.value)
        {
            result.typeSpecies = childResult.value;
        }

        if (referenceResult.status === "fulfilled" && referenceResult.value)
        {
            result.doi = referenceResult.value;
        }

        if (occurrenceResult.status === "fulfilled" && occurrenceResult.value)
        {
            const occurrence = occurrenceResult.value;

            result.formation = occurrence.formation ?? "";
            result.country = occurrence.cc ?? "";
            result.region = occurrence.state ?? "";
            result.latitude = occurrence.lat ?? "";
            result.longitude = occurrence.lng ?? "";
        }

        if (holotypeResult.status === "fulfilled" && holotypeResult.value)
        {
            result.holotype = holotypeResult.value;
        }

        return result;
    }

    /**
     * Fetches the type species name from PBDB by looking up children taxa
     * of the genus and returning the first species-rank child.
     *
     * @param name - The genus name.
     * @returns A promise resolving to the type species name, or null.
     */
    async function fetchPbdbTypeSpecies(name)
    {
        const params = new URLSearchParams({
            name: name,
            rel: "children",
            vocab: "pbdb",
        });

        const response = await fetch(`${pbdbApiBase}/taxa/list.json?${params}`);

        if (!response.ok)
        {
            return null;
        }

        const data = await response.json();
        const species = data.records?.find(
            (record) => record.accepted_rank === "species",
        );

        return species ? species.accepted_name : null;
    }

    /**
     * Fetches the first occurrence record for a genus from PBDB, which
     * provides locality and stratigraphic data.
     *
     * @param name - The genus name.
     * @returns A promise resolving to an occurrence record object, or null.
     */
    async function fetchPbdbOccurrence(name)
    {
        const params = new URLSearchParams({
            base_name: name,
            show: "coords,loc,strat",
            vocab: "pbdb",
            limit: "1",
        });

        const response = await fetch(`${pbdbApiBase}/occs/list.json?${params}`);

        if (!response.ok)
        {
            return null;
        }

        const data = await response.json();

        return data.records?.[0] ?? null;
    }

    const museumNames = {
        "AMNH": "American Museum of Natural History",
        "ANSP": "Academy of Natural Sciences of Drexel University",
        "BHI": "Black Hills Institute of Geological Research",
        "BMNH": "Natural History Museum, London",
        "BSP": "Bayerische Staatssammlung für Paläontologie und Geologie",
        "CM": "Carnegie Museum of Natural History",
        "CMN": "Canadian Museum of Nature",
        "DMNH": "Denver Museum of Nature and Science",
        "FMNH": "Field Museum of Natural History",
        "GIN": "Geological Institute, Mongolian Academy of Sciences",
        "GSC": "Geological Survey of Canada",
        "HMN": "Museum für Naturkunde, Berlin",
        "ICZM": "Institute of Comparative Zoology Museum",
        "IVPP": "Institute of Vertebrate Paleontology and Paleoanthropology",
        "LACM": "Natural History Museum of Los Angeles County",
        "MCZ": "Museum of Comparative Zoology, Harvard",
        "MLP": "Museo de La Plata",
        "MNHN": "Muséum national d'histoire naturelle, Paris",
        "MOR": "Museum of the Rockies",
        "NHMUK": "Natural History Museum, London",
        "NMC": "Canadian Museum of Nature",
        "OMNH": "Sam Noble Oklahoma Museum of Natural History",
        "PIN": "Paleontological Institute, Russian Academy of Sciences",
        "ROM": "Royal Ontario Museum",
        "SAM": "South African Museum",
        "SMA": "Sauriermuseum Aathal",
        "SMNS": "Staatliches Museum für Naturkunde Stuttgart",
        "TMP": "Royal Tyrrell Museum of Palaeontology",
        "UCMP": "University of California Museum of Paleontology",
        "UMNH": "Utah Museum of Natural History",
        "UNSM": "University of Nebraska State Museum",
        "USNM": "Smithsonian National Museum of Natural History",
        "YPM": "Yale Peabody Museum of Natural History",
        "ZPAL": "Institute of Paleobiology, Polish Academy of Sciences",
    };

    /**
     * Fetches holotype specimen data from PBDB for a genus, returning
     * the specimen ID and institution name.
     *
     * @param name - The genus name.
     * @returns A promise resolving to { specimenId, institution }, or null.
     */
    async function fetchPbdbHolotype(name)
    {
        const params = new URLSearchParams({
            base_name: name,
            spectype: "holo",
            show: "methods",
            vocab: "pbdb",
            limit: "1",
        });

        const response = await fetch(`${pbdbApiBase}/specs/list.json?${params}`);

        if (!response.ok)
        {
            return null;
        }

        const data = await response.json();
        const record = data.records?.[0];

        if (!record)
        {
            return null;
        }

        const result = {};

        if (record.specimen_id)
        {
            result.specimenId = record.specimen_id;
        }

        if (record.museum)
        {
            const abbreviation = record.museum.split(",")[0].trim();

            result.institution = museumNames[abbreviation] ?? abbreviation;
        }

        return result.specimenId || result.institution ? result : null;
    }

    /**
     * Fetches the DOI for a PBDB reference by its reference number.
     *
     * @param referenceNo - The PBDB reference number.
     * @returns A promise resolving to the DOI string, or null.
     */
    async function fetchPbdbReferenceDoi(referenceNo)
    {
        const params = new URLSearchParams({
            id: `ref:${referenceNo}`,
            vocab: "pbdb",
        });

        const response = await fetch(`${pbdbApiBase}/refs/single.json?${params}`);

        if (!response.ok)
        {
            return null;
        }

        const data = await response.json();
        const record = data.records?.[0];

        return record?.doi ?? null;
    }

    /**
     * Fetches reference metadata from the doi.org content negotiation API.
     *
     * @param doi - The DOI string (e.g., "10.1098/rsos.161086").
     * @returns A promise resolving to a reference object, or null.
     */
    async function fetchDoiReference(doi)
    {
        const response = await fetch(
            `https://doi.org/${encodeURIComponent(doi)}`,
            {
                headers: { "Accept": "application/citeproc+json" },
                redirect: "follow",
            },
        );

        if (!response.ok)
        {
            return null;
        }

        const data = await response.json();
        const reference = {};

        if (data.author)
        {
            reference.authors = data.author
                .map((author) => [author.family, author.given].filter(Boolean).join(", "))
                .join("; ");
        }

        if (data.issued?.["date-parts"]?.[0])
        {
            reference.year = String(data.issued["date-parts"][0][0]);
        }

        if (data.title)
        {
            reference.title = Array.isArray(data.title) ? data.title[0] : data.title;
        }

        if (data["container-title"])
        {
            reference.journal = Array.isArray(data["container-title"])
                ? data["container-title"][0]
                : data["container-title"];
        }

        if (data.volume)
        {
            reference.volume = String(data.volume);
        }

        if (data.issue)
        {
            reference.issue = String(data.issue);
        }

        if (data.page && !(data.DOI && data.DOI.includes(data.page)))
        {
            reference.pages = data.page;
        }

        if (data.DOI)
        {
            reference.doi = data.DOI;
        }

        if (data.publisher)
        {
            reference.publisher = data.publisher;
        }

        return reference;
    }

    /**
     * Maps PBDB data to wizard field results. PBDB is the preferred source
     * for stratigraphic, locality, ecological, and authority data.
     *
     * @param pbdb - The parsed PBDB data object.
     * @param results - The results object to populate.
     */
    function mapPbdbResults(pbdb, results)
    {
        if (pbdb.typeSpecies)
        {
            results["Type species name"] = {
                value: pbdb.typeSpecies,
                source: "PBDB",
                fieldType: "text",
            };
        }

        if (pbdb.authority)
        {
            const parsed = parseAuthority(pbdb.authority);

            if (parsed.authors)
            {
                results["Authors"] = {
                    value: parsed.authors,
                    source: "PBDB",
                    fieldType: "text",
                };
            }

            if (parsed.year)
            {
                results["Year described"] = {
                    value: parsed.year,
                    source: "PBDB",
                    fieldType: "text",
                };
            }
        }

        if (pbdb.diet)
        {
            const diet = matchDiet(pbdb.diet);

            if (diet)
            {
                results["Diet"] = {
                    value: diet,
                    source: "PBDB",
                    fieldType: "select",
                };
            }
        }

        if (pbdb.earlyInterval)
        {
            const intervalText = pbdb.lateInterval
                ? pbdb.earlyInterval + " " + pbdb.lateInterval
                : pbdb.earlyInterval;

            const period = matchPeriod(intervalText);

            if (period)
            {
                results["Period"] = {
                    value: period,
                    source: "PBDB",
                    fieldType: "select",
                };
            }

            const stage = matchStage(intervalText);

            if (stage)
            {
                results["Stage"] = {
                    value: stage,
                    source: "PBDB",
                    fieldType: "select",
                };
            }
        }

        if (pbdb.family && pbdb.family !== "NO_FAMILY_SPECIFIED")
        {
            const clade = matchClade(pbdb.family);

            if (clade)
            {
                results["Parent clade"] = {
                    value: clade,
                    source: "PBDB",
                    fieldType: "search",
                };
            }
        }

        if (pbdb.formation)
        {
            results["Formation"] = {
                value: pbdb.formation,
                source: "PBDB",
                fieldType: "text",
            };
        }

        if (pbdb.country)
        {
            const countries = window.OpenPaleo.getSchemaValues("countries") ?? {};

            if (countries[pbdb.country])
            {
                results["Country"] = {
                    value: pbdb.country,
                    displayValue: countries[pbdb.country],
                    source: "PBDB",
                    fieldType: "search",
                };
            }
        }

        if (pbdb.region)
        {
            results["Region"] = {
                value: pbdb.region,
                source: "PBDB",
                fieldType: "text",
            };
        }

        if (pbdb.latitude && pbdb.longitude)
        {
            results["Coordinates"] = {
                value: `${pbdb.latitude}, ${pbdb.longitude}`,
                source: "PBDB",
                fieldType: "text",
            };
        }

        if (pbdb.taxonNumber)
        {
            results["_id_pbdb"] = String(pbdb.taxonNumber);
        }

        if (pbdb.holotype)
        {
            if (pbdb.holotype.specimenId)
            {
                results["Holotype specimen ID"] = {
                    value: pbdb.holotype.specimenId,
                    source: "PBDB",
                    fieldType: "text",
                };
            }

            if (pbdb.holotype.institution)
            {
                results["Holotype institution"] = {
                    value: pbdb.holotype.institution,
                    source: "PBDB",
                    fieldType: "text",
                };
            }
        }
    }

    /**
     * Maps extracted wikitext data to wizard field results. Only sets fields
     * not already populated by a higher-priority source (PBDB).
     *
     * @param wikitext - The parsed wikitext data object.
     * @param results - The results object to populate.
     */
    function mapWikitextResults(wikitext, results)
    {
        if (wikitext.typeSpecies && !results["Type species name"])
        {
            results["Type species name"] = {
                value: wikitext.typeSpecies,
                source: "Wikipedia",
                fieldType: "text",
            };
        }

        if (wikitext.temporalRange)
        {
            const period = matchPeriod(wikitext.temporalRange);

            if (period && !results["Period"])
            {
                results["Period"] = {
                    value: period,
                    source: "Wikipedia",
                    fieldType: "select",
                };
            }

            const stage = matchStage(wikitext.temporalRange);

            if (stage && !results["Stage"])
            {
                results["Stage"] = {
                    value: stage,
                    source: "Wikipedia",
                    fieldType: "select",
                };
            }
        }

        if (wikitext.authority)
        {
            const parsed = parseAuthority(wikitext.authority);

            if (parsed.authors && !results["Authors"])
            {
                results["Authors"] = {
                    value: parsed.authors,
                    source: "Wikipedia",
                    fieldType: "text",
                };
            }

            if (parsed.year && !results["Year described"])
            {
                results["Year described"] = {
                    value: parsed.year,
                    source: "Wikipedia",
                    fieldType: "text",
                };
            }
        }

        if (wikitext.formation && !results["Formation"])
        {
            results["Formation"] = {
                value: wikitext.formation,
                source: "Wikipedia",
                fieldType: "text",
            };
        }

        if (wikitext.country && !results["Country"])
        {
            const country = matchCountry(wikitext.country);

            if (country)
            {
                const countries = window.OpenPaleo.getSchemaValues("countries") ?? {};

                results["Country"] = {
                    value: country,
                    displayValue: countries[country] ?? country,
                    source: "Wikipedia",
                    fieldType: "search",
                };
            }
        }

        if (wikitext.summary && !results["Genus description"])
        {
            results["Genus description"] = {
                value: wikitext.summary,
                source: "Wikipedia",
                fieldType: "textarea",
            };
        }

        if (wikitext.etymology && !results["Genus etymology"])
        {
            results["Genus etymology"] = {
                value: wikitext.etymology,
                source: "Wikipedia",
                fieldType: "text",
            };
        }

        if (!results["Diet"] && wikitext.summary)
        {
            const diet = inferDiet(wikitext.summary);

            if (diet)
            {
                results["Diet"] = {
                    value: diet,
                    source: "Wikipedia",
                    fieldType: "select",
                };
            }
        }

        if (!results["Locomotion"] && wikitext.summary)
        {
            const locomotion = inferLocomotion(wikitext.summary);

            if (locomotion)
            {
                results["Locomotion"] = {
                    value: locomotion,
                    source: "Wikipedia",
                    fieldType: "select",
                };
            }
        }

        if (!results["Integument"] && wikitext.summary)
        {
            const integument = inferIntegument(wikitext.summary);

            if (integument)
            {
                results["Integument"] = {
                    value: integument,
                    source: "Wikipedia",
                    fieldType: "select",
                };
            }
        }

        if (wikitext.ipa && !results["Pronunciation (IPA)"])
        {
            results["Pronunciation (IPA)"] = {
                value: wikitext.ipa,
                source: "Wikipedia",
                fieldType: "text",
            };
        }

        if (wikitext.holotypeSpecimenId && !results["Holotype specimen ID"])
        {
            results["Holotype specimen ID"] = {
                value: wikitext.holotypeSpecimenId,
                source: "Wikipedia",
                fieldType: "text",
            };
        }

        if (wikitext.holotypeInstitution && !results["Holotype institution"])
        {
            results["Holotype institution"] = {
                value: wikitext.holotypeInstitution,
                source: "Wikipedia",
                fieldType: "text",
            };
        }
    }

    /**
     * Maps extracted Wikidata entity data to wizard field results. Only sets
     * fields not already populated by a higher-priority source.
     *
     * @param wikidata - The parsed Wikidata entity object.
     * @param results - The results object to populate.
     */
    function mapWikidataResults(wikidata, results)
    {
        if (wikidata.typeSpecies && !results["Type species name"])
        {
            results["Type species name"] = {
                value: wikidata.typeSpecies,
                source: "Wikidata",
                fieldType: "text",
            };
        }

        if (wikidata.diet && !results["Diet"])
        {
            const diet = matchDiet(wikidata.diet);

            if (diet)
            {
                results["Diet"] = {
                    value: diet,
                    source: "Wikidata",
                    fieldType: "select",
                };
            }
        }

        if (wikidata.mass && !results["Estimated weight (kg)"])
        {
            results["Estimated weight (kg)"] = {
                value: wikidata.mass,
                source: "Wikidata",
                fieldType: "text",
            };
        }

        if (wikidata.length && !results["Estimated length (m)"])
        {
            results["Estimated length (m)"] = {
                value: wikidata.length,
                source: "Wikidata",
                fieldType: "text",
            };
        }

        if (wikidata.hipHeight && !results["Estimated hip height (m)"])
        {
            results["Estimated hip height (m)"] = {
                value: wikidata.hipHeight,
                source: "Wikidata",
                fieldType: "text",
            };
        }

        if (wikidata.parentTaxon && !results["Parent clade"])
        {
            const clade = matchClade(wikidata.parentTaxon);

            if (clade)
            {
                results["Parent clade"] = {
                    value: clade,
                    source: "Wikidata",
                    fieldType: "search",
                };
            }
        }

        if (wikidata.qid)
        {
            results["_id_wikidata"] = wikidata.qid;
        }

        if (wikidata.gbifId)
        {
            results["_id_gbif"] = wikidata.gbifId;
        }

        if (wikidata.eolId)
        {
            results["_id_eol"] = wikidata.eolId;
        }

        if (wikidata.zoobankId)
        {
            results["_id_zoobank"] = wikidata.zoobankId;
        }
    }

    /**
     * Searches Wikidata for an entity matching the given name, returning
     * the QID of the first result.
     *
     * @param name - The search term (genus name).
     * @returns A promise resolving to a QID string, or null if not found.
     */
    async function searchWikidata(name)
    {
        const params = new URLSearchParams({
            action: "wbsearchentities",
            search: name,
            language: "en",
            type: "item",
            limit: "1",
            format: "json",
            origin: "*",
        });

        const response = await fetch(`${wikidataApiBase}/w/api.php?${params}`);

        if (!response.ok)
        {
            return null;
        }

        const data = await response.json();

        if (data.search && data.search.length > 0)
        {
            return data.search[0].id;
        }

        return null;
    }

    /**
     * Fetches a Wikidata entity by QID and extracts relevant properties
     * (parent taxon, type species, diet, mass).
     *
     * @param qid - The Wikidata entity QID (e.g., "Q140").
     * @returns A promise resolving to an object with extracted properties.
     */
    async function fetchWikidataEntity(qid)
    {
        const response = await fetch(`${wikidataApiBase}/entity/${qid}.json?origin=*`);

        if (!response.ok)
        {
            return null;
        }

        const data = await response.json();
        const entity = data.entities[qid];

        if (!entity)
        {
            return null;
        }

        const result = { qid: qid };
        const claims = entity.claims ?? {};

        result.parentTaxon = await resolveClaimLabel(claims, "P171");
        result.typeSpecies = await resolveClaimLabel(claims, "P427");
        result.diet = await resolveClaimLabel(claims, "P186");
        result.mass = extractMass(claims);
        result.length = extractLength(claims, "P2043");
        result.hipHeight = extractLength(claims, "P2048");
        result.gbifId = extractStringClaim(claims, "P846");
        result.eolId = extractStringClaim(claims, "P830");
        result.zoobankId = extractStringClaim(claims, "P1746");

        return result;
    }

    /**
     * Resolves the label for the first entity-valued claim of a property.
     *
     * @param claims - The entity claims object.
     * @param property - The Wikidata property ID (e.g., "P171").
     * @returns A promise resolving to the English label string, or null.
     */
    async function resolveClaimLabel(claims, property)
    {
        const claimList = claims[property];

        if (!claimList || claimList.length === 0)
        {
            return null;
        }

        const mainsnak = claimList[0].mainsnak;

        if (!mainsnak || mainsnak.snaktype !== "value" || mainsnak.datavalue?.type !== "wikibase-entityid")
        {
            return null;
        }

        const targetQid = mainsnak.datavalue.value.id;

        try
        {
            const response = await fetch(`${wikidataApiBase}/entity/${targetQid}.json?origin=*`);

            if (!response.ok)
            {
                return null;
            }

            const data = await response.json();
            const targetEntity = data.entities[targetQid];

            if (targetEntity && targetEntity.labels && targetEntity.labels.en)
            {
                return targetEntity.labels.en.value;
            }
        }
        catch
        {
            return null;
        }

        return null;
    }

    /**
     * Extracts mass in kilograms from a Wikidata P2067 claim.
     *
     * @param claims - The entity claims object.
     * @returns The mass as a string, or null if not found.
     */
    function extractMass(claims)
    {
        const massClaims = claims["P2067"];

        if (!massClaims || massClaims.length === 0)
        {
            return null;
        }

        const mainsnak = massClaims[0].mainsnak;

        if (!mainsnak || mainsnak.snaktype !== "value" || !mainsnak.datavalue)
        {
            return null;
        }

        const amount = mainsnak.datavalue.value?.amount;
        const unit = mainsnak.datavalue.value?.unit ?? "";

        if (!amount)
        {
            return null;
        }

        let kilograms = parseFloat(amount.replace("+", ""));

        if (unit.includes("Q11570"))
        {
            kilograms = kilograms * 1000;
        }
        else if (unit.includes("Q100995"))
        {
            kilograms = kilograms * 0.453592;
        }

        return String(Math.round(kilograms));
    }

    /**
     * Extracts a length or height in metres from a Wikidata quantity claim.
     * Handles metre (Q11573), centimetre (Q174728), and foot (Q3710) units.
     *
     * @param claims - The entity claims object.
     * @param property - The Wikidata property ID (e.g., "P2043").
     * @returns The length in metres as a string, or null if not found.
     */
    function extractLength(claims, property)
    {
        const claimList = claims[property];

        if (!claimList || claimList.length === 0)
        {
            return null;
        }

        const mainsnak = claimList[0].mainsnak;

        if (!mainsnak || mainsnak.snaktype !== "value" || !mainsnak.datavalue)
        {
            return null;
        }

        const amount = mainsnak.datavalue.value?.amount;
        const unit = mainsnak.datavalue.value?.unit ?? "";

        if (!amount)
        {
            return null;
        }

        let metres = parseFloat(amount.replace("+", ""));

        if (unit.includes("Q174728"))
        {
            metres = metres / 100;
        }
        else if (unit.includes("Q3710"))
        {
            metres = metres * 0.3048;
        }

        const rounded = Math.round(metres * 10) / 10;

        return String(rounded);
    }

    /**
     * Extracts a plain string value from a Wikidata claim property.
     *
     * @param claims - The entity claims object.
     * @param property - The Wikidata property ID (e.g., "P846").
     * @returns The string value, or null if not found.
     */
    function extractStringClaim(claims, property)
    {
        const claimList = claims[property];

        if (!claimList || claimList.length === 0)
        {
            return null;
        }

        const mainsnak = claimList[0].mainsnak;

        if (!mainsnak || mainsnak.snaktype !== "value")
        {
            return null;
        }

        return mainsnak.datavalue?.value ?? null;
    }

    /**
     * Fetches and parses the Wikipedia page for a genus, extracting the
     * taxobox, page summary, and etymology section.
     *
     * @param title - The Wikipedia page title to fetch.
     * @returns A promise resolving to an object with extracted page data.
     */
    async function parseWikitext(title)
    {
        const parseParams = new URLSearchParams({
            action: "parse",
            page: title,
            prop: "wikitext|sections|text",
            format: "json",
            origin: "*",
        });

        const extractParams = new URLSearchParams({
            action: "query",
            titles: title,
            prop: "extracts",
            exintro: "true",
            explaintext: "true",
            format: "json",
            origin: "*",
        });

        const [parseResponse, extractResponse] = await Promise.all([
            fetch(`${wikipediaApiBase}?${parseParams}`),
            fetch(`${wikipediaApiBase}?${extractParams}`),
        ]);

        if (!parseResponse.ok)
        {
            return null;
        }

        const data = await parseResponse.json();

        if (data.error)
        {
            return null;
        }

        const wikitext = data.parse?.wikitext?.["*"] ?? "";
        const result = {};

        const taxobox = extractTaxobox(wikitext);

        if (taxobox)
        {
            result.typeSpecies = cleanWikitext(taxobox["type_species"] ?? taxobox["type"] ?? "");

            if (!result.typeSpecies && taxobox["genus"] && taxobox["species"])
            {
                result.typeSpecies = cleanWikitext(taxobox["genus"]) + " " + cleanWikitext(taxobox["species"]);
            }

            result.temporalRange = cleanWikitext(
                taxobox["temporal_range"] ?? taxobox["fossil_range"] ?? taxobox["range"] ?? "",
            );
            result.authority = cleanWikitext(taxobox["authority"] ?? taxobox["parent_authority"] ?? "");
            result.formation = cleanWikitext(taxobox["formation"] ?? "");
            result.country = cleanWikitext(
                taxobox["country"] ?? taxobox["location"] ?? taxobox["fossil_site"] ?? "",
            );
        }

        if (extractResponse.ok)
        {
            const extractData = await extractResponse.json();
            const pages = extractData.query?.pages ?? {};
            const pageId = Object.keys(pages)[0];

            const extract = pages[pageId]?.extract ?? "";
            const firstParagraph = extract.split("\n")[0] ?? "";

            result.summary = firstParagraph
                .replace(/\s*\(\s*\)\s*/g, " ")
                .replace(/\s{2,}/g, " ")
                .trim();
        }

        if (!result.summary)
        {
            result.summary = extractSummary(wikitext);
        }

        result.etymology = extractEtymology(wikitext, data.parse?.sections ?? [], result.summary ?? "");

        result.ipa = extractIpa(data.parse?.text?.["*"] ?? "");

        if (!result.ipa)
        {
            result.ipa = extractWikitextIpa(wikitext);
        }

        const holotype = extractHolotype(wikitext);

        if (holotype.specimenId)
        {
            result.holotypeSpecimenId = holotype.specimenId;
        }

        if (holotype.institution)
        {
            result.holotypeInstitution = holotype.institution;
        }

        return result;
    }

    /**
     * Parses a taxobox/speciesbox template from raw wikitext, extracting
     * key-value pairs from template parameters.
     *
     * @param wikitext - The raw wikitext string.
     * @returns An object of taxobox parameters, or null if no taxobox found.
     */
    function extractTaxobox(wikitext)
    {
        const patterns = [
            /\{\{Speciesbox/i,
            /\{\{Taxobox/i,
            /\{\{Automatic[_ ]taxobox/i,
        ];

        let startIndex = -1;

        for (const pattern of patterns)
        {
            const match = wikitext.match(pattern);

            if (match)
            {
                startIndex = match.index;
                break;
            }
        }

        if (startIndex < 0)
        {
            return null;
        }

        let depth = 0;
        let endIndex = startIndex;

        for (let index = startIndex; index < wikitext.length; index++)
        {
            if (wikitext[index] === "{" && wikitext[index + 1] === "{")
            {
                depth++;
                index++;
            }
            else if (wikitext[index] === "}" && wikitext[index + 1] === "}")
            {
                depth--;
                index++;

                if (depth === 0)
                {
                    endIndex = index + 1;
                    break;
                }
            }
        }

        const boxText = wikitext.slice(startIndex, endIndex);
        const params = {};
        const paramRegex = /\|\s*([a-z_]+)\s*=\s*([^|{}]*(?:\{\{[^}]*\}\}[^|{}]*)*)/gi;
        let paramMatch;

        while ((paramMatch = paramRegex.exec(boxText)) !== null)
        {
            const key = paramMatch[1].trim().toLowerCase();
            const value = paramMatch[2].trim();

            if (value)
            {
                params[key] = value;
            }
        }

        return Object.keys(params).length > 0 ? params : null;
    }

    /**
     * Extracts the first paragraph of article body text as a summary,
     * skipping templates, tables, and other markup.
     *
     * @param wikitext - The raw wikitext string.
     * @returns The cleaned summary text, or an empty string.
     */
    function extractSummary(wikitext)
    {
        const lines = wikitext.split("\n");
        let inTemplate = 0;
        let summary = "";

        for (const line of lines)
        {
            const trimmed = line.trim();

            if (trimmed.startsWith("{{"))
            {
                inTemplate++;
            }

            if (inTemplate > 0)
            {
                if (trimmed.includes("}}"))
                {
                    inTemplate--;
                }

                continue;
            }

            if (trimmed.startsWith("|") || trimmed.startsWith("{") || trimmed.startsWith("}") ||
                trimmed.startsWith("=") || trimmed.startsWith("[[File:") ||
                trimmed.startsWith("[[Image:") || trimmed === "")
            {
                if (summary)
                {
                    break;
                }

                continue;
            }

            if (trimmed.startsWith("'") || /^[A-Z]/.test(trimmed))
            {
                summary += (summary ? " " : "") + cleanWikitext(trimmed);
            }
            else if (summary)
            {
                break;
            }
        }

        return summary;
    }

    /**
     * Extracts the etymology section content from wikitext. Falls back to
     * parsing the intro parenthetical or a "means" sentence if no dedicated
     * Etymology section exists.
     *
     * @param wikitext - The raw wikitext string.
     * @param sections - The parsed sections array from the API response.
     * @param summary - The cleaned plaintext summary for sentence-level fallback.
     * @returns The cleaned etymology text, or an empty string.
     */
    function extractEtymology(wikitext, sections, summary)
    {
        const etymologySection = sections.find(
            (section) => section.line && section.line.toLowerCase().includes("etymolog"),
        );

        if (etymologySection)
        {
            const level = etymologySection.level;
            const headerPattern = new RegExp(`={${level}}\\s*${escapeRegex(etymologySection.line)}\\s*={${level}}`);
            const headerMatch = wikitext.match(headerPattern);

            if (headerMatch)
            {
                const startPosition = headerMatch.index + headerMatch[0].length;
                const nextHeader = wikitext.slice(startPosition).match(/\n={1,4}[^=]/);
                const endPosition = nextHeader ? startPosition + nextHeader.index : wikitext.length;
                const sectionText = wikitext.slice(startPosition, endPosition).trim();
                const cleaned = cleanWikitext(sectionText).slice(0, 500);

                if (cleaned)
                {
                    return cleaned;
                }
            }
        }

        const introEtymology = extractIntroEtymology(wikitext, summary);

        if (introEtymology)
        {
            return introEtymology;
        }

        return "";
    }

    /**
     * Extracts etymology from the intro parenthetical in wikitext or from
     * a "means" sentence in the plaintext summary. Handles patterns like:
     *   (meaning "Lake Nyasa lizard")
     *   ("dawn lizard", {{IPAc-en|...}})
     *   ({{IPAc-en|...}}; meaning "thick-headed lizard", from Greek ...)
     *   The name "X" means "different lizard"
     *
     * @param wikitext - The raw wikitext string.
     * @param summary - The cleaned plaintext summary.
     * @returns The extracted etymology, or an empty string.
     */
    function extractIntroEtymology(wikitext, summary)
    {
        const firstLine = getFirstBodyLine(wikitext);

        if (firstLine)
        {
            const parenMatch = firstLine.match(/'{2,5}[^']+'{2,5}\s*\(([^)]*(?:\{\{[^}]*\}\}[^)]*)*)\)/);

            if (parenMatch)
            {
                const parenContent = parenMatch[1];

                const meaningMatch = parenContent.match(/meaning\s+[""\u201c]([^""\u201d]+)[""\u201d]/i);

                if (meaningMatch)
                {
                    return cleanWikitext(meaningMatch[1]);
                }

                const quotedMatch = parenContent.match(/^[""\u201c]([^""\u201d]+)[""\u201d]/);

                if (quotedMatch)
                {
                    return cleanWikitext(quotedMatch[1]);
                }

                const afterSemicolon = parenContent.replace(/\{\{[^}]*\}\}/g, "").replace(/<[^>]*>/g, "");
                const semiMeaningMatch = afterSemicolon.match(/;\s*meaning\s+[""\u201c]([^""\u201d]+)[""\u201d]/i);

                if (semiMeaningMatch)
                {
                    return cleanWikitext(semiMeaningMatch[1]);
                }
            }
        }

        const meansMatch = (summary ?? "").match(
            /(?:the (?:generic )?name|the genus name)[^.]*?means?\s+[""\u201c]([^""\u201d]+)[""\u201d]/i,
        );

        if (meansMatch)
        {
            return meansMatch[1];
        }

        return "";
    }

    /**
     * Finds the first body-text line of wikitext, skipping templates,
     * tables, and other non-paragraph content.
     *
     * @param wikitext - The raw wikitext string.
     * @returns The first body line, or an empty string.
     */
    function getFirstBodyLine(wikitext)
    {
        const lines = wikitext.split("\n");
        let inTemplate = 0;

        for (const line of lines)
        {
            const trimmed = line.trim();

            if (trimmed.startsWith("{{"))
            {
                inTemplate++;
            }

            if (inTemplate > 0)
            {
                if (trimmed.includes("}}"))
                {
                    inTemplate--;
                }

                continue;
            }

            if (trimmed.startsWith("|") || trimmed.startsWith("{") || trimmed.startsWith("}") ||
                trimmed.startsWith("=") || trimmed.startsWith("[[File:") ||
                trimmed.startsWith("[[Image:") || trimmed === "")
            {
                continue;
            }

            if (trimmed.startsWith("'") || /^[A-Z]/.test(trimmed))
            {
                return trimmed;
            }
        }

        return "";
    }

    /**
     * Extracts an IPA transcription from a {{IPAc-en|...}} template in
     * wikitext. Used as a fallback when HTML-based extraction fails.
     *
     * @param wikitext - The raw wikitext string.
     * @returns The IPA string with slashes, or an empty string.
     */
    function extractWikitextIpa(wikitext)
    {
        const firstLine = getFirstBodyLine(wikitext);

        if (!firstLine)
        {
            return "";
        }

        const ipacMatch = firstLine.match(/\{\{IPAc-en\|([^}]+)\}\}/i);

        if (ipacMatch)
        {
            const parts = ipacMatch[1].split("|").filter(
                (part) => !part.includes("=") && part.trim() !== "",
            );

            if (parts.length > 0)
            {
                return "/" + parts.join("") + "/";
            }
        }

        const ipaMatch = firstLine.match(/\{\{IPA-en\|([^|}]+)/i);

        if (ipaMatch)
        {
            return ipaMatch[1].trim();
        }

        return "";
    }

    /**
     * Extracts holotype specimen ID and institution from the full wikitext
     * body. Searches for the word "holotype" and extracts a nearby specimen
     * code matching common museum catalogue patterns.
     *
     * @param wikitext - The full raw wikitext string.
     * @returns An object with specimenId and institution, both optional.
     */
    function extractHolotype(wikitext)
    {
        const cleaned = wikitext
            .replace(/<ref[^>]*\/>/gi, "")
            .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "")
            .replace(/\{\{[^}]*\}\}/g, "")
            .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, "$1");

        const specimenPattern = /\b([A-Z]{2,}(?:[-\s][A-Z]{1,4})*[-\s]?[A-Z]?\d[\w.-]*)\b/g;

        const holotypeRegion = cleaned.match(/holotype[^.]{0,200}/i);
        const reverseRegion = cleaned.match(/.{0,200}holotype/i);

        for (const region of [holotypeRegion?.[0], reverseRegion?.[0]])
        {
            if (!region)
            {
                continue;
            }

            let specimenMatch;

            while ((specimenMatch = specimenPattern.exec(region)) !== null)
            {
                const candidate = specimenMatch[1].trim();

                if (candidate.length < 4)
                {
                    continue;
                }

                if (/^\d/.test(candidate))
                {
                    continue;
                }

                if (/^[A-Z][a-z]/.test(candidate))
                {
                    continue;
                }

                return {
                    specimenId: candidate,
                    institution: resolveMuseumAbbreviation(candidate),
                };
            }

            specimenPattern.lastIndex = 0;
        }

        return {};
    }

    /**
     * Attempts to resolve a museum institution name from a specimen ID
     * prefix.
     *
     * @param specimenId - The specimen catalogue number.
     * @returns The full institution name, or undefined if not recognized.
     */
    function resolveMuseumAbbreviation(specimenId)
    {
        const prefix = specimenId.match(/^([A-Z]{2,}(?:[-\s][A-Z]{1,4})?)/);

        if (!prefix)
        {
            return undefined;
        }

        const abbreviation = prefix[1].replace(/[-\s]+/g, "").toUpperCase();

        if (museumNames[abbreviation])
        {
            return museumNames[abbreviation];
        }

        const withHyphen = prefix[1].split(/[-\s]+/)[0];

        return museumNames[withHyphen] ?? undefined;
    }

    /**
     * Extracts an IPA pronunciation transcription from rendered Wikipedia HTML.
     * Looks for the IPA span element and extracts the text content, which
     * is the correctly rendered IPA string.
     *
     * @param html - The rendered HTML string from the Wikipedia parse API.
     * @returns The IPA string, or an empty string if not found.
     */
    function extractIpa(html)
    {
        const ipaSpanMatch = html.match(
            /class="IPA[^"]*"[^>]*lang="en-fonipa"[^>]*>([^]*?)<\/a>/i,
        );

        if (!ipaSpanMatch)
        {
            return "";
        }

        const ipaHtml = ipaSpanMatch[1];
        const textOnly = ipaHtml
            .replace(/<[^>]+>/g, "")
            .replace(/&[^;]+;/g, "")
            .trim();

        return textOnly;
    }

    /**
     * Escapes special regex characters in a string.
     *
     * @param text - The string to escape.
     * @returns The escaped string safe for use in a RegExp.
     */
    function escapeRegex(text)
    {
        return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    /**
     * Removes wiki markup (links, refs, templates, HTML tags) from text,
     * leaving plain readable content.
     *
     * @param text - The wikitext string to clean.
     * @returns The cleaned plain text.
     */
    function cleanWikitext(text)
    {
        return text
            .replace(/<ref[^>]*\/>/gi, "")
            .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "")
            .replace(/\{\{[^}]*\}\}/g, "")
            .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, "$1")
            .replace(/<[^>]+>/g, "")
            .replace(/'{2,3}/g, "")
            .replace(/\s+/g, " ")
            .trim();
    }

    /**
     * Parses an authority string (e.g., "Osborn 1905") into authors and year.
     *
     * @param authority - The authority string from the taxobox or PBDB.
     * @returns An object with authors and year properties.
     */
    function parseAuthority(authority)
    {
        const result = { authors: "", year: "" };

        if (!authority)
        {
            return result;
        }

        const yearMatch = authority.match(/\b(1[89]\d{2}|20[0-2]\d)\b/);

        if (yearMatch)
        {
            result.year = yearMatch[1];

            const authorPart = authority.slice(0, yearMatch.index).replace(/[,\s]+$/, "").trim();

            if (authorPart)
            {
                result.authors = authorPart;
            }
        }
        else
        {
            result.authors = authority;
        }

        return result;
    }

    /**
     * Infers a diet value from article summary text by looking for keywords
     * like "herbivorous", "carnivore", "predator", etc.
     *
     * @param text - The summary or description text to scan.
     * @returns A matching schema diet value, or null if no diet is inferred.
     */
    function inferDiet(text)
    {
        const lowerText = text.toLowerCase();

        const patterns = [
            { keywords: ["herbivorous", "herbivore", "plant-eating", "plant eating"], diet: "herbivore" },
            { keywords: ["carnivorous", "carnivore", "predator", "predatory", "meat-eating", "meat eating"], diet: "carnivore" },
            { keywords: ["omnivorous", "omnivore"], diet: "omnivore" },
            { keywords: ["piscivorous", "piscivore", "fish-eating", "fish eating"], diet: "piscivore" },
            { keywords: ["insectivorous", "insectivore", "insect-eating", "insect eating"], diet: "insectivore" },
        ];

        for (const pattern of patterns)
        {
            for (const keyword of pattern.keywords)
            {
                if (lowerText.includes(keyword))
                {
                    return pattern.diet;
                }
            }
        }

        return null;
    }

    /**
     * Infers a locomotion value from article summary text by looking for
     * keywords like "bipedal", "quadrupedal", "facultatively bipedal", etc.
     *
     * @param text - The summary or description text to scan.
     * @returns A matching schema locomotion value, or null.
     */
    function inferLocomotion(text)
    {
        const lowerText = text.toLowerCase();

        if (lowerText.includes("facultative") || lowerText.includes("facultatively"))
        {
            return "facultative";
        }
        else if (lowerText.includes("bipedal") || lowerText.includes("two-legged"))
        {
            return "bipedal";
        }
        else if (lowerText.includes("quadrupedal") || lowerText.includes("four-legged"))
        {
            return "quadrupedal";
        }

        return null;
    }

    /**
     * Infers an integument type from article summary text by looking for
     * keywords like "feathered", "scaled", "armored", etc.
     *
     * @param text - The summary or description text to scan.
     * @returns A matching schema integument value, or null.
     */
    function inferIntegument(text)
    {
        const lowerText = text.toLowerCase();

        const patterns = [
            { keywords: ["feathered", "feathers", "plumage", "pennaceous", "downy"], integument: "feathered" },
            { keywords: ["armored", "armoured", "osteoderms", "scutes", "bony plates", "body armor", "body armour"], integument: "armored" },
            { keywords: ["scaled", "scales"], integument: "scaled" },
        ];

        for (const pattern of patterns)
        {
            for (const keyword of pattern.keywords)
            {
                if (lowerText.includes(keyword))
                {
                    return pattern.integument;
                }
            }
        }

        return null;
    }

    /**
     * Collects external identifiers from internal result keys (prefixed
     * with "_id_") and returns them as "source: id" lines. Deletes the
     * internal keys from the results object.
     *
     * @param results - The results object with _id_ prefixed keys.
     * @returns An array of "source: id" strings.
     */
    function collectIdentifiers(results)
    {
        const sourceOrder = ["wikidata", "pbdb", "gbif", "eol", "zoobank"];
        const lines = [];

        for (const source of sourceOrder)
        {
            const key = `_id_${source}`;

            if (results[key])
            {
                lines.push(`${source}: ${results[key]}`);
                delete results[key];
            }
        }

        return lines;
    }

    /**
     * Matches a temporal range string to a known geological period from the schema.
     *
     * @param range - The temporal range text (e.g., "Late Cretaceous").
     * @returns The matching schema period, or null.
     */
    function matchPeriod(range)
    {
        const periods = window.OpenPaleo.getSchemaValues("periods");
        const lowerRange = range.toLowerCase();

        for (const period of periods)
        {
            if (lowerRange.includes(period.toLowerCase()))
            {
                return period;
            }
        }

        return null;
    }

    /**
     * Matches a temporal range string to a known geological stage from the schema.
     *
     * @param range - The temporal range text (e.g., "Maastrichtian").
     * @returns The matching schema stage name, or null.
     */
    function matchStage(range)
    {
        const stagesObject = window.OpenPaleo.getSchemaValues("stages");

        if (!stagesObject || typeof stagesObject !== "object")
        {
            return null;
        }

        const stageNames = Object.keys(stagesObject);
        const lowerRange = range.toLowerCase();

        for (const stage of stageNames)
        {
            if (lowerRange.includes(stage.toLowerCase()))
            {
                return stage;
            }
        }

        return null;
    }

    /**
     * Matches a diet label to a controlled vocabulary value. Handles both
     * PBDB values (e.g., "carnivore") and Wikidata labels (e.g., "carnivory").
     *
     * @param diet - The diet label string.
     * @returns The matching schema diet value, or null.
     */
    function matchDiet(diet)
    {
        const lowerDiet = diet.toLowerCase();
        const dietValues = window.OpenPaleo.getSchemaValues("diet");

        for (const value of dietValues)
        {
            if (lowerDiet.includes(value.toLowerCase()))
            {
                return value;
            }
        }

        const mapping = {
            carnivory: "carnivore",
            herbivory: "herbivore",
            omnivory: "omnivore",
            insectivory: "insectivore",
            piscivory: "piscivore",
        };

        return mapping[lowerDiet] ?? null;
    }

    /**
     * Matches a country name to a known country in the schema and returns
     * its ISO 3166-1 alpha-2 code.
     *
     * @param country - The country text to match.
     * @returns The matching ISO country code, or null.
     */
    function matchCountry(country)
    {
        const countries = window.OpenPaleo.getSchemaValues("countries") ?? {};
        const lowerCountry = country.toLowerCase();

        for (const [code, name] of Object.entries(countries))
        {
            if (lowerCountry.includes(name.toLowerCase()))
            {
                return code;
            }
        }

        return null;
    }

    /**
     * Matches a parent taxon label to a known clade in the schema.
     *
     * @param taxon - The taxon label to match.
     * @returns The matching clade name, or null.
     */
    function matchClade(taxon)
    {
        const clades = window.OpenPaleo.getClades();

        for (const clade of clades)
        {
            if (clade.toLowerCase() === taxon.toLowerCase())
            {
                return clade;
            }
        }

        return null;
    }

    /**
     * Fetches species-rank taxon data from PBDB, returning authority,
     * stratigraphic, locality, and holotype data.
     *
     * @param name - The full species name (e.g., "Tyrannosaurus rex").
     * @returns A promise resolving to a PBDB data object, or null.
     */
    async function fetchPbdbSpecies(name)
    {
        const taxonParams = new URLSearchParams({
            name: name,
            show: "attr,app,class",
            vocab: "pbdb",
        });

        const taxonResponse = await fetch(`${pbdbApiBase}/taxa/single.json?${taxonParams}`);

        if (!taxonResponse.ok)
        {
            return null;
        }

        const taxonData = await taxonResponse.json();
        const taxon = taxonData.records?.[0];

        if (!taxon)
        {
            return null;
        }

        const result = {
            taxonName: taxon.taxon_name ?? "",
            taxonNumber: taxon.taxon_no ?? "",
            authority: taxon.taxon_attr ?? "",
            earlyInterval: taxon.early_interval ?? "",
            lateInterval: taxon.late_interval ?? "",
        };

        const referenceNo = taxon.reference_no ?? "";

        const [occurrenceResult, referenceResult, holotypeResult] = await Promise.allSettled([
            fetchPbdbOccurrence(name),
            referenceNo ? fetchPbdbReferenceDoi(referenceNo) : Promise.resolve(null),
            fetchPbdbHolotype(name),
        ]);

        if (referenceResult.status === "fulfilled" && referenceResult.value)
        {
            result.doi = referenceResult.value;
        }

        if (occurrenceResult.status === "fulfilled" && occurrenceResult.value)
        {
            const occurrence = occurrenceResult.value;

            result.formation = occurrence.formation ?? "";
            result.country = occurrence.cc ?? "";
            result.region = occurrence.state ?? "";
            result.latitude = occurrence.lat ?? "";
            result.longitude = occurrence.lng ?? "";
        }

        if (holotypeResult.status === "fulfilled" && holotypeResult.value)
        {
            result.holotype = holotypeResult.value;
        }

        return result;
    }

    /**
     * Maps PBDB species data to wizard field results.
     *
     * @param pbdb - The parsed PBDB species data object.
     * @param results - The results object to populate.
     */
    function mapPbdbSpeciesResults(pbdb, results)
    {
        if (pbdb.authority)
        {
            const parsed = parseAuthority(pbdb.authority);

            if (parsed.authors)
            {
                results["Authors"] = {
                    value: parsed.authors,
                    source: "PBDB",
                    fieldType: "text",
                };
            }

            if (parsed.year)
            {
                results["Year described"] = {
                    value: parsed.year,
                    source: "PBDB",
                    fieldType: "text",
                };
            }
        }

        if (pbdb.earlyInterval)
        {
            const intervalText = pbdb.lateInterval
                ? pbdb.earlyInterval + " " + pbdb.lateInterval
                : pbdb.earlyInterval;

            const period = matchPeriod(intervalText);

            if (period)
            {
                results["Period"] = {
                    value: period,
                    source: "PBDB",
                    fieldType: "select",
                };
            }

            const stage = matchStage(intervalText);

            if (stage)
            {
                results["Stage"] = {
                    value: stage,
                    source: "PBDB",
                    fieldType: "select",
                };
            }
        }

        if (pbdb.formation)
        {
            results["Formation"] = {
                value: pbdb.formation,
                source: "PBDB",
                fieldType: "text",
            };
        }

        if (pbdb.country)
        {
            const countries = window.OpenPaleo.getSchemaValues("countries") ?? {};

            if (countries[pbdb.country])
            {
                results["Country"] = {
                    value: pbdb.country,
                    displayValue: countries[pbdb.country],
                    source: "PBDB",
                    fieldType: "search",
                };
            }
        }

        if (pbdb.region)
        {
            results["Region"] = {
                value: pbdb.region,
                source: "PBDB",
                fieldType: "text",
            };
        }

        if (pbdb.latitude && pbdb.longitude)
        {
            results["Coordinates"] = {
                value: `${pbdb.latitude}, ${pbdb.longitude}`,
                source: "PBDB",
                fieldType: "text",
            };
        }

        if (pbdb.holotype)
        {
            if (pbdb.holotype.specimenId)
            {
                results["Holotype specimen ID"] = {
                    value: pbdb.holotype.specimenId,
                    source: "PBDB",
                    fieldType: "text",
                };
            }

            if (pbdb.holotype.institution)
            {
                results["Holotype institution"] = {
                    value: pbdb.holotype.institution,
                    source: "PBDB",
                    fieldType: "text",
                };
            }
        }
    }

    /**
     * Maps Wikipedia wikitext data to species wizard field results.
     * Only sets fields not already populated by a higher-priority source.
     *
     * @param wikitext - The parsed wikitext data object.
     * @param results - The results object to populate.
     */
    function mapWikitextSpeciesResults(wikitext, results)
    {
        if (wikitext.temporalRange)
        {
            const period = matchPeriod(wikitext.temporalRange);

            if (period && !results["Period"])
            {
                results["Period"] = {
                    value: period,
                    source: "Wikipedia",
                    fieldType: "select",
                };
            }

            const stage = matchStage(wikitext.temporalRange);

            if (stage && !results["Stage"])
            {
                results["Stage"] = {
                    value: stage,
                    source: "Wikipedia",
                    fieldType: "select",
                };
            }
        }

        if (wikitext.authority)
        {
            const parsed = parseAuthority(wikitext.authority);

            if (parsed.authors && !results["Authors"])
            {
                results["Authors"] = {
                    value: parsed.authors,
                    source: "Wikipedia",
                    fieldType: "text",
                };
            }

            if (parsed.year && !results["Year described"])
            {
                results["Year described"] = {
                    value: parsed.year,
                    source: "Wikipedia",
                    fieldType: "text",
                };
            }
        }

        if (wikitext.formation && !results["Formation"])
        {
            results["Formation"] = {
                value: wikitext.formation,
                source: "Wikipedia",
                fieldType: "text",
            };
        }

        if (wikitext.country && !results["Country"])
        {
            const country = matchCountry(wikitext.country);

            if (country)
            {
                const countries = window.OpenPaleo.getSchemaValues("countries") ?? {};

                results["Country"] = {
                    value: country,
                    displayValue: countries[country] ?? country,
                    source: "Wikipedia",
                    fieldType: "search",
                };
            }
        }

        if (wikitext.summary && !results["Species description"])
        {
            results["Species description"] = {
                value: wikitext.summary,
                source: "Wikipedia",
                fieldType: "textarea",
            };
        }
    }

    /**
     * Maps Wikidata entity data to species wizard field results.
     * Only sets fields not already populated by a higher-priority source.
     *
     * @param wikidata - The parsed Wikidata entity object.
     * @param results - The results object to populate.
     */
    function mapWikidataSpeciesResults(wikidata, results)
    {
        if (wikidata.mass && !results["Estimated weight (kg)"])
        {
            results["Estimated weight (kg)"] = {
                value: wikidata.mass,
                source: "Wikidata",
                fieldType: "text",
            };
        }

        if (wikidata.length && !results["Estimated length (m)"])
        {
            results["Estimated length (m)"] = {
                value: wikidata.length,
                source: "Wikidata",
                fieldType: "text",
            };
        }

        if (wikidata.hipHeight && !results["Estimated hip height (m)"])
        {
            results["Estimated hip height (m)"] = {
                value: wikidata.hipHeight,
                source: "Wikidata",
                fieldType: "text",
            };
        }
    }

    /**
     * Orchestrates PBDB, Wikipedia, and Wikidata API calls in parallel to
     * extract species data, returning a results object keyed by wizard field
     * header. PBDB results are mapped first; Wikipedia and Wikidata fill gaps.
     *
     * @param name - The species name to search for (e.g., "Tyrannosaurus rex").
     * @returns A promise resolving to a results object with field mappings.
     */
    async function fetchSpecies(name)
    {
        const results = {};
        const cleanName = name.trim();

        const [pbdbResult, wikitextData, wikidataResult] = await Promise.allSettled([
            fetchPbdbSpecies(cleanName),
            parseWikitext(cleanName),
            searchWikidata(cleanName).then(
                (qid) =>
                {
                    if (qid)
                    {
                        return fetchWikidataEntity(qid);
                    }

                    return null;
                },
            ),
        ]);

        const pbdb = pbdbResult.status === "fulfilled" ? pbdbResult.value : null;
        const wikitext = wikitextData.status === "fulfilled" ? wikitextData.value : null;
        const wikidata = wikidataResult.status === "fulfilled" ? wikidataResult.value : null;

        if (!pbdb && !wikitext && !wikidata)
        {
            return results;
        }

        if (pbdb)
        {
            mapPbdbSpeciesResults(pbdb, results);
        }

        if (wikitext)
        {
            mapWikitextSpeciesResults(wikitext, results);
        }

        if (wikidata)
        {
            mapWikidataSpeciesResults(wikidata, results);
        }

        if (pbdb && pbdb.doi)
        {
            try
            {
                const reference = await fetchDoiReference(pbdb.doi);

                if (reference && reference.authors && reference.year && reference.title)
                {
                    const surname = (reference.authors ?? "").split(",")[0].trim().toLowerCase().replace(/\s+/g, "");

                    reference.id = `${surname}${reference.year}`;

                    results["References"] = {
                        value: [reference],
                        displayValue: `${reference.authors} (${reference.year}) \u2014 ${reference.title}`,
                        source: "PBDB",
                        fieldType: "references",
                    };
                }
            }
            catch
            {
                // DOI resolution failed — skip reference import
            }
        }

        if (results["Stage"] && !results["Period"])
        {
            const period = window.OpenPaleo.getPeriodForStage(results["Stage"].value);

            if (period)
            {
                results["Period"] = {
                    value: period,
                    source: results["Stage"].source,
                    fieldType: "select",
                };
            }
        }

        return results;
    }

    /**
     * Fetches higher-taxon data from PBDB, returning authority and
     * classification data for a clade.
     *
     * @param name - The clade name to search for.
     * @returns A promise resolving to a PBDB data object, or null.
     */
    async function fetchPbdbClade(name)
    {
        const taxonParams = new URLSearchParams({
            name: name,
            show: "attr,app,class",
            vocab: "pbdb",
        });

        const taxonResponse = await fetch(`${pbdbApiBase}/taxa/single.json?${taxonParams}`);

        if (!taxonResponse.ok)
        {
            return null;
        }

        const taxonData = await taxonResponse.json();
        const taxon = taxonData.records?.[0];

        if (!taxon)
        {
            return null;
        }

        const result = {
            taxonName: taxon.taxon_name ?? "",
            taxonNumber: taxon.taxon_no ?? "",
            authority: taxon.taxon_attr ?? "",
            family: taxon.family ?? "",
            order: taxon.order ?? "",
        };

        const referenceNo = taxon.reference_no ?? "";

        if (referenceNo)
        {
            try
            {
                result.doi = await fetchPbdbReferenceDoi(referenceNo);
            }
            catch
            {
                // Reference DOI fetch failed — skip
            }
        }

        return result;
    }

    /**
     * Maps PBDB clade data to wizard field results.
     *
     * @param pbdb - The parsed PBDB clade data object.
     * @param results - The results object to populate.
     */
    function mapPbdbCladeResults(pbdb, results)
    {
        if (pbdb.authority)
        {
            const parsed = parseAuthority(pbdb.authority);

            if (parsed.authors)
            {
                results["Authors"] = {
                    value: parsed.authors,
                    source: "PBDB",
                    fieldType: "text",
                };
            }

            if (parsed.year)
            {
                results["Year described"] = {
                    value: parsed.year,
                    source: "PBDB",
                    fieldType: "text",
                };
            }
        }

        if (pbdb.order && pbdb.order !== "NO_ORDER_SPECIFIED")
        {
            const clade = matchClade(pbdb.order);

            if (clade)
            {
                results["Parent clade"] = {
                    value: clade,
                    source: "PBDB",
                    fieldType: "search",
                };
            }
        }

        if (!results["Parent clade"] && pbdb.family && pbdb.family !== "NO_FAMILY_SPECIFIED")
        {
            const clade = matchClade(pbdb.family);

            if (clade)
            {
                results["Parent clade"] = {
                    value: clade,
                    source: "PBDB",
                    fieldType: "search",
                };
            }
        }
    }

    /**
     * Maps Wikipedia wikitext data to clade wizard field results.
     * Only sets fields not already populated by a higher-priority source.
     *
     * @param wikitext - The parsed wikitext data object.
     * @param results - The results object to populate.
     */
    function mapWikitextCladeResults(wikitext, results)
    {
        if (wikitext.authority)
        {
            const parsed = parseAuthority(wikitext.authority);

            if (parsed.authors && !results["Authors"])
            {
                results["Authors"] = {
                    value: parsed.authors,
                    source: "Wikipedia",
                    fieldType: "text",
                };
            }

            if (parsed.year && !results["Year described"])
            {
                results["Year described"] = {
                    value: parsed.year,
                    source: "Wikipedia",
                    fieldType: "text",
                };
            }
        }

        if (wikitext.summary && !results["Description"])
        {
            results["Description"] = {
                value: wikitext.summary,
                source: "Wikipedia",
                fieldType: "textarea",
            };
        }
    }

    /**
     * Maps Wikidata entity data to clade wizard field results.
     * Only sets fields not already populated by a higher-priority source.
     *
     * @param wikidata - The parsed Wikidata entity object.
     * @param results - The results object to populate.
     */
    function mapWikidataCladeResults(wikidata, results)
    {
        if (wikidata.parentTaxon && !results["Parent clade"])
        {
            const clade = matchClade(wikidata.parentTaxon);

            if (clade)
            {
                results["Parent clade"] = {
                    value: clade,
                    source: "Wikidata",
                    fieldType: "search",
                };
            }
        }
    }

    /**
     * Orchestrates PBDB, Wikipedia, and Wikidata API calls in parallel to
     * extract clade data, returning a results object keyed by wizard field
     * header. PBDB results are mapped first; Wikipedia and Wikidata fill gaps.
     *
     * @param name - The clade name to search for (e.g., "Megaraptoridae").
     * @returns A promise resolving to a results object with field mappings.
     */
    async function fetchClade(name)
    {
        const results = {};
        const cleanName = name.trim();

        const [pbdbResult, wikitextData, wikidataResult] = await Promise.allSettled([
            fetchPbdbClade(cleanName),
            parseWikitext(cleanName),
            searchWikidata(cleanName).then(
                (qid) =>
                {
                    if (qid)
                    {
                        return fetchWikidataEntity(qid);
                    }

                    return null;
                },
            ),
        ]);

        const pbdb = pbdbResult.status === "fulfilled" ? pbdbResult.value : null;
        const wikitext = wikitextData.status === "fulfilled" ? wikitextData.value : null;
        const wikidata = wikidataResult.status === "fulfilled" ? wikidataResult.value : null;

        if (!pbdb && !wikitext && !wikidata)
        {
            return results;
        }

        if (pbdb)
        {
            mapPbdbCladeResults(pbdb, results);
        }

        if (wikitext)
        {
            mapWikitextCladeResults(wikitext, results);
        }

        if (wikidata)
        {
            mapWikidataCladeResults(wikidata, results);
        }

        if (pbdb && pbdb.doi)
        {
            try
            {
                const reference = await fetchDoiReference(pbdb.doi);

                if (reference && reference.authors && reference.year && reference.title)
                {
                    const surname = (reference.authors ?? "").split(",")[0].trim().toLowerCase().replace(/\s+/g, "");

                    reference.id = `${surname}${reference.year}`;

                    results["References"] = {
                        value: [reference],
                        displayValue: `${reference.authors} (${reference.year}) \u2014 ${reference.title}`,
                        source: "PBDB",
                        fieldType: "references",
                    };
                }
            }
            catch
            {
                // DOI resolution failed — skip reference import
            }
        }

        return results;
    }

    return { fetchGenus: fetchGenus, fetchSpecies: fetchSpecies, fetchClade: fetchClade };
})();
