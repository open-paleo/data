/**
 * Import module for the contribution wizard. Fetches structured dinosaur
 * data from PBDB, Wikipedia, and Wikidata, mapping values to the wizard's
 * controlled vocabularies. PBDB is preferred for stratigraphic, locality,
 * and ecological data; Wikipedia/Wikidata fill in descriptions, etymology,
 * and identifiers.
 */
window.Wikipedia = (function ()
{
    "use strict";

    const pbdbApiBase = "https://paleobiodb.org/data1.2";
    const wikidataApiBase = "https://www.wikidata.org";
    const wikipediaApiBase = "https://en.wikipedia.org/w/api.php";

    /**
     * ISO 3166-1 alpha-2 country codes mapped to full country names used
     * in the schema. Only countries present in the schema are included.
     */
    const countryCodes = {
        AR: "Argentina", AU: "Australia", BE: "Belgium", BR: "Brazil",
        CA: "Canada", CN: "China", EG: "Egypt", FR: "France",
        DE: "Germany", IN: "India", JP: "Japan", MG: "Madagascar",
        MA: "Morocco", MN: "Mongolia", NZ: "New Zealand", NE: "Niger",
        PL: "Poland", PT: "Portugal", RO: "Romania", RU: "Russia",
        ZA: "South Africa", KR: "South Korea", ES: "Spain",
        TZ: "Tanzania", TH: "Thailand", GB: "United Kingdom",
        US: "United States", UY: "Uruguay", UZ: "Uzbekistan",
        ZW: "Zimbabwe",
    };

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
            authority: taxon.taxon_attr ?? "",
            diet: taxon.diet ?? "",
            locomotion: taxon.motility ?? "",
            earlyInterval: taxon.early_interval ?? "",
            lateInterval: taxon.late_interval ?? "",
            family: taxon.family ?? "",
            order: taxon.order ?? "",
        };

        const [childResult, occurrenceResult] = await Promise.allSettled([
            fetchPbdbTypeSpecies(name),
            fetchPbdbOccurrence(name),
        ]);

        if (childResult.status === "fulfilled" && childResult.value)
        {
            result.typeSpecies = childResult.value;
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
            const country = countryCodes[pbdb.country];
            const matched = country ? matchCountry(country) : null;

            if (matched)
            {
                results["Country"] = {
                    value: matched,
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
                results["Country"] = {
                    value: country,
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

        if (wikitext.ipa && !results["Pronunciation (IPA)"])
        {
            results["Pronunciation (IPA)"] = {
                value: wikitext.ipa,
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
            results["External identifiers"] = {
                value: `wikidata: ${wikidata.qid}`,
                source: "Wikidata",
                fieldType: "textarea",
            };
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
     * Fetches and parses the Wikipedia page for a genus, extracting the
     * taxobox, page summary, and etymology section.
     *
     * @param title - The Wikipedia page title to fetch.
     * @returns A promise resolving to an object with extracted page data.
     */
    async function parseWikitext(title)
    {
        const params = new URLSearchParams({
            action: "parse",
            page: title,
            prop: "wikitext|sections|text",
            format: "json",
            origin: "*",
        });

        const response = await fetch(`${wikipediaApiBase}?${params}`);

        if (!response.ok)
        {
            return null;
        }

        const data = await response.json();

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

        result.summary = extractSummary(wikitext);
        result.etymology = extractEtymology(wikitext, data.parse?.sections ?? []);
        result.ipa = extractIpa(data.parse?.text?.["*"] ?? "");

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
     * Extracts the etymology section content from wikitext if present.
     *
     * @param wikitext - The raw wikitext string.
     * @param sections - The parsed sections array from the API response.
     * @returns The cleaned etymology text, or an empty string.
     */
    function extractEtymology(wikitext, sections)
    {
        const etymologySection = sections.find(
            (section) => section.line && section.line.toLowerCase().includes("etymolog"),
        );

        if (!etymologySection)
        {
            return "";
        }

        const level = etymologySection.level;
        const headerPattern = new RegExp(`={${level}}\\s*${escapeRegex(etymologySection.line)}\\s*={${level}}`);
        const headerMatch = wikitext.match(headerPattern);

        if (!headerMatch)
        {
            return "";
        }

        const startPosition = headerMatch.index + headerMatch[0].length;
        const nextHeader = wikitext.slice(startPosition).match(/\n={1,4}[^=]/);
        const endPosition = nextHeader ? startPosition + nextHeader.index : wikitext.length;
        const sectionText = wikitext.slice(startPosition, endPosition).trim();

        return cleanWikitext(sectionText).slice(0, 500);
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
     * Matches a country name to a known country in the schema.
     *
     * @param country - The country text to match.
     * @returns The matching schema country, or null.
     */
    function matchCountry(country)
    {
        const countries = window.OpenPaleo.getSchemaValues("countries");
        const lowerCountry = country.toLowerCase();

        for (const known of countries)
        {
            if (lowerCountry.includes(known.toLowerCase()))
            {
                return known;
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

    return { fetchGenus: fetchGenus };
})();
