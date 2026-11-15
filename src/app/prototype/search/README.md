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

## Round 2 (2026-11-15): EXPLAIN-style narrowing, picks apply on close, TanStack Table

Findings from round 1 (variant A): an order of operations that narrows from all publications
down to the selection, with a count per operation (like Postgres EXPLAIN), reads well. Picking
values in a modal should only take effect when the modal closes.

Switcher now shows A (round-1 baseline) plus three new variants. B and C remain reachable by URL.

| Variant | Layout | Picker | Results |
|---|---|---|---|
| D Plan rail | Vertical top-down funnel in a sidebar, bar per step shows rows in and out | Dialog with a TanStack table of values | TanStack table: Date/Citations header sort, column toggle, expandable rows |
| E Step inspector | Horizontal pipeline; click any step to see rows *at that point*, kept or dropped there | Right-hand Sheet, same table | Card list, local paging |
| F EXPLAIN console | Literal bottom-up `EXPLAIN ANALYZE` text, `rows=` and `removed=` per Filter line | Inline editor under the line, applies on Done | Dense TanStack table |

Shared mechanics:
- `pipeline.ts`: active filters are ordered steps (URL `steps=q,topics,...`, order of adding;
  reorder with arrows). A step's input is the previous step's output. Final result is order-independent.
- Picker values are counted against the rows *reaching that step* ("At this step") and overall.
- Staged edits everywhere: picker ticks are a draft with a live "keeps N of M" preview. Closing the
  modal by any route (Done, X, Escape, backdrop) applies; only "Discard changes" does not.
  Text steps follow the same rule: Enter or blur applies, Escape reverts.
- Elasticsearch mapping for later: one `filter` aggregation per step (AND of earlier steps) with a
  `terms` sub-aggregation for that step's facet.

Observations while building:
- A Country=Denmark step never removes anything: every record is in scope because of a Danish
  institution. Country is only useful for *other* countries.
- 7 of 200 records have no source; the engine now treats null text fields as empty (it crashed on any text query).
- The app font falls back to a serif: `globals.css` defines `--font-sans: var(--font-sans)`. Not fixed here.
- TanStack Table is v9 (`useTable`, `tableFeatures`, `table.FlexRender`), not the v8 `useReactTable` API.

Verified with a Playwright script against the dev server: all variants render empty and filtered with
no console errors; picker draft does not touch the URL until close; Discard leaves it unchanged;
reordering keeps the final count; header sort round-trips to relevance; no horizontal scroll at 390px.
