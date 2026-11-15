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
import { VariantG, VariantH, VariantI } from "./variants-round3";
import { buildPipeline, parseOrder, reconcileOrder, type StepKey } from "./pipeline";
import type { FacetKey } from "./engine";

const fixtureRecords = data as Publication[];

// Round 3 shows D (round-2 pick) next to G/H/I. Older variants stay reachable by URL.
export const VARIANTS = ["D", "G", "H", "I"] as const;
const ALL_VARIANTS = ["A", "B", "C", "D", "E", "F", "G", "H", "I"] as const;
type VariantKey = (typeof ALL_VARIANTS)[number];

const VARIANT_NAMES: Record<VariantKey, string> = {
  A: "Progressive filters (round 1)",
  B: "Sidebar catalog (round 1)",
  C: "Query sentence (round 1)",
  D: "Plan rail",
  E: "Step inspector",
  F: "EXPLAIN console",
  G: "Quiet text",
  H: "Chip stack",
  I: "Sentence",
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
  const negated = useMemo(() => new Set(parseOrder(searchParams.get("not"))), [searchParams]);
  const disabled = useMemo(() => new Set(parseOrder(searchParams.get("off"))), [searchParams]);
  const isRound3 = variant === "G" || variant === "H" || variant === "I";
  const pipeline = useMemo(
    () => buildPipeline(fixtureRecords, filters, order, isRound3 ? { negated, disabled } : {}),
    [filters, order, negated, disabled, isRound3]
  );

  function replaceFilters(
    nextFilters: SearchFilters,
    nextOrder: StepKey[] = order,
    flags: { not?: Set<StepKey>; off?: Set<StepKey> } = {}
  ) {
    const base = new URLSearchParams(searchParams.toString());
    const nextParams = buildParams(base, nextFilters);
    nextParams.set("variant", variant);
    const steps = reconcileOrder(nextOrder, nextFilters);
    if (steps.length > 0) nextParams.set("steps", steps.join(","));
    else nextParams.delete("steps");
    // NOT / off flags only survive for filters that are still active.
    for (const [name, set] of [["not", flags.not ?? negated], ["off", flags.off ?? disabled]] as const) {
      const kept = steps.filter((k) => set.has(k));
      if (kept.length > 0) nextParams.set(name, kept.join(","));
      else nextParams.delete(name);
    }
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

  const withFlag = (set: Set<StepKey>, key: StepKey, on: boolean) => {
    const next = new Set(set);
    if (on) next.add(key);
    else next.delete(key);
    return next;
  };

  const filterProps = {
    filters,
    pipeline,
    order,
    onSetText: variantProps.onSetTextFilter,
    onApplyFacet: (key: FacetKey, values: string[], neg: boolean) =>
      replaceFilters({ ...filters, [key]: values, page: 1 }, order, { not: withFlag(negated, key, neg) }),
    onSetNegated: (key: StepKey, neg: boolean) =>
      replaceFilters({ ...filters, page: 1 }, order, { not: withFlag(negated, key, neg) }),
    onSetDisabled: (key: StepKey, off: boolean) =>
      replaceFilters({ ...filters, page: 1 }, order, { off: withFlag(disabled, key, off) }),
    onSetOrder: (next: StepKey[]) => replaceFilters(filters, next),
    onRemove: pipelineProps.onRemoveStep,
    onClearAll: variantProps.onClearAll,
    onSetSort: variantProps.onSetSort,
    onSetPage: variantProps.onSetPage,
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      <header className="mb-6 space-y-1">
        <h1 className="text-2xl font-semibold">Search UI Prototype</h1>
        <p className="text-sm text-muted-foreground">
          Variant {variant}: {VARIANT_NAMES[variant]} · {isRound3 ? pipeline.final.length : view.total} matches from {fixtureRecords.length} OpenAlex records
        </p>
      </header>

      {variant === "A" ? <VariantA {...variantProps} /> : null}
      {variant === "B" ? <VariantB {...variantProps} /> : null}
      {variant === "C" ? <VariantC {...variantProps} /> : null}
      {variant === "D" ? <VariantD {...pipelineProps} /> : null}
      {variant === "E" ? <VariantE {...pipelineProps} /> : null}
      {variant === "F" ? <VariantF {...pipelineProps} /> : null}
      {variant === "G" ? <VariantG {...filterProps} /> : null}
      {variant === "H" ? <VariantH {...filterProps} /> : null}
      {variant === "I" ? <VariantI {...filterProps} /> : null}
    </div>
  );
}
