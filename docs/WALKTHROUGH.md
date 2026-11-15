# Walkthrough

A guided tour of the solution: what happens to a publication on its way from
OpenAlex to the screen, why each part is the way it is, and what could be
asked about it. Read it top to bottom with the app open; it takes about half
an hour. Words such as Publication, Authorship and Filter are defined in
`GLOSSARY.md`.

## The one-minute version

1. A script downloads 1,000 works from OpenAlex and saves the raw JSON to disk.
2. A second script turns each work into rows in seven Postgres tables.
3. A third script reads Postgres and writes one flat document per Publication
   into Elasticsearch.
4. A Next.js app shows three pages. The search page asks Elasticsearch. The
   detail page and the insights page ask Postgres.

Each step only reads from the step before it, and each can be run again
without harm.

## Step 1: harvest (`pnpm harvest`)

Files: `scripts/harvest.ts`, `src/server/openalex/client.ts`, `cache.ts`.

The client requests the challenge query 200 works at a time, five times, and
writes each response to `data/raw/page-N.json`. Nothing else happens here: no
parsing, no database.

**Why cache raw responses on disk?** It separates "talking to someone else's
API" from "getting our data model right". When the mapping changes, we re-run
the load from disk in seconds, without asking OpenAlex again.

Two things about OpenAlex that were found by checking, not by reading docs:

- The list endpoint silently cuts every author list at 100. One work shows 100
  authors in the list and 241 when fetched alone. So any work with exactly 100
  authors is fetched again from the single-work endpoint (6 of the 1,000).
- Paging by cursor past the first page needs an API key. Without a key the
  client pages by number, which is fine for five pages.

## Step 2: load into Postgres (`pnpm load`)

Files: `src/server/openalex/mapper.ts` (pure), `load.ts`,
`src/server/db/schema.ts`.

`mapWork` is a pure function: one raw work in, rows for every table out. It
has no database connection, which is why it can be tested with 40-odd unit
tests on five real works. `loadWorks` takes those rows and writes one page per
transaction.

The tables:

```text
publications ──< authorships >── authors
                     │
                     └──< affiliations >── institutions (country_code)
publications ──< publication_topics >── topics
```

- An **Authorship** is one line of a Publication's author list.
- An **Affiliation** hangs off the Authorship, not the Author, because the
  same person lists different institutions on different papers.
- A **Country** is a column on the Institution. Authors and Publications have
  countries only through Affiliations.
- `publications.raw` keeps the whole original JSON, so a field we did not map
  can be added later without harvesting again.

**The surprise (ADR-0004):** about a quarter of Publications list someone
OpenAlex could not match to an author record (`author.id` is null), 631
author-list entries in all. The first plan was to skip them. Checking showed
that for about 5% of Publications such a person holds the only Danish
affiliation, which is the very reason the Publication is in the result. So
they are kept as Authorships with no Author. They show by their printed name
and count towards Institution and Country, but not as Authors.

**Idempotent** means running it twice gives the same rows: entities are
upserted, and a Publication's Authorships are deleted and re-inserted.

## Step 3: build the index (`pnpm index`)

Files: `src/server/publications/read.ts`, `src/server/search/document.ts`,
`build-index.ts`.

`readPublications` gathers each Publication with its Authorships,
Affiliations and Topics using four queries and stitches them together in
memory. `buildDocument` (pure, unit-tested) flattens one into a search
document. `rebuildIndex` deletes the index, creates it with an explicit
mapping, and bulk-inserts 200 documents at a time.

The document holds each thing twice, for two different jobs:

| Field | Type | Job |
| --- | --- | --- |
| `title`, `abstract` | text, English analyser | Search ("melting" finds "melt") |
| `authors.name`, `institutions.name`, `topics.name`, `country_names` | text | Search by name |
| `author_ids`, `institution_ids`, `topic_ids`, `countries`, `oa_status` | keyword | Filters and counts: exact match only |

`country_names` exists because the brief asks for search by country, and
nobody types "KE". It holds "Kenya".

**Why two stores for 1,000 rows? (ADR-0001)** Honestly, Postgres alone could
do it at this size. The brief prefers Elasticsearch and requires a database,
so each gets the job it is good at: Postgres holds the truth in normalised
form and answers relational questions (the insights are plain SQL);
Elasticsearch does relevance-ranked text search and fast counting. The rule
that keeps this safe is that Elasticsearch is never written to by anything
except the rebuild, so the two cannot drift apart in ways that matter.

**Why delete and rebuild instead of updating?** Simplicity. At 1,000
documents it takes about a second. The cost is a brief moment with no index;
an alias swap would remove that (listed under Ideas in the README).

## Step 4: search

Files: `src/lib/search-params.ts`, `src/server/search/query.ts` (pure),
`service.ts`.

### The state is the URL

`parseSearchState` turns a query string into a `SearchState`: search text,
a list of Filters in order (each with values, `negated`, `off`), sort, page.
`toSearchParams` does the reverse. Both the page and the API use them, so
there is exactly one definition of what a URL means.

```text
/?q=climate&countries=DE&oa=gold&order=countries,oa&not=oa
```

### One request, all the numbers

This is the heart of the backend, and the part that serves the UI design
(ADR-0003). `buildSearchRequest` produces one Elasticsearch request with two
halves:

- **`query`**: Search AND every switched-on Filter. This gives the page of
  results and the total. Because it is a plain AND, Filter order cannot change
  the result.
- **`aggs`**: one `filter` aggregation per step. Step 0 counts "Search AND
  Filter 0", step 1 counts "Search AND Filter 0 AND Filter 1", and so on.
  These give the "925 → 194" numbers. They sit inside a `global` aggregation,
  which means "count over the whole index, ignoring the query".

A Filter's input is the previous step's count; its output is its own. A
switched-off Filter gets the same count as the step before it.

A Filter clause is a `terms` query ("has at least one of these values"),
wrapped in `must_not` when negated.

**Search text** becomes one `multi_match` per word, all required. Each word
may match in any field, so "kenya drought" finds a Publication with a Kenyan
institution and "drought" in the title. Title matches count three times,
author names twice.

### The picker's counts

`buildOptionsRequest` asks for every value of one Filter with two counts:
**Overall** (in the whole index) and **Here** (among Publications that reach
this Filter, that is, after Search and the Filters above it). Values with
Here = 0 are still listed, so a user can pick something the earlier Filters
have ruled out and see why nothing comes back.

Names for the values (a Topic's name for `T10471`) come from Postgres by ID.

## Step 5: the pages

Files: `src/app/`, `src/components/search/`.

Pages are **Server Components**: they run on the server, call the service
functions directly, and send HTML. There is no client-side data store.

`src/app/page.tsx` reads the URL, calls `searchPublications`, and hands the
result to `SearchView`, a client component. When the user does anything,
`SearchView` computes the next state and calls `router.replace` with the new
URL. The server renders again. That is the whole loop:

```text
user action → new URL → server reads URL → Elasticsearch → new HTML
```

The interactive pieces:

- `search-bar.tsx`: typing is a draft. A debounced call to the API shows "19
  of 1000 match" before committing. Enter applies, Escape reverts.
- `filter-panel.tsx`: the narrowing. Drag-and-drop is dnd-kit, which also
  works from the keyboard (Space, arrows, Space).
- `filter-picker.tsx`: the dialog. Picks are a draft, applied when the dialog
  closes by any route; only "Discard changes" cancels. The footer shows live
  what the Filter would keep.
- `results-table.tsx`: TanStack Table for column visibility and row
  expansion. Sorting is not done in the browser: a header click changes
  `sort` in the URL and Elasticsearch sorts across all pages.

The **detail page** reads one Publication from Postgres with the same
`readPublications` function the indexer uses. An author's name links to
`/?authors=A…`, the search filtered to that Author.

The **insights page** runs three SQL queries (`src/server/insights/queries.ts`):

- *Top 20 Danish Authors.* A Danish Author has at least one Affiliation at a
  Danish Institution, on any Publication. Ranked by distinct Publications.
- *Authors per Country.* `count(distinct author_id)` grouped by country, so an
  Author with three countries adds one to each and never two to the same.
- *Citations per Publication.* Bins that widen (0, 1, 2, 3–5, … 101+),
  because a third of Publications have no citations and a handful have over
  a hundred; equal-width bins would show one tall bar and nothing else.

## How it was verified

| Layer | Check |
| --- | --- |
| Mapping OpenAlex → rows | 49 unit tests on five real works, written by a separate agent before the code |
| Load | 16 integration tests against Postgres, same separation |
| URL state, document, query builder | 23 unit tests |
| Index, search, options, detail read, insights | 18 integration tests against real Postgres and Elasticsearch |
| UI | A scripted browser pass with 28 assertions, and screenshots; not in the repository |
| Setup | A fresh clone brought up with `docker compose up --build` alone |

The tests of the first two rows are the stronger evidence: the agent that
wrote the code was not allowed to edit them. The later tests were written by
the same agent as the code.

## What I would say is weak

- The sample is the first 1,000 by relevance, so every statistic describes
  the sample.
- The UI has no automated tests in the repository.
- Later slices lost the independent test-writer.
- Rebuilding the index has a moment of downtime.
- The author picker cannot scroll through all 7,600 authors.
- Postgres and Elasticsearch are open on the host with development passwords.

## Questions worth being ready for

**Why Postgres and Elasticsearch both?** See Step 3. Short form: the brief
asks for both; each does what it is good at; one is derived from the other.

**How do you keep them in sync?** They are not kept in sync; the index is
rebuilt from Postgres. Nothing else writes to it.

**Why does filter order matter if the result is the same?** It does not
matter to the result. It matters to the explanation: the counts show which
Filter removed what. The prototypes showed this was easier to understand than
ordinary facet counts.

**Does a negated filter with several values mean "not A or not B"?** No.
"Is none of A, B" keeps Publications that have neither.

**What happens to a publication with an author OpenAlex could not identify?**
Step 2, ADR-0004.

**Why topics when the brief says concepts?** OpenAlex has deprecated
concepts; topics are maintained, fewer per work, and hierarchical (ADR-0002).

**How would this scale to all 5,000, or 5 million?** The harvest would page by
cursor with a key. The load is already batched per page. The index rebuild
would need streaming from Postgres and an alias swap. The per-step
aggregations cost one filter each, which Elasticsearch caches well. The
author picker would need server-side search instead of listing every value.

**What did the AI do, and what did you do?** `PROMPTS.md`. Short form: I made
the product and UI decisions through an interview and five prototype rounds,
and set the process (specs as issues, tests before code). The agents wrote
the code. For the last stretch I traded the stricter process for speed, and
said so.

**Why Next.js for the backend instead of Python?** It is the stack I know, the
brief allows it, and one language end to end kept a small project small. The
"backend" is the modules under `src/server/`, which do not depend on Next.js.

## Where things are

```text
scripts/                  harvest, load, index (thin command-line wrappers)
src/server/openalex/      client, cache, mapper, load
src/server/db/            Drizzle schema and connection
src/server/publications/  read a Publication with everything attached
src/server/search/        document, index build, query builder, service
src/server/insights/      the three SQL analyses
src/lib/search-params.ts  URL ⇄ search state
src/app/                  pages and API routes
src/components/search/    the search page's interactive parts
docs/adr/                 six decisions, one paragraph each
```
