import { defaultFilters, type SearchFilters, type SortKey } from "./engine";

function readList(value: string | null): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function writeList(items: string[]): string | null {
  if (items.length === 0) {
    return null;
  }

  return items.join(",");
}

function parseSort(raw: string | null): SortKey {
  if (raw === "date" || raw === "citations" || raw === "relevance") {
    return raw;
  }

  return "relevance";
}

export function parseFilters(params: URLSearchParams): SearchFilters {
  const defaults = defaultFilters();
  const pageRaw = Number(params.get("page") ?? "1");

  return {
    ...defaults,
    q: params.get("q") ?? defaults.q,
    topics: readList(params.get("topics")),
    countries: readList(params.get("countries")),
    institutions: readList(params.get("institutions")),
    oa: readList(params.get("oa")),
    author: params.get("author") ?? defaults.author,
    sort: parseSort(params.get("sort")),
    page: Number.isFinite(pageRaw) ? Math.max(1, Math.floor(pageRaw)) : 1,
  };
}

export function buildParams(base: URLSearchParams, filters: SearchFilters): URLSearchParams {
  const next = new URLSearchParams(base.toString());

  const entries: Array<[string, string | null]> = [
    ["q", filters.q || null],
    ["topics", writeList(filters.topics)],
    ["countries", writeList(filters.countries)],
    ["institutions", writeList(filters.institutions)],
    ["oa", writeList(filters.oa)],
    ["author", filters.author || null],
    ["sort", filters.sort === "relevance" ? null : filters.sort],
    ["page", filters.page <= 1 ? null : String(filters.page)],
  ];

  for (const [key, value] of entries) {
    if (!value) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
  }

  return next;
}

export function toggleListValue(list: string[], value: string): string[] {
  if (list.includes(value)) {
    return list.filter((item) => item !== value);
  }

  return [...list, value];
}
