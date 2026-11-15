import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Runs only under `pnpm test:integration`. The integration setup points
// DATABASE_URL at the `thegreendiamond_test` database and runs
// `drizzle-kit push` against it before these tests.

const EXPECTED_TABLES = [
  "affiliations",
  "authors",
  "authorships",
  "institutions",
  "publication_topics",
  "publications",
  "topics",
];

const EXPECTED_PRIMARY_KEYS: Record<string, string[]> = {
  publications: ["id"],
  authors: ["id"],
  institutions: ["id"],
  topics: ["id"],
  authorships: ["publication_id", "position"],
  affiliations: ["publication_id", "position", "institution_id"],
  publication_topics: ["publication_id", "topic_id"],
};

let sql: postgres.Sql;

beforeAll(() => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL must be set for integration tests");
  }
  sql = postgres(url, { max: 1 });
});

afterAll(async () => {
  await sql?.end();
});

describe("database schema", () => {
  it("runs against the test database", async () => {
    const [row] = await sql<{ db: string }[]>`select current_database() as db`;
    expect(row.db).toBe("thegreendiamond_test");
  });

  it("has exactly the seven expected tables in the public schema", async () => {
    const rows = await sql<{ table_name: string }[]>`
      select table_name
      from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE'
      order by table_name
    `;
    expect(rows.map((r) => r.table_name)).toEqual(EXPECTED_TABLES);
  });

  it.each(Object.entries(EXPECTED_PRIMARY_KEYS))(
    "%s has the expected primary key",
    async (table, columns) => {
      const rows = await sql<{ column_name: string }[]>`
        select kcu.column_name
        from information_schema.table_constraints tc
        join information_schema.key_column_usage kcu
          on kcu.constraint_name = tc.constraint_name
         and kcu.constraint_schema = tc.constraint_schema
         and kcu.table_name = tc.table_name
        where tc.table_schema = 'public'
          and tc.table_name = ${table}
          and tc.constraint_type = 'PRIMARY KEY'
      `;
      expect(rows.map((r) => r.column_name).sort()).toEqual(
        [...columns].sort(),
      );
    },
  );

  it("stores publications.raw as jsonb and allows a null abstract", async () => {
    const rows = await sql<
      { column_name: string; data_type: string; is_nullable: string }[]
    >`
      select column_name, data_type, is_nullable
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'publications'
        and column_name in ('raw', 'abstract')
    `;
    const byName = Object.fromEntries(rows.map((r) => [r.column_name, r]));
    expect(byName.raw?.data_type).toBe("jsonb");
    expect(byName.abstract?.is_nullable).toBe("YES");
  });
});
