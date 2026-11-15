export const PAGE_SIZE = 20;

export type SortKey = "relevance" | "date" | "citations";

export type FacetOption = {
  id: string;
  label: string;
  count: number;
  selected: boolean;
};

export type Author = {
  id: string;
  name: string;
  inst: string[];
};

export type Institution = {
  id: string;
  name: string;
  country: string;
};

export type Topic = {
  id: string;
  name: string;
  field: string;
  domain: string;
};

export type Publication = {
  id: string;
  doi: string;
  title: string;
  date: string;
  type: string;
  citations: number;
  isOa: boolean;
  oaStatus: string;
  source: string;
  authors: Author[];
  institutions: Institution[];
  topics: Topic[];
};

export type SearchFilters = {
  q: string;
  topics: string[];
  countries: string[];
  institutions: string[];
  oa: string[];
  author: string;
  sort: SortKey;
  page: number;
};

export type SearchFacets = {
  topics: FacetOption[];
  countries: FacetOption[];
  institutions: FacetOption[];
  oa: FacetOption[];
};

export type SearchView = {
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
  records: Publication[];
  facets: SearchFacets;
  plan: ExplainPlanStep[];
};

export type ExplainPlanStep = {
  id: string;
  node: string;
  detail: string;
  active: boolean;
  inputRows: number;
  outputRows: number;
};

type FacetKey = keyof Pick<SearchFilters, "topics" | "countries" | "institutions" | "oa">;

type EnrichedRecord = {
  record: Publication;
  index: number;
};

const collator = new Intl.Collator("en", { sensitivity: "base" });
const countryDisplay = new Intl.DisplayNames(["en"], { type: "region" });

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function includesText(haystack: string, needle: string): boolean {
  if (!needle) {
    return true;
  }

  return normalize(haystack).includes(needle);
}

function matchesQuery(record: Publication, query: string): boolean {
  const q = normalize(query);

  if (!q) {
    return true;
  }

  if (includesText(record.title, q) || includesText(record.source, q)) {
    return true;
  }

  if (record.authors.some((author) => includesText(author.name, q))) {
    return true;
  }

  if (record.topics.some((topic) => includesText(topic.name, q))) {
    return true;
  }

  return record.institutions.some((institution) => includesText(institution.name, q));
}

function matchesAuthor(record: Publication, authorQuery: string): boolean {
  const q = normalize(authorQuery);
  if (!q) {
    return true;
  }

  return record.authors.some((author) => includesText(author.name, q));
}

function matchesFacet(record: Publication, filters: SearchFilters, facet: FacetKey): boolean {
  const selected = filters[facet];
  if (selected.length === 0) {
    return true;
  }

  if (facet === "topics") {
    const topicIds = new Set(record.topics.map((topic) => topic.id));
    return selected.some((id) => topicIds.has(id));
  }

  if (facet === "countries") {
    const countries = new Set(record.institutions.map((institution) => institution.country));
    return selected.some((code) => countries.has(code));
  }

  if (facet === "institutions") {
    const institutionIds = new Set(record.institutions.map((institution) => institution.id));
    return selected.some((id) => institutionIds.has(id));
  }

  return selected.includes(record.oaStatus);
}

function matchesRecord(record: Publication, filters: SearchFilters, ignoredFacet?: FacetKey): boolean {
  if (!matchesQuery(record, filters.q)) {
    return false;
  }

  if (!matchesAuthor(record, filters.author)) {
    return false;
  }

  const facets: FacetKey[] = ["topics", "countries", "institutions", "oa"];
  for (const facet of facets) {
    if (facet === ignoredFacet) {
      continue;
    }

    if (!matchesFacet(record, filters, facet)) {
      return false;
    }
  }

  return true;
}

function sortRecords(records: EnrichedRecord[], sort: SortKey): EnrichedRecord[] {
  const sorted = [...records];

  if (sort === "relevance") {
    sorted.sort((a, b) => a.index - b.index);
    return sorted;
  }

  if (sort === "date") {
    sorted.sort((a, b) => {
      const byDate = b.record.date.localeCompare(a.record.date);
      if (byDate !== 0) {
        return byDate;
      }

      return a.index - b.index;
    });
    return sorted;
  }

  sorted.sort((a, b) => {
    const byCitations = b.record.citations - a.record.citations;
    if (byCitations !== 0) {
      return byCitations;
    }

    return a.index - b.index;
  });

  return sorted;
}

function countBy<T extends { id: string; label: string }>(
  records: Publication[],
  valuesFromRecord: (record: Publication) => T[]
): Map<string, { id: string; label: string; count: number }> {
  const map = new Map<string, { id: string; label: string; count: number }>();

  for (const record of records) {
    const seen = new Set<string>();
    for (const value of valuesFromRecord(record)) {
      if (!value.id || seen.has(value.id)) {
        continue;
      }

      seen.add(value.id);
      const existing = map.get(value.id);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(value.id, { id: value.id, label: value.label, count: 1 });
      }
    }
  }

  return map;
}

function toFacetOptions(
  counted: Map<string, { id: string; label: string; count: number }>,
  selectedIds: string[],
  opts: {
    limit?: number;
    danishFirst?: boolean;
  } = {}
): FacetOption[] {
  const selectedSet = new Set(selectedIds);
  const all = [...counted.values()].sort((a, b) => {
    if (opts.danishFirst) {
      const aDanish = a.label.toLowerCase().includes("denmark") || a.label.toLowerCase().includes("danish");
      const bDanish = b.label.toLowerCase().includes("denmark") || b.label.toLowerCase().includes("danish");
      if (aDanish !== bDanish) {
        return aDanish ? -1 : 1;
      }
    }

    if (a.count !== b.count) {
      return b.count - a.count;
    }

    return collator.compare(a.label, b.label);
  });

  const limit = opts.limit ?? all.length;
  const picked = all.slice(0, limit);
  const pickedSet = new Set(picked.map((item) => item.id));

  for (const selectedId of selectedSet) {
    if (pickedSet.has(selectedId)) {
      continue;
    }

    const selectedItem = counted.get(selectedId);
    if (selectedItem) {
      picked.push(selectedItem);
    } else {
      picked.push({ id: selectedId, label: selectedId, count: 0 });
    }
  }

  return picked
    .map((item) => ({
      id: item.id,
      label: item.label,
      count: item.count,
      selected: selectedSet.has(item.id),
    }))
    .sort((a, b) => {
      if (a.selected !== b.selected) {
        return a.selected ? -1 : 1;
      }

      if (a.count !== b.count) {
        return b.count - a.count;
      }

      return collator.compare(a.label, b.label);
    });
}

function parseCountryLabel(code: string): string {
  if (!code) {
    return "Unknown";
  }

  return countryDisplay.of(code) ?? code;
}

function labelForSelection(
  selected: string[],
  options: FacetOption[]
): string {
  const optionMap = new Map(options.map((option) => [option.id, option.label]));
  const labels = selected.map((id) => optionMap.get(id) ?? id);
  return labels.join(" OR ");
}

function buildExplainPlan(
  records: Publication[],
  filters: SearchFilters,
  facets: SearchFacets,
  pageSize: number,
  page: number
): ExplainPlanStep[] {
  let current = [...records];

  const steps: ExplainPlanStep[] = [
    {
      id: "base",
      node: "Seq Scan",
      detail: "source: sample.json",
      active: true,
      inputRows: records.length,
      outputRows: records.length,
    },
  ];

  const filterSteps: Array<{
    id: string;
    node: string;
    active: boolean;
    detail: string;
    predicate: (record: Publication) => boolean;
  }> = [
    {
      id: "q",
      node: "Filter",
      active: Boolean(filters.q),
      detail: filters.q
        ? `q ~ '${filters.q}' (title|source|author|topic|institution)`
        : "q not set",
      predicate: (record) => matchesQuery(record, filters.q),
    },
    {
      id: "author",
      node: "Filter",
      active: Boolean(filters.author),
      detail: filters.author ? `author ~ '${filters.author}'` : "author not set",
      predicate: (record) => matchesAuthor(record, filters.author),
    },
    {
      id: "topics",
      node: "Filter",
      active: filters.topics.length > 0,
      detail:
        filters.topics.length > 0
          ? `topic IN (${labelForSelection(filters.topics, facets.topics)})`
          : "topics not set",
      predicate: (record) => matchesFacet(record, filters, "topics"),
    },
    {
      id: "countries",
      node: "Filter",
      active: filters.countries.length > 0,
      detail:
        filters.countries.length > 0
          ? `country IN (${labelForSelection(filters.countries, facets.countries)})`
          : "countries not set",
      predicate: (record) => matchesFacet(record, filters, "countries"),
    },
    {
      id: "institutions",
      node: "Filter",
      active: filters.institutions.length > 0,
      detail:
        filters.institutions.length > 0
          ? `institution IN (${labelForSelection(filters.institutions, facets.institutions)})`
          : "institutions not set",
      predicate: (record) => matchesFacet(record, filters, "institutions"),
    },
    {
      id: "oa",
      node: "Filter",
      active: filters.oa.length > 0,
      detail:
        filters.oa.length > 0
          ? `oa_status IN (${labelForSelection(filters.oa, facets.oa)})`
          : "oa not set",
      predicate: (record) => matchesFacet(record, filters, "oa"),
    },
  ];

  for (const step of filterSteps) {
    const inputRows = current.length;
    if (step.active) {
      current = current.filter(step.predicate);
    }

    steps.push({
      id: step.id,
      node: step.node,
      detail: step.detail,
      active: step.active,
      inputRows,
      outputRows: current.length,
    });
  }

  steps.push({
    id: "sort",
    node: "Sort",
    detail: `by ${filters.sort}`,
    active: true,
    inputRows: current.length,
    outputRows: current.length,
  });

  const offset = (page - 1) * pageSize;
  const outputRows = Math.max(0, Math.min(pageSize, current.length - offset));

  steps.push({
    id: "limit",
    node: "Limit",
    detail: `page ${page}, size ${pageSize}`,
    active: true,
    inputRows: current.length,
    outputRows,
  });

  return steps;
}

function buildFacetOptions(allRecords: Publication[], filters: SearchFilters): SearchFacets {
  const topicBase = allRecords.filter((record) => matchesRecord(record, filters, "topics"));
  const countryBase = allRecords.filter((record) => matchesRecord(record, filters, "countries"));
  const institutionBase = allRecords.filter((record) => matchesRecord(record, filters, "institutions"));
  const oaBase = allRecords.filter((record) => matchesRecord(record, filters, "oa"));

  const topicCounts = countBy(topicBase, (record) =>
    record.topics.map((topic) => ({ id: topic.id, label: topic.name }))
  );

  const countryCounts = countBy(countryBase, (record) =>
    record.institutions.map((institution) => ({
      id: institution.country,
      label: parseCountryLabel(institution.country),
    }))
  );

  const institutionCounts = countBy(institutionBase, (record) =>
    record.institutions.map((institution) => ({ id: institution.id, label: institution.name }))
  );

  const oaCounts = countBy(oaBase, (record) => [{ id: record.oaStatus, label: record.oaStatus }]);

  return {
    topics: toFacetOptions(topicCounts, filters.topics, { limit: 20 }),
    countries: toFacetOptions(countryCounts, filters.countries)
      .sort((a, b) => collator.compare(a.label, b.label)),
    institutions: toFacetOptions(institutionCounts, filters.institutions, {
      limit: 20,
      danishFirst: true,
    }),
    oa: toFacetOptions(oaCounts, filters.oa),
  };
}

export function defaultFilters(): SearchFilters {
  return {
    q: "",
    topics: [],
    countries: [],
    institutions: [],
    oa: [],
    author: "",
    sort: "relevance",
    page: 1,
  };
}

export function normalizeFilters(filters: SearchFilters): SearchFilters {
  return {
    ...filters,
    q: filters.q.trim(),
    author: filters.author.trim(),
    page: Number.isFinite(filters.page) ? Math.max(1, Math.floor(filters.page)) : 1,
  };
}

export function buildSearchView(records: Publication[], rawFilters: SearchFilters): SearchView {
  const filters = normalizeFilters(rawFilters);

  const enriched: EnrichedRecord[] = records
    .map((record, index) => ({ record, index }))
    .filter((entry) => matchesRecord(entry.record, filters));

  const sorted = sortRecords(enriched, filters.sort);

  const total = sorted.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);

  const start = (page - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;

  const resultRecords = sorted.slice(start, end).map((entry) => entry.record);
  const facets = buildFacetOptions(records, { ...filters, page });

  return {
    total,
    page,
    pageCount,
    pageSize: PAGE_SIZE,
    records: resultRecords,
    facets,
    plan: buildExplainPlan(records, { ...filters, page }, facets, PAGE_SIZE, page),
  };
}
