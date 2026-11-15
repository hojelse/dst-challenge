import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseSearchState } from "@/lib/search-params";
import { db } from "@/server/db";
import {
  authorsByCountry,
  citationDistribution,
  topDanishAuthors,
} from "@/server/insights/queries";
import { loadWorks } from "@/server/openalex/load";
import { fixtureWorks } from "@/server/openalex/__fixtures__/fixture";
import { readPublication } from "@/server/publications/read";
import { rebuildIndex } from "./build-index";
import { elasticsearch, indexName } from "./elasticsearch";
import { filterOptions, searchPublications } from "./service";

// Runs only under `pnpm test:integration`: the five fixture works are loaded
// into the test database, indexed into `publications_test`, and searched
// through the real Elasticsearch.
//
// The fixture: W4406617993 (gold, 53 Countries, 51 citations), W4407152801
// (closed; CH, DK, US), W4410557539 (gold; DK, PT), W7132088526 (closed; DK),
// W7223643305 (green; DK). Every one has a Danish Affiliation.

type Work = Parameters<typeof loadWorks>[1][number];
const works = fixtureWorks();

const search = (query = "") =>
  searchPublications(parseSearchState(new URLSearchParams(query)));
const ids = (result: Awaited<ReturnType<typeof search>>) =>
  result.items.map((item) => item.id).sort();

beforeAll(async () => {
  await db.execute(sql`
    truncate publications, authors, institutions, topics, authorships,
      affiliations, publication_topics cascade
  `);
  await loadWorks(db, works as unknown as Work[]);
  await rebuildIndex(db);
});

afterAll(async () => {
  await db.$client.end();
});

describe("rebuildIndex", () => {
  it("indexes every Publication, and replaces the index when run again", async () => {
    expect(await rebuildIndex(db)).toBe(5);
    const { count } = await elasticsearch<{ count: number }>(
      "GET",
      `/${indexName()}/_count`,
    );
    expect(count).toBe(5);
  });

  it("maps ID fields as keyword", async () => {
    const mapping = await elasticsearch<
      Record<string, { mappings: { properties: Record<string, { type: string }> } }>
    >("GET", `/${indexName()}/_mapping`);
    const { properties } = mapping[indexName()].mappings;
    for (const field of ["id", "author_ids", "institution_ids", "topic_ids", "countries", "oa_status"]) {
      expect(properties[field].type).toBe("keyword");
    }
  });
});

describe("searchPublications", () => {
  it("returns everything, newest first, without Search or Filters", async () => {
    const result = await search();
    expect(result).toMatchObject({ all: 5, total: 5, search: null, filters: [] });
    const dates = result.items.map((item) => item.publication_date);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it("chains the counts from Search through each Filter to the total", async () => {
    const result = await search("q=climate&oa=gold,green&countries=PT&order=oa,countries");
    const [oa, countries] = result.filters;
    expect(result.search?.input).toBe(result.all);
    expect(oa.input).toBe(result.search?.output);
    expect(countries.input).toBe(oa.output);
    expect(countries.output).toBe(result.total);
  });

  it("gives the same result in any Filter order, with different counts", async () => {
    const a = await search("oa=gold&countries=PT&order=oa,countries");
    const b = await search("oa=gold&countries=PT&order=countries,oa");
    expect(ids(a)).toEqual(ids(b));
    // Two gold Publications, both with a Portuguese Affiliation.
    expect(a.filters.map((f) => [f.key, f.input, f.output])).toEqual([
      ["oa", 5, 2],
      ["countries", 2, 2],
    ]);
    expect(b.filters.map((f) => [f.key, f.input, f.output])).toEqual([
      ["countries", 5, 2],
      ["oa", 2, 2],
    ]);
  });

  it("keeps exactly the Publications with none of a negated Filter's values", async () => {
    const result = await search("oa=gold&not=oa");
    expect(ids(result)).toEqual(["W4407152801", "W7132088526", "W7223643305"]);
  });

  it("does not narrow by a switched-off Filter, but keeps its values", async () => {
    const result = await search("oa=gold&off=oa");
    expect(result.total).toBe(5);
    expect(result.filters[0]).toMatchObject({
      off: true,
      input: 5,
      output: 5,
      values: [{ id: "gold", label: "gold" }],
    });
  });

  it("labels Filter values with display names", async () => {
    const topic = works[0].topics[0];
    const topicId = topic.id.split("/").pop()!;
    const result = await search(`countries=CH&topics=${topicId}`);
    const labels = Object.fromEntries(
      result.filters.map((f) => [f.key, f.values[0].label]),
    );
    expect(labels.countries).toBe("Switzerland");
    expect(labels.topics).toBe(topic.display_name);
  });

  it("finds Publications by a Country name", async () => {
    // Only W4407152801 and the 53-Country work have a Swiss Affiliation.
    expect(ids(await search("q=switzerland"))).toEqual([
      "W4406617993",
      "W4407152801",
    ]);
  });

  it("finds a Publication by the printed name of an unidentified Authorship", async () => {
    const printed = works
      .flatMap((work) => work.authorships)
      .find((authorship) => authorship.author.id === null)!.raw_author_name;
    const word = printed.split(/\s+/).sort((a, b) => b.length - a.length)[0];
    expect((await search(`q=${encodeURIComponent(word)}`)).total).toBeGreaterThan(0);
  });

  it("sorts by citations across pages, and returns no items past the end", async () => {
    const first = await search("sort=citations&size=2");
    const second = await search("sort=citations&size=2&page=2");
    const counts = [...first.items, ...second.items].map((i) => i.cited_by_count);
    expect(counts).toEqual([51, 13, 0, 0]);
    const beyond = await search("size=2&page=9");
    expect(beyond).toMatchObject({ total: 5, items: [] });
  });
});

describe("filterOptions", () => {
  const options = (query: string, key: "oa" | "countries") =>
    filterOptions(parseSearchState(new URLSearchParams(query)), key);

  it("lists every value in the index, including those no longer reachable", async () => {
    const oa = await options("countries=PT&order=countries,oa&oa=gold", "oa");
    expect(Object.fromEntries(oa.map((o) => [o.id, [o.here, o.overall]]))).toEqual({
      gold: [2, 2],
      closed: [0, 2],
      green: [0, 1],
    });
  });

  it("counts 'here' before the Filter itself and names Countries", async () => {
    const countries = await options("countries=PT", "countries");
    const denmark = countries.find((o) => o.id === "DK");
    expect(denmark).toEqual({ id: "DK", label: "Denmark", here: 5, overall: 5 });
  });
});

describe("readPublication", () => {
  it("returns Authorships in author-list order, each with its Affiliations", async () => {
    const work = works.find((w) => w.id.endsWith("W4407152801"))!;
    const publication = await readPublication(db, "W4407152801");
    expect(publication!.authorships.map((a) => a.position)).toEqual(
      work.authorships.map((_, i) => i),
    );
    expect(
      publication!.authorships.map((a) => a.affiliations.map((i) => i.id).sort()),
    ).toEqual(
      work.authorships.map((a) =>
        [...new Set(a.institutions.map((i) => i.id.split("/").pop()!))].sort(),
      ),
    );
  });

  it("returns a null abstract when there is none, and null for an unknown ID", async () => {
    expect((await readPublication(db, "W4407152801"))!.abstract).toBeNull();
    expect(await readPublication(db, "W0")).toBeNull();
  });
});

describe("insights", () => {
  /** Author IDs per Country, counted straight from the fixture JSON. */
  const authorsIn = new Map<string, Set<string>>();
  const publicationsOf = new Map<string, Set<string>>();
  for (const work of works) {
    for (const authorship of work.authorships) {
      if (!authorship.author.id) continue;
      const author = authorship.author.id.split("/").pop()!;
      if (!publicationsOf.has(author)) publicationsOf.set(author, new Set());
      publicationsOf.get(author)!.add(work.id);
      for (const institution of authorship.institutions) {
        if (!institution.country_code) continue;
        if (!authorsIn.has(institution.country_code)) {
          authorsIn.set(institution.country_code, new Set());
        }
        authorsIn.get(institution.country_code)!.add(author);
      }
    }
  }

  it("counts each Author once per Country", async () => {
    const rows = await authorsByCountry(db);
    expect(rows).toHaveLength(authorsIn.size);
    for (const row of rows) {
      expect(row.authors, row.countryCode).toBe(authorsIn.get(row.countryCode)!.size);
    }
  });

  it("ranks only Danish Authors, each once, with a Danish Institution listed", async () => {
    const danish = authorsIn.get("DK")!;
    const rows = await topDanishAuthors(db);
    expect(rows).toHaveLength(Math.min(20, danish.size));
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
    for (const row of rows) {
      expect(danish.has(row.id), row.name).toBe(true);
      expect(row.publications).toBe(publicationsOf.get(row.id)!.size);
      expect(row.institutions.some((i) => i.countryCode === "DK")).toBe(true);
    }
    const counts = rows.map((r) => r.publications);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });

  it("bins citation counts so that every Publication is counted once", async () => {
    const bins = await citationDistribution(db);
    // Citations in the fixture: 0, 0, 0, 13 and 51.
    expect(Object.fromEntries(bins.map((b) => [b.label, b.publications]))).toMatchObject({
      "0": 3,
      "11–20": 1,
      "51–100": 1,
    });
    expect(bins.reduce((sum, b) => sum + b.publications, 0)).toBe(5);
  });
});
