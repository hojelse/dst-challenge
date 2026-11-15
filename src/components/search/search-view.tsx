"use client";

// The interactive search page. All state lives in the URL: every change
// replaces the URL, and the Server Component re-renders with new results.

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toSearchParams, type SearchState } from "@/lib/search-params";
import type { SearchResult } from "@/server/search/service";
import { FilterPanel } from "./filter-panel";
import { Pagination } from "./pagination";
import { ResultsTable } from "./results-table";
import { SearchBar } from "./search-bar";

export function SearchView({
  state,
  result,
}: {
  state: SearchState;
  result: SearchResult;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function navigate(next: SearchState) {
    const query = toSearchParams(next).toString();
    startTransition(() => {
      router.replace(query ? `/?${query}` : "/", { scroll: false });
    });
  }

  /** Any change to what is searched for goes back to the first page. */
  const change = (patch: Partial<SearchState>) =>
    navigate({ ...state, page: 1, ...patch });

  const pageCount = Math.max(1, Math.ceil(result.total / state.size));
  const query = toSearchParams(state).toString();

  return (
    <div className="space-y-3">
      <h1 className="sr-only">Search publications</h1>
      <SearchBar
        applied={state.q}
        all={result.all}
        onApply={(q) => change({ q })}
      />
      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <aside className="lg:sticky lg:top-4 lg:self-start" aria-label="Filters">
          <FilterPanel state={state} result={result} onChange={change} />
        </aside>
        <section
          id="results"
          aria-label="Results"
          aria-busy={pending}
          className={`min-w-0 scroll-mt-4 space-y-3 transition-opacity ${pending ? "opacity-60" : ""}`}
        >
          <ResultsTable
            items={result.items}
            sort={state.sort}
            onSetSort={(sort) => change({ sort })}
            caption={`${result.total} publications · page ${state.page} of ${pageCount}`}
            detailQuery={query ? `?from=${encodeURIComponent(query)}` : ""}
            empty={
              result.total === 0 ? (
                <div className="space-y-3">
                  <p className="text-muted-foreground">
                    No publications match the search and every filter.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => change({ q: "", filters: [] })}
                  >
                    Clear filters
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-muted-foreground">
                    There is no page {state.page}.
                  </p>
                  <Button variant="outline" onClick={() => change({})}>
                    Go to the first page
                  </Button>
                </div>
              )
            }
          />
          <Pagination
            page={state.page}
            pageCount={pageCount}
            onPageChange={(page) => {
              navigate({ ...state, page });
              document.getElementById("results")?.scrollIntoView();
            }}
          />
        </section>
      </div>
    </div>
  );
}
