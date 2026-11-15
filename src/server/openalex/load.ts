// Loads OpenAlex works into Postgres, one list page per transaction.

import { getTableColumns, inArray, sql, type Column } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "@/server/db/schema";
import { mapWork, shortenId, type OpenAlexWork } from "./mapper";

type Db = PostgresJsDatabase<typeof schema>;

/** What one call to loadWorks stored. */
export type LoadSummary = {
  publications: number;
  authorships: number;
  unidentifiedAuthorships: number;
};

// Postgres allows at most 65,535 bind parameters per statement; no table has
// more than 16 columns, so 1,000 rows per insert stays well under it.
const CHUNK_SIZE = 1000;

function chunks<T>(rows: T[]): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    result.push(rows.slice(i, i + CHUNK_SIZE));
  }
  return result;
}

/** Keeps the last row for each key. */
function uniqueBy<T>(rows: T[], key: (row: T) => string): T[] {
  return [...new Map(rows.map((row) => [key(row), row])).values()];
}

/** `set` for an upsert: every non-key column takes the incoming value. */
function excludedColumns(table: PgTable, keys: string[]) {
  const columns = getTableColumns(table) as Record<string, Column>;
  return Object.fromEntries(
    Object.entries(columns)
      .filter(([key]) => !keys.includes(key))
      .map(([key, column]) => [
        key,
        sql.raw(`excluded."${column.name}"`),
      ]),
  );
}

/**
 * Loads one list page of OpenAlex works in one transaction. A work that also
 * appears in `singleWorks` is stored in that version instead: list pages cap
 * `authorships` at 100, the single-work endpoint does not.
 *
 * Publications are upserted and their Authorships, Affiliations and
 * Publication topics replaced; Authors, Institutions and Topics are upserted.
 * Loading the same works again leaves every row count unchanged.
 */
export async function loadWorks(
  db: Db,
  works: OpenAlexWork[],
  singleWorks: OpenAlexWork[] = [],
): Promise<LoadSummary> {
  const singles = new Map(singleWorks.map((w) => [shortenId(w.id), w]));
  const mapped = uniqueBy(works, (w) => shortenId(w.id)).map((work) =>
    mapWork(singles.get(shortenId(work.id)) ?? work),
  );

  const publications = mapped.map((m) => m.publication);
  const authors = uniqueBy(
    mapped.flatMap((m) => m.authors),
    (a) => a.id,
  );
  const institutions = uniqueBy(
    mapped.flatMap((m) => m.institutions),
    (i) => i.id,
  );
  const topics = uniqueBy(
    mapped.flatMap((m) => m.topics),
    (t) => t.id,
  );
  const authorships = mapped.flatMap((m) => m.authorships);
  const affiliations = mapped.flatMap((m) => m.affiliations);
  const publicationTopics = mapped.flatMap((m) => m.publicationTopics);
  const publicationIds = publications.map((p) => p.id);

  await db.transaction(async (tx) => {
    for (const rows of chunks(authors)) {
      await tx
        .insert(schema.authors)
        .values(rows)
        .onConflictDoUpdate({
          target: schema.authors.id,
          set: excludedColumns(schema.authors, ["id"]),
        });
    }
    for (const rows of chunks(institutions)) {
      await tx
        .insert(schema.institutions)
        .values(rows)
        .onConflictDoUpdate({
          target: schema.institutions.id,
          set: excludedColumns(schema.institutions, ["id"]),
        });
    }
    for (const rows of chunks(topics)) {
      await tx
        .insert(schema.topics)
        .values(rows)
        .onConflictDoUpdate({
          target: schema.topics.id,
          set: excludedColumns(schema.topics, ["id"]),
        });
    }
    for (const rows of chunks(publications)) {
      await tx
        .insert(schema.publications)
        .values(rows)
        .onConflictDoUpdate({
          target: schema.publications.id,
          set: excludedColumns(schema.publications, ["id", "harvestedAt"]),
        });
    }

    // Replace each Publication's child rows. Deleting its Authorships
    // cascades to their Affiliations.
    for (const ids of chunks(publicationIds)) {
      await tx
        .delete(schema.authorships)
        .where(inArray(schema.authorships.publicationId, ids));
      await tx
        .delete(schema.publicationTopics)
        .where(inArray(schema.publicationTopics.publicationId, ids));
    }
    for (const rows of chunks(authorships)) {
      await tx.insert(schema.authorships).values(rows);
    }
    for (const rows of chunks(affiliations)) {
      await tx.insert(schema.affiliations).values(rows);
    }
    for (const rows of chunks(publicationTopics)) {
      await tx.insert(schema.publicationTopics).values(rows);
    }
  });

  return {
    publications: publications.length,
    authorships: authorships.length,
    unidentifiedAuthorships: authorships.filter((a) => a.authorId === null)
      .length,
  };
}
