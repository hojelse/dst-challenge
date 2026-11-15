# PROTOTYPE: search page UI (throwaway)

Three structurally different variants of the search page on this route, switchable via
`?variant=A|B|C` and a floating bottom bar. Decides round-3 questions Q1 (facet controls),
Q2 (explicit OR/AND), Q4 (layout) and Q5 (result card). Not production code.

Run: `pnpm dev`, open http://localhost:3000/prototype/search?variant=A

## Data
`sample.json`: 200 real OpenAlex records (first relevance page of the challenge query), trimmed to
id, doi, title, date, type, citations, isOa, oaStatus, source, authors[{id,name,inst[]}],
institutions[{id,name,country}], topics[{id,name,field,domain}]. Extremes: 100 authors and
98 institutions on one record, 235 topics, 91 countries. No abstracts (not needed for layout).

## Shared in-memory engine (engine.ts, to write)
- Filters: q, topics[], countries[], institutions[], oa[], author, sort, page (20/page).
- OR within a facet, AND across facets. Facet counts for facet F = records matching q and all
  facets except F (Elasticsearch post_filter semantics). Selected values always listed.
- Options: top 20 Topic/Institution by count, all Country and OA. Country names via
  `Intl.DisplayNames("en", {type:"region"})`. Danish institutions listed first.
- Sort: relevance = sample order, date desc, citations desc.

## Variants (each owns its whole layout; share only the engine and a Pagination component)
- A "Toolbar + popovers": one wrapping toolbar (search, 4 facet Popover+Command buttons with
  checkbox rows and counts, sort Select). Active-filters row: "Topic: X or Y" chip groups joined
  by "and", Clear all. Results as cards (title, type, date, 3 authors +N, Danish institutions +N,
  3 topic badges, OA badge, citations). Caption explaining counts in the popover header.
- B "Sidebar catalog": left column of always-visible checkbox lists with counts (Sheet on
  mobile), results right with a sentence summary "Showing N publications with Topic X or Y, and
  Country Denmark". Results as compact two-line rows.
- C "Query sentence": filters rendered as an editable sentence of pills ("where Topic is any of
  [X][Y] and Country is any of [DK] + Add filter"). Results as a dense table-like grid.

## API facts for this stack (verified from node_modules, 2026-11-15)
- Next 16: `searchParams` is a Promise (`await` in server page, `use()` in client). Wrap any
  client component using `useSearchParams` in `<Suspense>`. `router.replace(href, {scroll:false})`.
- shadcn here is Base UI based (`@base-ui/react` 1.9.0), not Radix: triggers take `render={<Button/>}`
  instead of `asChild`; `Checkbox` uses `checked`/`onCheckedChange(checked)`; `Select` takes
  `items` (Record<string, ReactNode>) with `value`/`onValueChange`; Tooltip needs `TooltipProvider`.
- cmdk 1.1.1 for Command (`CommandInput`, `CommandList`, `CommandEmpty`, `CommandGroup`, `CommandItem onSelect`).
- Switcher lives in `src/components/prototype-switcher.tsx`, hidden when NODE_ENV === "production".
