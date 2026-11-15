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

## Round 3 (2026-11-15): refining variant D

Feedback on round 2: D is the favourite. Keep its left column and its centered modal. Use
filter wording ("Filters", "Add filter") instead of plan/step/narrow. Drop the timeline look and the
percentage bars, but keep "how many it removes" and "how many are left". Use drag handles instead
of arrows. E's simpler, less cluttered look is preferred. Explore how OR is styled, what happens with
many values, NOT, and turning a filter off without deleting it.

The switcher shows D plus G, H and I. All three share one panel and differ only in the filter row:

| | G Quiet text | H Chip stack | I Sentence |
|---|---|---|---|
| OR | plain text, muted "or" | chips stacked under an OR bracket | natural sentence "A, B or 3 other topics" |
| Many values | first 3, then "or 9 more…" (opens modal) | first 4, then "Show all 12" inline | first 2, then "or 10 other topics" |
| NOT | click the dotted "is any of" text | "any of / none of" segmented control | click the verb: "is" becomes "is not", "or" becomes "nor" |
| Off | switch; row fades, values struck through | checkbox like a layers panel; dashed card | eye icon; sentence struck through |
| Counts | "−142 · 52 left · without it 194" | "194 → 142" | "Removes 142, 52 left. Without it: 194." |

Shared:
- Drag handles from `@dnd-kit/sortable`. They work with a pointer, and with the keyboard: Space, then arrows, then Space.
- NOT means "none of" (NOT (A OR B)). It sits in the URL as `not=topics,...`. The picker modal
  also has an "is any of / is none of" switch, staged like the picks, so closing applies both.
- Off filters keep their values but let everything through. They sit in the URL as `off=oa,...`.
  Every filter reports what the final result would be if it were flipped on or off.
- Elasticsearch mapping for later: NOT is a `bool.must_not`; an off filter is simply left out of the
  query, and its "would remove" count is one extra `filter` aggregation.

Verified with Playwright on G, H and I. NOT changes the results. Turning a filter off gives exactly
the count without it, and its values are kept. Keyboard dragging reorders without changing the result.
Picks and NOT in the picker stay a draft until the modal closes. No horizontal scroll at 390px, and
no console errors. Caught while building: H first put "NOT" on every chip under an OR bracket, which
reads as "not A or not B". That is the wrong logic, so the bracket now says "nor".

## Round 4 (2026-11-15): one converged row, three operator styles

Feedback on round 3:
- The Add filter list should show every value, not only those left after earlier filters.
- From G: the eye and delete buttons sit together at the right. The OR-joined values are the
  click target for editing. Negated values are red. But "is any of" did not look clickable.
- From H: the "any of / none of" control was more clickable, though its styling was uncertain. The
  "200 → 142" count was liked. The big OR bracket was not.
- From I: the eye icon was liked.
- Everywhere, the modal must match the filter row. Earlier, its "is any of" control looked different.

The switcher shows G plus J, K and L. They share one row and differ only in the operator control:
- J: segmented pill, active side raised, red outline when "is none of"
- K: dropdown with a chevron, red when "is none of"
- L: a single button with a swap icon, red when "is none of"

Shared in `filter-parts.tsx`: `OperatorControl` and `ValueList`. The row and the modal both render these,
so the modal header and its selection read exactly like the row. The modal list adds a remove button per value.

Picker lists: `optionsForStep` now returns every value in the whole set. Values with 0 at this filter
are greyed and sort last, for example 42 of the 91 countries after a Text and a Topic filter.

Verified with Playwright on J, K and L. The row control sets NOT. The modal operator shows the same
state as the row, and modal values are red and joined with "nor" like the row. The eye turns a filter off.
Add filter lists all 91 countries. No horizontal scroll at 390px, and no console errors.

## Round 5 (2026-11-15): search bar on J

Feedback: J is the best, but it needs a search bar.

- A full-width search bar sits above the filter column and results. It follows the same staged rule:
  typing shows a live "N of 200 match", Enter or the Search button applies, and Escape reverts.
- The search is the text filter (`q`). The panel shows it as a fixed first line, `Search “climate”` with
  `200 → 194` and a clear button. It has no drag handle, it stays first however other filters are dragged,
  and "Text" is gone from Add filter.
- Text search now also matches country names, as the brief requires (title, author or country).
  Before, "Kenya" found nothing; now it finds 7.

Verified with Playwright: typing does not search until Enter, Escape reverts, the search is pinned first
even when added after other filters or when they are dragged, Clear search also clears the box, there is
no horizontal scroll at 390px, and no console errors.
