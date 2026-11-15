// PROTOTYPE (round 2): ordered filter pipeline, EXPLAIN-style.
// Each active filter is a step. A step's input is the previous step's output,
// so counts narrow from "all publications" down to the final selection.
// AND is commutative, so the order only changes the intermediate counts,
// never the final result. Order = the order filters were added (URL `steps`).
//
// Elasticsearch equivalent for later: one `filter` aggregation per step whose
// filter is the AND of all earlier steps, with a `terms` sub-aggregation for
// that step's facet. That gives exactly the per-step option counts below.

import {
  matchesAuthor,
  matchesFacet,
  matchesQuery,
  parseCountryLabel,
  type FacetKey,
  type Publication,
  type SearchFilters,
} from "./engine";

export type StepKey = "q" | "author" | FacetKey;

export const STEP_KEYS: StepKey[] = ["q", "author", "topics", "countries", "institutions", "oa"];
export const FACET_KEYS: FacetKey[] = ["topics", "countries", "institutions", "oa"];

export const STEP_LABEL: Record<StepKey, string> = {
  q: "Text",
  author: "Author",
  topics: "Topic",
  countries: "Country",
  institutions: "Institution",
  oa: "Open access",
};

export const STEP_HINT: Record<StepKey, string> = {
  q: "Matches title, source, authors, topics and institutions.",
  author: "Author name contains the text.",
  topics: "Research topics OpenAlex assigns to each publication.",
  countries: "Country of any affiliated institution.",
  institutions: "Any affiliated institution.",
  oa: "Open access status: gold, green, hybrid, diamond, bronze, closed.",
};

export type PipelineStep = {
  key: StepKey;
  label: string;
  summary: string;
  values: string[];
  input: Publication[];
  output: Publication[];
};

export type Pipeline = {
  all: Publication[];
  steps: PipelineStep[];
  final: Publication[];
};

export type StepOption = {
  id: string;
  label: string;
  /** Publications reaching this step that have this value. */
  stepCount: number;
  /** Publications in the whole set that have this value. */
  totalCount: number;
};

export function isActive(filters: SearchFilters, key: StepKey): boolean {
  if (key === "q" || key === "author") {
    return filters[key].trim().length > 0;
  }
  return filters[key].length > 0;
}

/** Active steps in the remembered order; newly active steps go last. */
export function reconcileOrder(order: StepKey[], filters: SearchFilters): StepKey[] {
  const kept = order.filter((key, i) => STEP_KEYS.includes(key) && order.indexOf(key) === i && isActive(filters, key));
  const added = STEP_KEYS.filter((key) => isActive(filters, key) && !kept.includes(key));
  return [...kept, ...added];
}

export function parseOrder(raw: string | null): StepKey[] {
  if (!raw) return [];
  return raw.split(",").filter((part): part is StepKey => (STEP_KEYS as string[]).includes(part));
}

function predicate(key: StepKey, filters: SearchFilters): (record: Publication) => boolean {
  if (key === "q") return (record) => matchesQuery(record, filters.q);
  if (key === "author") return (record) => matchesAuthor(record, filters.author);
  return (record) => matchesFacet(record, filters, key);
}

function summaryFor(key: StepKey, filters: SearchFilters, all: Publication[]): string {
  if (key === "q" || key === "author") return `“${filters[key]}”`;
  const labels = filters[key].map((id) => labelFor(key, id, all));
  return labels.join(" or ");
}

export function buildPipeline(all: Publication[], filters: SearchFilters, order: StepKey[]): Pipeline {
  const steps: PipelineStep[] = [];
  let current = all;
  for (const key of reconcileOrder(order, filters)) {
    const test = predicate(key, filters);
    const output = current.filter(test);
    steps.push({
      key,
      label: STEP_LABEL[key],
      summary: summaryFor(key, filters, all),
      values: key === "q" || key === "author" ? [filters[key]] : filters[key],
      input: current,
      output,
    });
    current = output;
  }
  return { all, steps, final: current };
}

/** The rows that reach step `key` (or the end of the pipeline when adding a new step). */
export function inputFor(pipeline: Pipeline, key: StepKey): Publication[] {
  return pipeline.steps.find((step) => step.key === key)?.input ?? pipeline.final;
}

function valuesOf(key: FacetKey, record: Publication): Array<{ id: string; label: string }> {
  if (key === "topics") return record.topics.map((t) => ({ id: t.id, label: t.name }));
  if (key === "countries")
    return record.institutions.map((i) => ({ id: i.country, label: parseCountryLabel(i.country) }));
  if (key === "institutions") return record.institutions.map((i) => ({ id: i.id, label: i.name }));
  return [{ id: record.oaStatus, label: record.oaStatus }];
}

export function labelFor(key: StepKey, id: string, all: Publication[]): string {
  if (key === "q" || key === "author") return id;
  if (key === "countries") return parseCountryLabel(id);
  for (const record of all) {
    const hit = valuesOf(key, record).find((v) => v.id === id);
    if (hit) return hit.label;
  }
  return id;
}

function count(records: Publication[], key: FacetKey): Map<string, { label: string; n: number }> {
  const map = new Map<string, { label: string; n: number }>();
  for (const record of records) {
    const seen = new Set<string>();
    for (const value of valuesOf(key, record)) {
      if (!value.id || seen.has(value.id)) continue;
      seen.add(value.id);
      const hit = map.get(value.id);
      if (hit) hit.n += 1;
      else map.set(value.id, { label: value.label, n: 1 });
    }
  }
  return map;
}

/** Every value of `key` among the rows reaching that step, plus any selected value that no longer occurs. */
export function optionsForStep(pipeline: Pipeline, key: FacetKey, selected: string[]): StepOption[] {
  const stepCounts = count(inputFor(pipeline, key), key);
  const totals = count(pipeline.all, key);
  const ids = new Set([...stepCounts.keys(), ...selected]);
  return [...ids].map((id) => ({
    id,
    label: stepCounts.get(id)?.label ?? totals.get(id)?.label ?? labelFor(key, id, pipeline.all),
    stepCount: stepCounts.get(id)?.n ?? 0,
    totalCount: totals.get(id)?.n ?? 0,
  }));
}

/** How many rows a step would keep with a draft selection, given its input. */
export function previewKeep(input: Publication[], key: FacetKey, draft: string[]): number {
  if (draft.length === 0) return input.length;
  const probe = { [key]: draft } as unknown as SearchFilters;
  return input.filter((record) => matchesFacet(record, probe, key)).length;
}
