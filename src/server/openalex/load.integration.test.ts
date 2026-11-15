import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/server/db/schema";
import { loadWorks } from "./load";
import { fixtureWork, fixtureWorks, type RawWork } from "./__fixtures__/fixture";

// Runs only under `pnpm test:integration`, against the `thegreendiamond_test`
// database. loadWorks(db, works, singleWorks) loads one list page of raw
// OpenAlex works in one transaction; a work that also appears in singleWorks
// is stored in its single-work version instead.

type OpenAlexWork = Parameters<typeof loadWorks>[1][number];
const asWorks = (works: RawWork[]) => works as unknown as OpenAlexWork[];

const TABLES = [
  "publications",
  "authors",
  "institutions",
  "topics",
  "authorships",
  "affiliations",
  "publication_topics",
] as const;

/** Row counts after loading the fixture, counted from the fixture records. */
const FIXTURE_COUNTS = {
  publications: 5,
  authors: 253,
  institutions: 170,
  topics: 12,
  authorships: 262,
  affiliations: 305,
  publication_topics: 12,
};

let sql: postgres.Sql;
let db: ReturnType<typeof drizzle<typeof schema>>;

async function counts() {
  const result: Record<string, number> = {};
  for (const table of TABLES) {
    const [row] = await sql<{ n: number }[]>`
      select count(*)::int as n from ${sql(table)}
    `;
    result[table] = row.n;
  }
  return result;
}

async function authorshipsOf(publicationId: string) {
  return sql<
    { position: number; author_id: string | null; raw_author_name: string }[]
  >`
    select position, author_id, raw_author_name
    from authorships
    where publication_id = ${publicationId}
    order by position
  `;
}

beforeAll(() => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL must be set for integration tests");
  }
  sql = postgres(url, { max: 1, onnotice: () => {} });
  db = drizzle(sql, { schema });
});

afterAll(async () => {
  await sql?.end();
});

beforeEach(async () => {
  await sql`truncate ${sql(TABLES as unknown as string[])} cascade`;
});

describe("loadWorks", () => {
  it("loads the fixture into every table", async () => {
    await loadWorks(db, asWorks(fixtureWorks()));
    expect(await counts()).toEqual(FIXTURE_COUNTS);
  });

  it("stores unidentified Authorships with a null Author", async () => {
    await loadWorks(db, asWorks(fixtureWorks()));
    const rows = await sql<{ publication_id: string; position: number }[]>`
      select publication_id, position
      from authorships
      where author_id is null
      order by publication_id, position
    `;
    expect(rows.map((r) => `${r.publication_id}:${r.position}`)).toEqual([
      "W4406617993:25",
      "W4406617993:51",
      "W4406617993:60",
      "W4406617993:93",
      "W4406617993:105",
      "W4406617993:113",
      "W4406617993:125",
      "W4406617993:147",
      "W4410557539:2",
    ]);
    const [affiliation] = await sql<{ institution_id: string }[]>`
      select institution_id from affiliations
      where publication_id = 'W4406617993' and position = 60
    `;
    expect(affiliation.institution_id).toBe("I204337017");
  });

  it("gives identical row counts when the fixture is loaded twice", async () => {
    await loadWorks(db, asWorks(fixtureWorks()));
    const first = await counts();
    await loadWorks(db, asWorks(fixtureWorks()));
    expect(await counts()).toEqual(first);
    expect(first).toEqual(FIXTURE_COUNTS);
  });

  it("replaces a Publication's Authorships when its author list changes", async () => {
    await loadWorks(db, asWorks(fixtureWorks()));
    expect(await authorshipsOf("W4407152801")).toHaveLength(13);

    const works = fixtureWorks();
    const changed = works.find(
      (w) => w.id === "https://openalex.org/W4407152801",
    )!;
    const original = changed.authorships;
    // Keep two of the thirteen, in reverse order.
    changed.authorships = [original[12], original[0]];
    await loadWorks(db, asWorks(works));

    const rows = await authorshipsOf("W4407152801");
    expect(rows).toEqual([
      {
        position: 0,
        author_id: original[12].author.id!.replace("https://openalex.org/", ""),
        raw_author_name: original[12].raw_author_name,
      },
      {
        position: 1,
        author_id: original[0].author.id!.replace("https://openalex.org/", ""),
        raw_author_name: original[0].raw_author_name,
      },
    ]);

    const affiliations = await sql<
      { position: number; institution_id: string }[]
    >`
      select position, institution_id from affiliations
      where publication_id = 'W4407152801'
      order by position, institution_id
    `;
    const expected = changed.authorships.flatMap((a, position) =>
      [...new Set(a.institutions.map((i) => i.id))].sort().map((id) => ({
        position,
        institution_id: id.replace("https://openalex.org/", ""),
      })),
    );
    expect(affiliations).toEqual(expected);

    const after = await counts();
    expect(after.publications).toBe(5);
    expect(after.authorships).toBe(FIXTURE_COUNTS.authorships - 13 + 2);
    expect(await authorshipsOf("W4406617993")).toHaveLength(241);

    const [{ raw }] = await sql<{ raw: RawWork }[]>`
      select raw from publications where id = 'W4407152801'
    `;
    expect(raw.authorships).toHaveLength(2);
  });

  describe("a work in a list page that also has a single-work version", () => {
    // List pages cap authorships at 100; the single-work endpoint has all.
    function listPageVersion(): RawWork {
      const work = fixtureWork("W4406617993");
      work.authorships = work.authorships.slice(0, 100);
      work.relevance_score = 123.45;
      return work;
    }

    it("is stored in its list version when there is no single-work version", async () => {
      await loadWorks(db, asWorks([listPageVersion()]));
      expect(await authorshipsOf("W4406617993")).toHaveLength(100);
    });

    it("is stored in its single-work version, rows and raw", async () => {
      const single = fixtureWork("W4406617993");
      await loadWorks(db, asWorks([listPageVersion()]), asWorks([single]));

      expect(await authorshipsOf("W4406617993")).toHaveLength(241);
      const [{ raw }] = await sql<{ raw: RawWork }[]>`
        select raw from publications where id = 'W4406617993'
      `;
      expect(raw.authorships).toHaveLength(241);
      expect(raw).not.toHaveProperty("relevance_score");
      expect(raw).toEqual(single);
      expect((await counts()).publications).toBe(1);
    });
  });
});
