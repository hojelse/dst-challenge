// Reads Publications from Postgres together with everything that hangs off
// them. The index builder reads all of them; the detail page reads one.

import { asc, eq, inArray } from "drizzle-orm";
import type { db as appDb } from "@/server/db";
import {
  affiliations,
  authors,
  authorships,
  institutions,
  publications,
  publicationTopics,
  topics,
} from "@/server/db/schema";

type Db = typeof appDb;

export type PublicationInstitution = {
  id: string;
  name: string;
  countryCode: string | null;
};

export type PublicationAuthorship = {
  position: number;
  /** Null for an unidentified Authorship (ADR-0004). */
  authorId: string | null;
  /** The Author's display name, or the printed name when unidentified. */
  name: string;
  orcid: string | null;
  isCorresponding: boolean;
  affiliations: PublicationInstitution[];
};

export type PublicationTopic = {
  id: string;
  name: string;
  subfield: string;
  field: string;
  domain: string;
  isPrimary: boolean;
};

export type PublicationRecord = {
  id: string;
  doi: string | null;
  title: string | null;
  abstract: string | null;
  publicationDate: string;
  publicationYear: number;
  type: string;
  language: string | null;
  sourceName: string | null;
  citedByCount: number;
  isOa: boolean;
  oaStatus: string;
  oaUrl: string | null;
  pmid: string | null;
  /** In author-list order. */
  authorships: PublicationAuthorship[];
  /** Primary Topic first, then by OpenAlex's score. */
  topics: PublicationTopic[];
};

/** Every Publication, or only those with the given IDs. Ordered by ID. */
export async function readPublications(
  db: Db,
  ids?: string[],
): Promise<PublicationRecord[]> {
  if (ids && ids.length === 0) return [];
  const only = <T>(column: T) =>
    ids ? inArray(column as never, ids) : undefined;

  const [publicationRows, authorshipRows, affiliationRows, topicRows] =
    await Promise.all([
      db
        .select({
          id: publications.id,
          doi: publications.doi,
          title: publications.title,
          abstract: publications.abstract,
          publicationDate: publications.publicationDate,
          publicationYear: publications.publicationYear,
          type: publications.type,
          language: publications.language,
          sourceName: publications.sourceName,
          citedByCount: publications.citedByCount,
          isOa: publications.isOa,
          oaStatus: publications.oaStatus,
          oaUrl: publications.oaUrl,
          pmid: publications.pmid,
        })
        .from(publications)
        .where(only(publications.id))
        .orderBy(asc(publications.id)),
      db
        .select({
          publicationId: authorships.publicationId,
          position: authorships.position,
          authorId: authorships.authorId,
          rawAuthorName: authorships.rawAuthorName,
          isCorresponding: authorships.isCorresponding,
          displayName: authors.displayName,
          orcid: authors.orcid,
        })
        .from(authorships)
        .leftJoin(authors, eq(authors.id, authorships.authorId))
        .where(only(authorships.publicationId))
        .orderBy(asc(authorships.publicationId), asc(authorships.position)),
      db
        .select({
          publicationId: affiliations.publicationId,
          position: affiliations.position,
          id: institutions.id,
          name: institutions.displayName,
          countryCode: institutions.countryCode,
        })
        .from(affiliations)
        .innerJoin(institutions, eq(institutions.id, affiliations.institutionId))
        .where(only(affiliations.publicationId))
        .orderBy(asc(institutions.displayName)),
      db
        .select({
          publicationId: publicationTopics.publicationId,
          id: topics.id,
          name: topics.displayName,
          subfield: topics.subfield,
          field: topics.field,
          domain: topics.domain,
          isPrimary: publicationTopics.isPrimary,
          score: publicationTopics.score,
        })
        .from(publicationTopics)
        .innerJoin(topics, eq(topics.id, publicationTopics.topicId))
        .where(only(publicationTopics.publicationId)),
    ]);

  const records = new Map<string, PublicationRecord>(
    publicationRows.map((row) => [row.id, { ...row, authorships: [], topics: [] }]),
  );

  const byAuthorship = new Map<string, PublicationAuthorship>();
  for (const row of authorshipRows) {
    const authorship: PublicationAuthorship = {
      position: row.position,
      authorId: row.authorId,
      name: row.displayName ?? row.rawAuthorName,
      orcid: row.orcid,
      isCorresponding: row.isCorresponding,
      affiliations: [],
    };
    byAuthorship.set(`${row.publicationId}/${row.position}`, authorship);
    records.get(row.publicationId)?.authorships.push(authorship);
  }

  for (const { publicationId, position, ...institution } of affiliationRows) {
    byAuthorship.get(`${publicationId}/${position}`)?.affiliations.push(institution);
  }

  topicRows.sort(
    (a, b) => Number(b.isPrimary) - Number(a.isPrimary) || b.score - a.score,
  );
  for (const { publicationId, ...topic } of topicRows) {
    records.get(publicationId)?.topics.push({
      id: topic.id,
      name: topic.name,
      subfield: topic.subfield,
      field: topic.field,
      domain: topic.domain,
      isPrimary: topic.isPrimary,
    });
  }

  return [...records.values()];
}

/** One Publication, or null when the ID is unknown. */
export async function readPublication(
  db: Db,
  id: string,
): Promise<PublicationRecord | null> {
  const [record] = await readPublications(db, [id]);
  return record ?? null;
}
