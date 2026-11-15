"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import data from "./sample.json";
import {
  buildSearchView,
  defaultFilters,
  type Publication,
  type SearchFilters,
  type SortKey,
} from "./engine";
import { buildParams, parseFilters, toggleListValue } from "./query-state";
import { VariantA, VariantB, VariantC } from "./variants";
import { VariantD, VariantE, VariantF } from "./variants-round2";
import { buildPipeline, parseOrder, reconcileOrder, type StepKey } from "./pipeline";

const fixtureRecords = data as Publication[];

// Round 2 shows A (round-1 front-runner) next to D/E/F. B and C stay reachable by URL.
export const VARIANTS = ["A", "D", "E", "F"] as const;
const ALL_VARIANTS = ["A", "B", "C", "D", "E", "F"] as const;
type VariantKey = (typeof ALL_VARIANTS)[number];

const VARIANT_NAMES: Record<VariantKey, string> = {
  A: "Progressive filters (round 1)",
  B: "Sidebar catalog (round 1)",
  C: "Query sentence (round 1)",
  D: "Plan rail",
  E: "Step inspector",
  F: "EXPLAIN console",
};

function parseVariant(value: string | null): VariantKey {
  return (ALL_VARIANTS as readonly string[]).includes(value ?? "") ? (value as VariantKey) : "A";
}

export function SearchPrototypeClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const variant = parseVariant(searchParams.get("variant"));

  const filters = useMemo(() => parseFilters(new URLSearchParams(searchParams.toString())), [searchParams]);

  const view = useMemo(() => buildSearchView(fixtureRecords, filters), [filters]);
  const order = useMemo(() => reconcileOrder(parseOrder(searchParams.get("steps")), filters), [searchParams, filters]);
  const pipeline = useMemo(() => buildPipeline(fixtureRecords, filters, order), [filters, order]);

  function replaceFilters(nextFilters: SearchFilters, nextOrder: StepKey[] = order) {
    const base = new URLSearchParams(searchParams.toString());
    const nextParams = buildParams(base, nextFilters);
    nextParams.set("variant", variant);
    const steps = reconcileOrder(nextOrder, nextFilters);
    if (steps.length > 0) nextParams.set("steps", steps.join(","));
    else nextParams.delete("steps");
    router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
  }

  function patchFilters(patch: Partial<SearchFilters>) {
    replaceFilters({
      ...filters,
      ...patch,
      page: patch.page ?? 1,
    });
  }

  const variantProps = {
    filters,
    view,
    onSetTextFilter: (key: "q" | "author", value: string) => patchFilters({ [key]: value } as Partial<SearchFilters>),
    onSetFacetValues: (
      key: "topics" | "countries" | "institutions" | "oa",
      values: string[]
    ) => {
      patchFilters({
        [key]: values,
      } as Partial<SearchFilters>);
    },
    onToggleFacet: (
      key: "topics" | "countries" | "institutions" | "oa",
      value: string
    ) => {
      patchFilters({
        [key]: toggleListValue(filters[key], value),
      } as Partial<SearchFilters>);
    },
    onSetSort: (sort: SortKey) => patchFilters({ sort }),
    onSetPage: (page: number) => replaceFilters({ ...filters, page }),
    onClearAll: () => {
      const cleared = defaultFilters();
      replaceFilters({ ...cleared, sort: filters.sort });
    },
  };

  const pipelineProps = {
    ...variantProps,
    pipeline,
    onMoveStep: (key: StepKey, dir: -1 | 1) => {
      const i = order.indexOf(key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= order.length) return;
      const next = [...order];
      [next[i], next[j]] = [next[j]!, next[i]!];
      replaceFilters(filters, next);
    },
    onRemoveStep: (key: StepKey) =>
      patchFilters(key === "q" || key === "author" ? { [key]: "" } : ({ [key]: [] } as Partial<SearchFilters>)),
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      <header className="mb-6 space-y-1">
        <h1 className="text-2xl font-semibold">Search UI Prototype</h1>
        <p className="text-sm text-muted-foreground">
          Variant {variant}: {VARIANT_NAMES[variant]} · {view.total} matches from {fixtureRecords.length} OpenAlex records
        </p>
      </header>

      {variant === "A" ? <VariantA {...variantProps} /> : null}
      {variant === "B" ? <VariantB {...variantProps} /> : null}
      {variant === "C" ? <VariantC {...variantProps} /> : null}
      {variant === "D" ? <VariantD {...pipelineProps} /> : null}
      {variant === "E" ? <VariantE {...pipelineProps} /> : null}
      {variant === "F" ? <VariantF {...pipelineProps} /> : null}
    </div>
  );
}
