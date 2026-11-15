import { describe, expect, it } from "vitest";
import type { PublicationRecord } from "@/server/publications/read";
import { buildDocument } from "./document";

const oxford = { id: "I1", name: "University of Oxford", countryCode: "GB" };
const aarhus = { id: "I2", name: "Aarhus University", countryCode: "DK" };
const cambridge = { id: "I3", name: "University of Cambridge", countryCode: "GB" };
const unknown = { id: "I4", name: "Somewhere", countryCode: null };

const record: PublicationRecord = {
  id: "W1",
  doi: "https://doi.org/10.1/x",
  title: "Ice",
  abstract: "Melting.",
  publicationDate: "2025-03-01",
  publicationYear: 2025,
  type: "article",
  language: "en",
  sourceName: null,
  citedByCount: 7,
  isOa: true,
  oaStatus: "gold",
  oaUrl: null,
  pmid: null,
  authorships: [
    { position: 0, authorId: "A1", name: "Ann", orcid: null, isCorresponding: true, affiliations: [oxford, aarhus] },
    // An unidentified Authorship (ADR-0004).
    { position: 1, authorId: null, name: "B. Printed", orcid: null, isCorresponding: false, affiliations: [cambridge, unknown] },
    { position: 2, authorId: "A2", name: "Cy", orcid: null, isCorresponding: false, affiliations: [aarhus] },
  ],
  topics: [
    { id: "T1", name: "Sea ice", subfield: "s", field: "Earth", domain: "Physical", isPrimary: true },
  ],
};

describe("buildDocument", () => {
  const doc = buildDocument(record);

  it("lists each Institution once, Danish ones first", () => {
    expect(doc.institution_ids).toEqual(["I2", "I1", "I3", "I4"]);
    expect(doc.institution_count).toBe(4);
  });

  it("lists each Country once, with its English name", () => {
    expect(doc.countries).toEqual(["DK", "GB"]);
    expect(doc.country_names).toEqual(["Denmark", "United Kingdom"]);
  });

  it("keeps an unidentified Authorship by name but not as an Author", () => {
    expect(doc.authors.map((a) => a.name)).toEqual(["Ann", "B. Printed", "Cy"]);
    expect(doc.author_ids).toEqual(["A1", "A2"]);
    expect(doc.author_count).toBe(3);
  });

  it("carries Topics with their field and domain", () => {
    expect(doc.topics).toEqual([
      { id: "T1", name: "Sea ice", field: "Earth", domain: "Physical" },
    ]);
    expect(doc.topic_ids).toEqual(["T1"]);
  });

  it("copes with no source, no Topics and no Authorships", () => {
    const bare = buildDocument({ ...record, authorships: [], topics: [] });
    expect(bare.source_name).toBeNull();
    expect(bare).toMatchObject({ countries: [], author_ids: [], topic_ids: [] });
  });
});
