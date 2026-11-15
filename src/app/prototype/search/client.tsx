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

const fixtureRecords = data as Publication[];

type VariantKey = "A" | "B" | "C";

function parseVariant(value: string | null): VariantKey {
  if (value === "A" || value === "B" || value === "C") {
    return value;
  }

  return "A";
}

export function SearchPrototypeClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const variant = parseVariant(searchParams.get("variant"));

  const filters = useMemo(() => parseFilters(new URLSearchParams(searchParams.toString())), [searchParams]);

  const view = useMemo(() => buildSearchView(fixtureRecords, filters), [filters]);

  function replaceFilters(nextFilters: SearchFilters) {
    const base = new URLSearchParams(searchParams.toString());
    const nextParams = buildParams(base, nextFilters);
    nextParams.set("variant", variant);
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

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      <header className="mb-6 space-y-1">
        <h1 className="text-2xl font-semibold">Search UI Prototype</h1>
        <p className="text-sm text-muted-foreground">
          Variant {variant} · {view.total} matches from {fixtureRecords.length} OpenAlex records
        </p>
      </header>

      {variant === "A" ? <VariantA {...variantProps} /> : null}
      {variant === "B" ? <VariantB {...variantProps} /> : null}
      {variant === "C" ? <VariantC {...variantProps} /> : null}
    </div>
  );
}
