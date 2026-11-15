// Maps one raw OpenAlex work to rows for every table. Pure: no I/O.

import type {
  affiliations,
  authors,
  authorships,
  institutions,
  publications,
  publicationTopics,
  topics,
} from "@/server/db/schema";

/** An Institution as OpenAlex lists it on an Authorship. */
export type OpenAlexInstitution = {
  id: string;
  display_name: string;
  country_code: string | null;
  ror: string | null;
  type: string | null;
};

/** One entry in an OpenAlex work's `authorships`. */
export type OpenAlexAuthorship = {
  author_position: string;
  /** `id` is null when OpenAlex did not resolve the person to an Author. */
  author: { id: string | null; display_name: string; orcid: string | null };
  institutions: OpenAlexInstitution[];
  is_corresponding: boolean | null;
  raw_author_name: string;
};

/** A Topic as OpenAlex lists it on a work. */
export type OpenAlexTopic = {
  id: string;
  display_name: string;
  score: number;
  subfield: { display_name: string };
  field: { display_name: string };
  domain: { display_name: string };
};

/**
 * An OpenAlex work, as returned by the list or single-work endpoint. Only the
 * fields the mapper reads are typed; the rest is kept as-is in `raw`.
 */
export type OpenAlexWork = {
  id: string;
  doi: string | null;
  title: string | null;
  publication_date: string;
  publication_year: number;
  type: string;
  language: string | null;
  cited_by_count: number;
  ids?: { pmid?: string | null };
  primary_location: { source: { display_name: string } | null } | null;
  open_access: { is_oa: boolean; oa_status: string; oa_url: string | null };
  authorships: OpenAlexAuthorship[];
  primary_topic: { id: string } | null;
  topics: OpenAlexTopic[];
  abstract_inverted_index?: Record<string, number[]> | null;
  [key: string]: unknown;
};

/** The rows one work maps to, shaped like the Drizzle insert types. */
export type MappedWork = {
  publication: typeof publications.$inferInsert;
  authors: (typeof authors.$inferInsert)[];
  institutions: (typeof institutions.$inferInsert)[];
  authorships: (typeof authorships.$inferInsert)[];
  affiliations: (typeof affiliations.$inferInsert)[];
  topics: (typeof topics.$inferInsert)[];
  publicationTopics: (typeof publicationTopics.$inferInsert)[];
};

const OPENALEX_PREFIX = "https://openalex.org/";

/** "https://openalex.org/W123" → "W123". A short ID is returned unchanged. */
export function shortenId(url: string): string {
  return url.startsWith(OPENALEX_PREFIX)
    ? url.slice(OPENALEX_PREFIX.length)
    : url;
}

/**
 * Rebuilds abstract text from OpenAlex's inverted index (word → positions).
 * Null when the work has no abstract.
 */
export function rebuildAbstract(
  index: Record<string, number[]> | null | undefined,
): string | null {
  if (!index) return null;
  const words: string[] = [];
  for (const [word, positions] of Object.entries(index)) {
    for (const position of positions) words[position] = word;
  }
  return words.filter((word) => word !== undefined).join(" ");
}

export function mapWork(work: OpenAlexWork): MappedWork {
  const publicationId = shortenId(work.id);

  const publication: MappedWork["publication"] = {
    id: publicationId,
    doi: work.doi,
    title: work.title,
    abstract: rebuildAbstract(work.abstract_inverted_index),
    publicationDate: work.publication_date,
    publicationYear: work.publication_year,
    type: work.type,
    language: work.language,
    sourceName: work.primary_location?.source?.display_name ?? null,
    citedByCount: work.cited_by_count,
    isOa: work.open_access.is_oa,
    oaStatus: work.open_access.oa_status,
    oaUrl: work.open_access.oa_url,
    pmid: work.ids?.pmid ?? null,
    raw: work,
  };

  const authorsById = new Map<string, MappedWork["authors"][number]>();
  const institutionsById = new Map<
    string,
    MappedWork["institutions"][number]
  >();
  const authorshipRows: MappedWork["authorships"] = [];
  const affiliationRows: MappedWork["affiliations"] = [];

  work.authorships.forEach((authorship, position) => {
    // An unidentified Authorship keeps its place and Affiliations, but has
    // no Author (ADR-0004).
    const authorId =
      authorship.author.id === null ? null : shortenId(authorship.author.id);
    if (authorId !== null) {
      authorsById.set(authorId, {
        id: authorId,
        displayName: authorship.author.display_name,
        orcid: authorship.author.orcid,
      });
    }

    authorshipRows.push({
      publicationId,
      position,
      authorId,
      authorPosition: authorship.author_position,
      isCorresponding: authorship.is_corresponding ?? false,
      rawAuthorName: authorship.raw_author_name,
    });

    // An Institution listed twice on one Authorship is one Affiliation.
    const seen = new Set<string>();
    for (const institution of authorship.institutions) {
      const institutionId = shortenId(institution.id);
      institutionsById.set(institutionId, {
        id: institutionId,
        displayName: institution.display_name,
        countryCode: institution.country_code,
        ror: institution.ror,
        type: institution.type,
      });
      if (seen.has(institutionId)) continue;
      seen.add(institutionId);
      affiliationRows.push({ publicationId, position, institutionId });
    }
  });

  // Topics, not Concepts (ADR-0002): `concepts` stays only in `raw`.
  const primaryTopicId = work.primary_topic
    ? shortenId(work.primary_topic.id)
    : null;
  const topicRows: MappedWork["topics"] = work.topics.map((topic) => ({
    id: shortenId(topic.id),
    displayName: topic.display_name,
    subfield: topic.subfield.display_name,
    field: topic.field.display_name,
    domain: topic.domain.display_name,
  }));
  const publicationTopicRows: MappedWork["publicationTopics"] = topicRows.map(
    (topic, i) => ({
      publicationId,
      topicId: topic.id,
      score: work.topics[i].score,
      isPrimary: topic.id === primaryTopicId,
    }),
  );

  return {
    publication,
    authors: [...authorsById.values()],
    institutions: [...institutionsById.values()],
    authorships: authorshipRows,
    affiliations: affiliationRows,
    topics: topicRows,
    publicationTopics: publicationTopicRows,
  };
}
