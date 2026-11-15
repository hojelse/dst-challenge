// The Elasticsearch document for one Publication, and the index mapping.
// The index is a projection of Postgres (ADR-0001): flat, denormalised, and
// rebuilt from scratch by `pnpm index`.

import { countryName } from "@/lib/countries";
import type { PublicationRecord } from "@/server/publications/read";

export type SearchDocument = {
  id: string;
  title: string | null;
  abstract: string | null;
  publication_date: string;
  publication_year: number;
  type: string;
  cited_by_count: number;
  is_oa: boolean;
  oa_status: string;
  source_name: string | null;
  doi: string | null;
  /** In author-list order. `id` is null for an unidentified Authorship. */
  authors: { id: string | null; name: string }[];
  /** Authors only: unidentified Authorships have no ID (ADR-0004). */
  author_ids: string[];
  author_count: number;
  /** Distinct Institutions, Danish ones first. */
  institutions: { id: string; name: string; country_code: string | null }[];
  institution_ids: string[];
  institution_count: number;
  /** Distinct Country codes, and their English names for Search. */
  countries: string[];
  country_names: string[];
  topics: { id: string; name: string; field: string; domain: string }[];
  topic_ids: string[];
};

export function buildDocument(publication: PublicationRecord): SearchDocument {
  const institutions = new Map<string, SearchDocument["institutions"][number]>();
  for (const authorship of publication.authorships) {
    for (const institution of authorship.affiliations) {
      institutions.set(institution.id, {
        id: institution.id,
        name: institution.name,
        country_code: institution.countryCode,
      });
    }
  }
  const danishFirst = [...institutions.values()].sort(
    (a, b) => Number(b.country_code === "DK") - Number(a.country_code === "DK"),
  );
  const countries = [
    ...new Set(danishFirst.flatMap((i) => i.country_code ?? [])),
  ];
  const authorIds = publication.authorships.flatMap((a) => a.authorId ?? []);

  return {
    id: publication.id,
    title: publication.title,
    abstract: publication.abstract,
    publication_date: publication.publicationDate,
    publication_year: publication.publicationYear,
    type: publication.type,
    cited_by_count: publication.citedByCount,
    is_oa: publication.isOa,
    oa_status: publication.oaStatus,
    source_name: publication.sourceName,
    doi: publication.doi,
    authors: publication.authorships.map((a) => ({
      id: a.authorId,
      name: a.name,
    })),
    author_ids: [...new Set(authorIds)],
    author_count: publication.authorships.length,
    institutions: danishFirst,
    institution_ids: danishFirst.map((i) => i.id),
    institution_count: danishFirst.length,
    countries,
    country_names: countries.map(countryName),
    topics: publication.topics.map(({ id, name, field, domain }) => ({
      id,
      name,
      field,
      domain,
    })),
    topic_ids: publication.topics.map((t) => t.id),
  };
}

const keyword = { type: "keyword" } as const;
/** Names: analysed for Search, with an exact `.keyword` subfield. */
const name = { type: "text", fields: { keyword } } as const;

export const INDEX_MAPPING = {
  dynamic: "strict",
  properties: {
    id: keyword,
    title: { type: "text", analyzer: "english" },
    abstract: { type: "text", analyzer: "english" },
    publication_date: { type: "date" },
    publication_year: { type: "integer" },
    type: keyword,
    cited_by_count: { type: "integer" },
    is_oa: { type: "boolean" },
    oa_status: keyword,
    source_name: name,
    doi: keyword,
    authors: { properties: { id: keyword, name } },
    author_ids: keyword,
    author_count: { type: "integer" },
    institutions: {
      properties: { id: keyword, name, country_code: keyword },
    },
    institution_ids: keyword,
    institution_count: { type: "integer" },
    countries: keyword,
    country_names: name,
    topics: {
      properties: { id: keyword, name, field: keyword, domain: keyword },
    },
    topic_ids: keyword,
  },
} as const;
