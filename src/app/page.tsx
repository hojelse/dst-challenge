import { Suspense } from "react";
import { SearchSkeleton } from "@/components/search/search-skeleton";
import { SearchView } from "@/components/search/search-view";
import { parseSearchState } from "@/lib/search-params";
import { searchPublications } from "@/server/search/service";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** The search page. The URL is the whole state, so any URL can be reloaded. */
export default function Home({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<SearchSkeleton />}>
      <Search searchParams={searchParams} />
    </Suspense>
  );
}

async function Search({ searchParams }: { searchParams: SearchParams }) {
  const state = parseSearchState(await searchParams);
  const result = await searchPublications(state);
  return <SearchView state={state} result={result} />;
}
