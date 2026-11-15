// The search state as it travels in a URL. The search page and
// GET /api/publications use the same parameter names, so the page can
// forward its own query string unchanged. No server imports: the client
// components use this module too.

export const FILTER_KEYS = [
  "topics",
  "countries",
  "institutions",
  "authors",
  "oa",
] as const;

export type FilterKey = (typeof FILTER_KEYS)[number];

export const FILTER_LABEL: Record<FilterKey, string> = {
  topics: "Topic",
  countries: "Country",
  institutions: "Institution",
  authors: "Author",
  oa: "Open access status",
};

export const FILTER_HINT: Record<FilterKey, string> = {
  topics: "Research topics OpenAlex assigns to each publication.",
  countries: "Country of any affiliated institution.",
  institutions: "Any affiliated institution.",
  authors: "Any author OpenAlex has identified.",
  oa: "Gold, green, hybrid, diamond, bronze or closed.",
};

export const SORTS = ["relevance", "date", "citations"] as const;
export type Sort = (typeof SORTS)[number];

export const DEFAULT_SIZE = 20;
export const MAX_SIZE = 100;

/** One Filter (ADR-0003): its values, whether it is negated, whether it is off. */
export type FilterState = {
  key: FilterKey;
  values: string[];
  negated: boolean;
  off: boolean;
};

export type SearchState = {
  q: string;
  /** In the user's order. A Filter without values is never listed. */
  filters: FilterState[];
  sort: Sort;
  page: number;
  size: number;
};

type RawParams =
  | URLSearchParams
  | Record<string, string | string[] | undefined>;

function reader(raw: RawParams) {
  return (name: string): string => {
    const value =
      raw instanceof URLSearchParams ? raw.get(name) : raw[name];
    return (Array.isArray(value) ? value[0] : value) ?? "";
  };
}

function list(value: string): string[] {
  return [
    ...new Set(
      value
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean),
    ),
  ];
}

const isFilterKey = (key: string): key is FilterKey =>
  (FILTER_KEYS as readonly string[]).includes(key);

/**
 * Reads the search state from URL parameters. Lenient by design: an unknown
 * key or an out-of-range number falls back to its default instead of failing,
 * so a hand-edited URL still shows a page.
 */
export function parseSearchState(raw: RawParams): SearchState {
  const get = reader(raw);

  const values = new Map<FilterKey, string[]>();
  for (const key of FILTER_KEYS) {
    const picked = list(get(key));
    if (picked.length > 0) values.set(key, picked);
  }

  // Filters named in `order` come first; any other Filter with values goes last.
  const ordered = list(get("order")).filter(isFilterKey);
  const keys = [
    ...ordered.filter((key) => values.has(key)),
    ...FILTER_KEYS.filter((key) => values.has(key) && !ordered.includes(key)),
  ];
  const negated = new Set(list(get("not")));
  const off = new Set(list(get("off")));

  const sort = get("sort");
  const page = Math.floor(Number(get("page") || 1));
  const size = Math.floor(Number(get("size") || DEFAULT_SIZE));

  return {
    q: get("q").trim(),
    filters: keys.map((key) => ({
      key,
      values: values.get(key)!,
      negated: negated.has(key),
      off: off.has(key),
    })),
    sort: (SORTS as readonly string[]).includes(sort)
      ? (sort as Sort)
      : "relevance",
    page: Number.isFinite(page) && page >= 1 ? page : 1,
    size:
      Number.isFinite(size) && size >= 0 && size <= MAX_SIZE
        ? size
        : DEFAULT_SIZE,
  };
}

/** The inverse of parseSearchState. Defaults are left out of the URL. */
export function toSearchParams(state: SearchState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.q) params.set("q", state.q);
  for (const filter of state.filters) {
    params.set(filter.key, filter.values.join(","));
  }
  const join = (keys: FilterKey[]) => keys.join(",");
  if (state.filters.length > 1) {
    params.set("order", join(state.filters.map((f) => f.key)));
  }
  const negated = state.filters.filter((f) => f.negated).map((f) => f.key);
  if (negated.length > 0) params.set("not", join(negated));
  const off = state.filters.filter((f) => f.off).map((f) => f.key);
  if (off.length > 0) params.set("off", join(off));
  if (state.sort !== "relevance") params.set("sort", state.sort);
  if (state.page > 1) params.set("page", String(state.page));
  if (state.size !== DEFAULT_SIZE) params.set("size", String(state.size));
  return params;
}
