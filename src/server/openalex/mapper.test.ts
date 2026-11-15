import { describe, expect, it } from "vitest";
import { mapWork, rebuildAbstract, shortenId } from "./mapper";
import {
  FIXTURE_IDS,
  fixtureWork,
  fixtureWorks,
  type FixtureId,
  type RawWork,
} from "./__fixtures__/fixture";

// The mapper is pure: one raw OpenAlex work in, plain rows for every table
// out, shaped like the Drizzle insert types in src/server/db/schema.ts.

type OpenAlexWork = Parameters<typeof mapWork>[0];

function map(work: RawWork) {
  return mapWork(work as unknown as OpenAlexWork);
}

const short = (url: string) => url.replace("https://openalex.org/", "");
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const byId = <T extends { id: string }>(rows: T[]) =>
  [...rows].sort((a, b) => compare(a.id, b.id));

/** Counted from the fixture records themselves. */
const EXPECTED: Record<
  FixtureId,
  {
    authorships: number;
    authors: number;
    unidentifiedPositions: number[];
    institutions: number;
    affiliations: number;
    topics: number;
    primaryTopicId: string | null;
    hasAbstract: boolean;
    sourceName: string | null;
    oaStatus: string;
  }
> = {
  W4406617993: {
    authorships: 241,
    authors: 233,
    unidentifiedPositions: [25, 51, 60, 93, 105, 113, 125, 147],
    institutions: 162,
    affiliations: 292,
    topics: 3,
    primaryTopicId: "T11488",
    hasAbstract: true,
    sourceName: "Scientific Data",
    oaStatus: "gold",
  },
  W4407152801: {
    authorships: 13,
    authors: 13,
    unidentifiedPositions: [],
    institutions: 5,
    affiliations: 8,
    topics: 3,
    primaryTopicId: "T13180",
    hasAbstract: false,
    sourceName: "Environmental Innovation and Societal Transitions",
    oaStatus: "closed",
  },
  W4410557539: {
    authorships: 3,
    authors: 2,
    unidentifiedPositions: [2],
    institutions: 2,
    affiliations: 2,
    topics: 3,
    primaryTopicId: "T10766",
    hasAbstract: true,
    sourceName: null,
    oaStatus: "gold",
  },
  W7132088526: {
    authorships: 1,
    authors: 1,
    unidentifiedPositions: [],
    institutions: 1,
    affiliations: 1,
    topics: 0,
    primaryTopicId: null,
    hasAbstract: true,
    sourceName: "Ministry of Culture Research Portal",
    oaStatus: "closed",
  },
  W7223643305: {
    authorships: 4,
    authors: 4,
    unidentifiedPositions: [],
    institutions: 1,
    affiliations: 2,
    topics: 3,
    primaryTopicId: "T10121",
    hasAbstract: false,
    sourceName: null,
    oaStatus: "green",
  },
};

describe("shortenId", () => {
  it("strips the OpenAlex URL prefix", () => {
    expect(shortenId("https://openalex.org/W4406617993")).toBe("W4406617993");
    expect(shortenId("https://openalex.org/A5126883945")).toBe("A5126883945");
    expect(shortenId("https://openalex.org/I204337017")).toBe("I204337017");
    expect(shortenId("https://openalex.org/T11488")).toBe("T11488");
  });

  it("leaves an already short ID unchanged", () => {
    expect(shortenId("W4406617993")).toBe("W4406617993");
  });
});

describe("rebuildAbstract", () => {
  it("puts words back in position order, repeating words as indexed", () => {
    expect(
      rebuildAbstract({ the: [0, 3], cat: [1], sat: [2], mat: [4], on: [5] }),
    ).toBe("the cat sat the mat on");
  });

  it("gives null for a null or missing index", () => {
    expect(rebuildAbstract(null)).toBeNull();
    expect(rebuildAbstract(undefined)).toBeNull();
  });

  it("rebuilds a real abstract from the fixture in word order", () => {
    const work = fixtureWork("W4410557539");
    const abstract = rebuildAbstract(work.abstract_inverted_index);
    expect(abstract).toMatch(
      /^As climate change prospects point towards the pressing need for local adaptation strategies, exposure to extreme weather /,
    );
    expect(abstract).toMatch(
      / concept’s reliability and scalability to other urban regions\.$/,
    );
    expect(abstract!.split(" ")).toHaveLength(251);
  });
});

describe("mapWork against the fixture", () => {
  it("covers the five fixture works", () => {
    expect(fixtureWorks().map((w) => short(w.id))).toEqual([...FIXTURE_IDS]);
  });

  it("never emits an OpenAlex URL as an ID", () => {
    for (const work of fixtureWorks()) {
      const rows = map(work);
      const ids = [
        rows.publication.id,
        ...rows.authors.map((r) => r.id),
        ...rows.institutions.map((r) => r.id),
        ...rows.topics.map((r) => r.id),
        ...rows.authorships.flatMap((r) => [r.publicationId, r.authorId]),
        ...rows.affiliations.flatMap((r) => [r.publicationId, r.institutionId]),
        ...rows.publicationTopics.flatMap((r) => [r.publicationId, r.topicId]),
      ];
      for (const id of ids) {
        if (id === null) continue;
        expect(id).not.toMatch(/^https?:\/\//);
      }
    }
  });

  describe.each(FIXTURE_IDS)("%s", (id) => {
    const expected = EXPECTED[id];

    it("maps the Publication", () => {
      const work = fixtureWork(id);
      const { publication } = map(work);
      expect(publication).toMatchObject({
        id,
        title: work.title,
        publicationDate: work.publication_date,
        publicationYear: work.publication_year,
        type: work.type,
        language: work.language,
        sourceName: expected.sourceName,
        citedByCount: work.cited_by_count,
        isOa: work.open_access.is_oa,
        oaStatus: expected.oaStatus,
        oaUrl: work.open_access.oa_url,
      });
      if (expected.hasAbstract) {
        expect(publication.abstract).toBe(
          rebuildAbstract(work.abstract_inverted_index),
        );
        expect(typeof publication.abstract).toBe("string");
      } else {
        expect(publication.abstract).toBeNull();
      }
      expect(publication.raw).toEqual(work);
    });

    it("maps every Authorship at its original 0-based position", () => {
      const work = fixtureWork(id);
      const { authorships } = map(work);
      expect(authorships).toHaveLength(expected.authorships);
      expect(authorships).toEqual(
        work.authorships.map((a, position) => ({
          publicationId: id,
          position,
          authorId: a.author.id === null ? null : short(a.author.id),
          authorPosition: a.author_position,
          isCorresponding: a.is_corresponding,
          rawAuthorName: a.raw_author_name,
        })),
      );
      const unidentified = authorships
        .filter((a) => a.authorId === null)
        .map((a) => a.position);
      expect(unidentified).toEqual(expected.unidentifiedPositions);
    });

    it("maps each identified Author once, named by the author entity", () => {
      const work = fixtureWork(id);
      const { authors } = map(work);
      expect(authors).toHaveLength(expected.authors);
      const fromWork = new Map<string, string>();
      for (const a of work.authorships) {
        if (a.author.id !== null) {
          fromWork.set(short(a.author.id), a.author.display_name);
        }
      }
      expect(byId(authors)).toEqual(
        [...fromWork.keys()].sort(compare).map((authorId) =>
          expect.objectContaining({
            id: authorId,
            displayName: fromWork.get(authorId),
          }),
        ),
      );
    });

    it("maps each Institution once, with its Country", () => {
      const work = fixtureWork(id);
      const { institutions } = map(work);
      expect(institutions).toHaveLength(expected.institutions);
      const fromWork = new Map<string, { name: string; country: string | null }>();
      for (const a of work.authorships) {
        for (const i of a.institutions) {
          fromWork.set(short(i.id), {
            name: i.display_name,
            country: i.country_code,
          });
        }
      }
      expect(byId(institutions)).toEqual(
        [...fromWork.keys()].sort(compare).map((institutionId) =>
          expect.objectContaining({
            id: institutionId,
            displayName: fromWork.get(institutionId)!.name,
            countryCode: fromWork.get(institutionId)!.country,
          }),
        ),
      );
    });

    it("maps one Affiliation per Institution on each Authorship", () => {
      const work = fixtureWork(id);
      const { affiliations } = map(work);
      expect(affiliations).toHaveLength(expected.affiliations);
      const fromWork = work.authorships.flatMap((a, position) =>
        [...new Set(a.institutions.map((i) => short(i.id)))].map(
          (institutionId) => ({ publicationId: id, position, institutionId }),
        ),
      );
      const sort = <T extends { position: number; institutionId: string }>(
        rows: T[],
      ) =>
        [...rows].sort(
          (a, b) =>
            a.position - b.position || compare(a.institutionId, b.institutionId),
        );
      expect(sort(affiliations)).toEqual(sort(fromWork));
    });

    it("maps Topics with their taxonomy and flags the primary one", () => {
      const work = fixtureWork(id);
      const { topics, publicationTopics } = map(work);
      expect(topics).toHaveLength(expected.topics);
      expect(publicationTopics).toHaveLength(expected.topics);
      expect(byId(topics)).toEqual(
        byId(
          work.topics.map((t) => ({
            id: short(t.id),
            displayName: t.display_name,
            subfield: t.subfield.display_name,
            field: t.field.display_name,
            domain: t.domain.display_name,
          })),
        ),
      );
      const sortByTopic = <T extends { topicId: string }>(rows: T[]) =>
        [...rows].sort((a, b) => compare(a.topicId, b.topicId));
      expect(sortByTopic(publicationTopics)).toEqual(
        sortByTopic(
          work.topics.map((t) => ({
            publicationId: id,
            topicId: short(t.id),
            score: t.score,
            isPrimary: short(t.id) === expected.primaryTopicId,
          })),
        ),
      );
      const primary = publicationTopics.filter((t) => t.isPrimary);
      expect(primary.map((t) => t.topicId)).toEqual(
        expected.primaryTopicId === null ? [] : [expected.primaryTopicId],
      );
    });
  });

  it("names an Author by the entity's display name, not the printed name", () => {
    const rows = map(fixtureWork("W7223643305"));
    expect(rows.authorships[0]).toMatchObject({
      authorId: "A5126883945",
      rawAuthorName: "Strøm, Kristine; id_orcid 0009-0009-5701-6373",
    });
    expect(rows.authors.find((a) => a.id === "A5126883945")).toMatchObject({
      displayName: "Kristine Strøm",
    });
  });

  it("maps all 241 Authorships of the work with more than 100 Authors", () => {
    const rows = map(fixtureWork("W4406617993"));
    expect(rows.authorships).toHaveLength(241);
    expect(rows.authorships.map((a) => a.position)).toEqual(
      Array.from({ length: 241 }, (_, i) => i),
    );
    expect(rows.authorships.at(-1)?.authorPosition).toBe("last");
  });
});

describe("mapWork with an unidentified Authorship", () => {
  it("keeps it at its position with a null Author and its printed name", () => {
    const rows = map(fixtureWork("W4406617993"));
    expect(rows.authorships[60]).toEqual({
      publicationId: "W4406617993",
      position: 60,
      authorId: null,
      authorPosition: "middle",
      isCorresponding: false,
      rawAuthorName: "Christian T. Elbaek",
    });
  });

  it("keeps its Affiliations", () => {
    const rows = map(fixtureWork("W4406617993"));
    expect(rows.affiliations.filter((a) => a.position === 60)).toEqual([
      { publicationId: "W4406617993", position: 60, institutionId: "I204337017" },
    ]);
    expect(
      rows.affiliations
        .filter((a) => a.position === 147)
        .map((a) => a.institutionId)
        .sort(),
    ).toEqual(["I124357947", "I184558857"]);
    expect(rows.institutions.find((i) => i.id === "I204337017")).toMatchObject(
      { displayName: "Aarhus University", countryCode: "DK" },
    );
  });

  it("produces no Author row for it", () => {
    const work = fixtureWork("W4406617993");
    const rows = map(work);
    expect(rows.authors).toHaveLength(233);
    for (const author of rows.authors) {
      expect(typeof author.id).toBe("string");
      expect(author.id).not.toBe("");
    }
    const names = new Set(rows.authors.map((a) => a.displayName));
    expect(names.has("Christian T. Elbaek")).toBe(false);
    expect(names.has("Ryan McKay")).toBe(false);
  });

  it("keeps an unidentified Authorship that has no Affiliations", () => {
    const rows = map(fixtureWork("W4410557539"));
    expect(rows.authorships[2]).toEqual({
      publicationId: "W4410557539",
      position: 2,
      authorId: null,
      authorPosition: "last",
      isCorresponding: false,
      rawAuthorName: "CLIM4cities ESA Project Team",
    });
    expect(rows.affiliations.filter((a) => a.position === 2)).toEqual([]);
    expect(rows.authors).toHaveLength(2);
  });
});

// No Institution in the 1,000 harvested works had a null country_code, and
// none listed the same Institution twice on one Authorship, so these cases
// use hand-edited copies of fixture records.
describe("mapWork with hand-edited records", () => {
  it("allows an Institution without a Country", () => {
    const work = fixtureWork("W7223643305");
    for (const a of work.authorships) {
      for (const i of a.institutions) i.country_code = null;
    }
    const rows = map(work);
    expect(rows.institutions).toEqual([
      expect.objectContaining({
        id: "I3019169596",
        displayName: "Danish Technological Institute",
        countryCode: null,
      }),
    ]);
    expect(rows.affiliations).toHaveLength(2);
  });

  it("gives one Affiliation for an Institution listed twice on one Authorship", () => {
    const work = fixtureWork("W7223643305");
    const authorship = work.authorships[3];
    authorship.institutions = [
      authorship.institutions[0],
      structuredClone(authorship.institutions[0]),
    ];
    const rows = map(work);
    expect(rows.affiliations.filter((a) => a.position === 3)).toEqual([
      { publicationId: "W7223643305", position: 3, institutionId: "I3019169596" },
    ]);
    expect(rows.affiliations).toHaveLength(2);
    expect(rows.institutions).toHaveLength(1);
  });

  it("does not depend on the abstract index being present at all", () => {
    const work = fixtureWork("W4410557539");
    delete (work as Record<string, unknown>).abstract_inverted_index;
    expect(map(work).publication.abstract).toBeNull();
  });
});
