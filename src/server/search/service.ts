// Runs the search against Elasticsearch and shapes the response for the
// search page and GET /api/publications.

import { inArray } from "drizzle-orm";
import { countryName } from "@/lib/countries";
import type { FilterKey, FilterState, SearchState } from "@/lib/search-params";
import { db } from "@/server/db";
import { authors, institutions, topics } from "@/server/db/schema";
import type { SearchDocument } from "./document";
import { elasticsearch, indexName } from "./elasticsearch";
import { buildOptionsRequest, buildSearchRequest } from "./query";

export type PublicationSummary = Omit<
  SearchDocument,
  "abstract" | "country_names"
>;

export type FilterValue = { id: string; label: string };

export type FilterResult = Omit<FilterState, "values"> & {
  values: FilterValue[];
  /** Publications reaching this Filter, and left after it. */
  input: number;
  output: number;
};

export type SearchResult = {
  /** Publications in the index. */
  all: number;
  /** Publications after Search and every switched-on Filter. */
  total: number;
  page: number;
  size: number;
  search: { q: string; input: number; output: number } | null;
  filters: FilterResult[];
  items: PublicationSummary[];
};

export type FilterOption = FilterValue & { here: number; overall: number };

const LABEL_TABLE = { topics, institutions, authors } as const;

/**
 * Display names for Filter values. Topics, Institutions and Authors are
 * looked up in Postgres; a Country is named from its code, and an Open
 * access status is its own label.
 */
async function labelsFor(
  key: FilterKey,
  ids: string[],
): Promise<Map<string, string>> {
  if (key === "oa") return new Map(ids.map((id) => [id, id]));
  if (key === "countries") {
    return new Map(ids.map((id) => [id, countryName(id)]));
  }
  if (ids.length === 0) return new Map();
  const table = LABEL_TABLE[key];
  const rows = await db
    .select({ id: table.id, label: table.displayName })
    .from(table)
    .where(inArray(table.id, ids));
  return new Map(rows.map((row) => [row.id, row.label]));
}

type Counted = { doc_count: number };
type SearchResponse = {
  hits: { total: { value: number }; hits: { _source: PublicationSummary }[] };
  aggregations: { all: Counted & Record<string, Counted> };
};

export async function searchPublications(
  state: SearchState,
): Promise<SearchResult> {
  const [response, labels] = await Promise.all([
    elasticsearch<SearchResponse>(
      "POST",
      `/${indexName()}/_search`,
      buildSearchRequest(state),
    ),
    Promise.all(state.filters.map((f) => labelsFor(f.key, f.values))),
  ]);

  const { all } = response.aggregations;
  const afterSearch = all.search.doc_count;

  return {
    all: all.doc_count,
    total: response.hits.total.value,
    page: state.page,
    size: state.size,
    search: state.q
      ? { q: state.q, input: all.doc_count, output: afterSearch }
      : null,
    filters: state.filters.map((filter, i) => ({
      ...filter,
      values: filter.values.map((id) => ({
        id,
        label: labels[i].get(id) ?? id,
      })),
      input: i === 0 ? afterSearch : all[`step_${i - 1}`].doc_count,
      output: all[`step_${i}`].doc_count,
    })),
    items: response.hits.hits.map((hit) => hit._source),
  };
}

type Buckets = { buckets: { key: string; doc_count: number }[] };
type OptionsResponse = {
  aggregations: { all: { overall: Buckets; here: { values: Buckets } } };
};

/** Every value of one Filter in the index, with its counts, for the picker. */
export async function filterOptions(
  state: SearchState,
  key: FilterKey,
): Promise<FilterOption[]> {
  const response = await elasticsearch<OptionsResponse>(
    "POST",
    `/${indexName()}/_search`,
    buildOptionsRequest(state, key),
  );
  const { overall, here } = response.aggregations.all;
  const hereCount = new Map(
    here.values.buckets.map((bucket) => [bucket.key, bucket.doc_count]),
  );
  const labels = await labelsFor(
    key,
    overall.buckets.map((bucket) => bucket.key),
  );
  return overall.buckets.map((bucket) => ({
    id: bucket.key,
    label: labels.get(bucket.key) ?? bucket.key,
    here: hereCount.get(bucket.key) ?? 0,
    overall: bucket.doc_count,
  }));
}
