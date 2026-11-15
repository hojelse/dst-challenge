// Pure functions from the search state to Elasticsearch request bodies.
//
// The narrowing (ADR-0003): Search applies first, then each switched-on
// Filter in the user's order. Order never changes the result, only the
// per-Filter counts, so the query itself is a plain AND. The counts come
// from one `filter` aggregation per step, each repeating Search and the
// Filters up to that step, inside a `global` aggregation so they are not
// narrowed by the query.

import type {
  FilterKey,
  FilterState,
  SearchState,
} from "@/lib/search-params";

type Clause = Record<string, unknown>;

/** The index field each Filter matches on. */
export const FILTER_FIELD: Record<FilterKey, string> = {
  topics: "topic_ids",
  countries: "countries",
  institutions: "institution_ids",
  authors: "author_ids",
  oa: "oa_status",
};

const SEARCH_FIELDS = [
  "title^3",
  "authors.name^2",
  "institutions.name",
  "country_names",
  "topics.name",
  "abstract",
];

/**
 * Search: every word must match, each in any field. One clause per word,
 * because the fields use different analysers and a single cross-field query
 * would need all words within one analyser group.
 */
export function searchClause(q: string): Clause {
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length === 0) return { match_all: {} };
  return {
    bool: {
      must: words.map((word) => ({
        multi_match: { query: word, fields: SEARCH_FIELDS },
      })),
    },
  };
}

/** "Is any of" keeps Publications with at least one value; negated, none. */
export function filterClause(filter: FilterState): Clause {
  const terms = { terms: { [FILTER_FIELD[filter.key]]: filter.values } };
  return filter.negated ? { bool: { must_not: [terms] } } : terms;
}

const and = (search: Clause, filters: Clause[]): Clause => ({
  bool: { must: [search], filter: filters },
});

const SORT = {
  date: [{ publication_date: "desc" }, { id: "asc" }],
  citations: [{ cited_by_count: "desc" }, { id: "asc" }],
} as const;

export function buildSearchRequest(state: SearchState) {
  const search = searchClause(state.q);
  const on = state.filters.filter((f) => !f.off);

  // step_i counts Publications left after Filter i. A switched-off Filter
  // does not narrow, so its count equals the one before it.
  const steps: Record<string, Clause> = {
    search: { filter: search },
  };
  const applied: Clause[] = [];
  state.filters.forEach((filter, i) => {
    if (!filter.off) applied.push(filterClause(filter));
    steps[`step_${i}`] = { filter: and(search, [...applied]) };
  });

  return {
    from: (state.page - 1) * state.size,
    size: state.size,
    track_total_hits: true,
    _source: { excludes: ["abstract", "country_names"] },
    query: and(search, on.map(filterClause)),
    // Relevance without Search has nothing to rank by: newest first.
    sort:
      state.sort === "relevance"
        ? state.q
          ? [{ _score: "desc" }, { id: "asc" }]
          : SORT.date
        : SORT[state.sort],
    aggs: { all: { global: {}, aggs: steps } },
  };
}

/** Enough buckets for every value of any Filter in a 1,000-Publication index. */
const MAX_VALUES = 50_000;

/**
 * Counts for one Filter's picker. `here` counts the Publications reaching
 * that Filter: after Search and the switched-on Filters before it, or after
 * all of them when the Filter is not in use yet. `overall` counts the index.
 */
export function buildOptionsRequest(state: SearchState, key: FilterKey) {
  const position = state.filters.findIndex((f) => f.key === key);
  const before = position === -1 ? state.filters : state.filters.slice(0, position);
  const reaching = and(
    searchClause(state.q),
    before.filter((f) => !f.off).map(filterClause),
  );
  const values = { terms: { field: FILTER_FIELD[key], size: MAX_VALUES } };

  return {
    size: 0,
    aggs: {
      all: {
        global: {},
        aggs: {
          overall: values,
          here: { filter: reaching, aggs: { values } },
        },
      },
    },
  };
}
