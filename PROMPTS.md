# AI prompt record

How AI tools were used while building this solution. Each entry records the prompt, what was delegated, how the output was checked, and what was changed by hand.

Tooling: Claude Code (Claude Fable 5.1) in the terminal, with the `mattpocock-skills` plugin (grilling, domain-modeling, tdd, code-review). Project conventions for the agent live in `CLAUDE.md` and `docs/agents/`.

## 1. Design interview before any code (Sun 15 Nov 2026)

**Prompt:** `/grill-with-docs Challenge.pdf`

**Delegated:** Reading the challenge PDF, fact-finding, and running a structured interview in rounds: every open design decision as a numbered question with a recommended answer, which I accept, reject or amend. Resolved vocabulary goes into `GLOSSARY.md` as it settles; hard-to-reverse choices become ADRs in `docs/adr/`.

**Facts the agent checked instead of guessing:** probed the OpenAlex starting query live (5,044 matching works; default order is relevance; a no-key request shares a $0.10/day budget per IP, so live search through OpenAlex would be fragile), inspected a sample record (both legacy `concepts` and current `topics` are present; abstract is an inverted index; authorships carry disambiguated author IDs and institution country codes), and checked the local toolchain (Docker Desktop with `elasticsearch:9.2.1` and `postgres:17-alpine` images already pulled, Node 24, system Python 3.9 only).

**My decisions, round 1:**
- Time cap of 4–5 hours. Tasks 1–3 first; Task 4 analysis and public deployment only with leftover time.
- Search backend: Elasticsearch (Option A). I already have an OpenAlex API key for the harvest.
- Stack: TypeScript end-to-end with Next.js, since that is what I know best. Not Python/FastAPI.
- System of record: Postgres (familiar); Elasticsearch is the search index. Not MongoDB.
- Deployment: local Docker Compose only, deployment path documented.
- Vocabulary: "Publication" (not work/paper), "Topic" backed by OpenAlex `topics` (not deprecated `concepts`).
- Process: I own the spec. Separate agents write the tests and the implementation, so the tests are not written by the same agent that makes them pass.
- This file is kept up to date as work proceeds.

**Changed by hand:** nothing yet; no code exists at this point.

**My decisions, round 2:**
- App name: TheGreenDiamond, a nod to the Black Diamond library in Copenhagen.
- Author keyed on the OpenAlex author ID; display name from the entity, never the raw author name. Country lives on Institution only; "Danish author" is derived through affiliations.
- Next.js App Router, service modules under `src/server/`, JSON route handlers for the API, pages as Server Components, state in URL params.
- Harvest and index as `tsx` scripts in the same project; raw pages cached to disk; Compose with separate `postgres`, `elasticsearch`, `web` services.
- Drizzle ORM (new to me, trying it), Elasticsearch flat denormalised document, one search box backed by a multi-field match.
- Facets: Topic, Country, Institution, open-access status. OR within a facet, AND across facets, and the UI must make that explicit. Tailwind plus shadcn/ui where it fits.
- Detail page from Postgres, list from Elasticsearch. Classic pagination. Insights page last.
- Agent asked to pick the API key variable name: `OPENALEX_API_KEY`.
- ADR-0001 (Postgres as system of record, Elasticsearch derived) and ADR-0002 (Topics over Concepts) written.

**My decisions, round 3:** facet-count semantics accepted but must be explicit in the UI; detail page as proposed for now; edge states and API validation as proposed; accessibility baseline plus logical tab order; OpenAlex short IDs everywhere in the app; harvest, test and runtime setup as proposed; issues as the approval gate; separate test-writer and implementer agents. Main is protected by a ruleset, so every change goes through a PR. Facet controls, explicit OR/AND, page layout and result card go to a UI prototype before deciding.

**Delegated next:** `/prototype` of the search page: three structurally different variants over 200 real OpenAlex records. The agent scaffolded the Next 16 + Tailwind 4 + shadcn app to host it, verified the Base UI and Next 16 APIs from `node_modules` instead of memory, and wrote the plan in `src/app/prototype/search/README.md`. Variants not yet built.

## 2. Search UI prototype, round 2 (Sun 15 Nov 2026)

**Prompt:** "i continued working on the prototypes in another session, variant a is getting close, but i want another round of variations. What i have found out so far is. Akin to PSQL EXPLAIN, An order of operations/filtering and count that narrows down from all to the selection per operation is nice. i would like that picking from a modal only applies as soon as i close the modal. the exact interactions and ui components is not settled. consider tanstack tables"

**Delegated:** three new structurally different variants (plan rail, step inspector, EXPLAIN console) next to round-1 variant A, an ordered-pipeline module with per-step counts, a staged picker, and a TanStack results table.

**How it was checked:** the agent read TanStack Table v9's type definitions from `node_modules` before using it, since v9 changed the API from v8. It ran `tsc` and ESLint. A Playwright script drove the real dev server and checked render, apply-on-close, discard, reorder, sort and mobile overflow. That run found a crash on any text query, caused by null `source` fields in the sample data, which the agent fixed. Screenshots exposed clipped badges and wrapped dates, also fixed.

**Changed by hand:** nothing yet; variants are for me to compare.

## 3. Search UI prototype, round 3 (Sun 15 Nov 2026)

**Prompt (summarised):** variant D is the favourite. Keep filter terminology ("Add filter"), the left column and the centered modal. Remove the timeline component and the percentage bars, but keep removed/remaining counts. Use drag handles instead of arrows. Prefer E's less cluttered look. Explore OR styling and many selected values, add NOT, and add disabling as well as deleting, to compare results with and without a filter.

**Delegated:** NOT and on/off support in the pipeline, with with/without counts per filter. Drag-and-drop ordering with `@dnd-kit` (stable 6.x rather than the 0.x `@dnd-kit/react`). A staged NOT switch in the picker. Three row styles G, H and I on one shared panel.

**How it was checked:** `tsc`, ESLint and a 29-assertion Playwright run against the dev server, plus screenshots with twelve negated topics. The screenshots exposed a logic error in variant H's labels: NOT on each chip under an OR bracket reads as the wrong boolean. The agent fixed the labels.

**Changed by hand:** nothing yet.

## 4. Search UI prototype, round 4 (Sun 15 Nov 2026)

**Prompt (summarised):** Add filter should list all options, not only those remaining after current filters. Keep from G: eye and delete side by side, the OR-joined values as the edit target, red when negated. But the operator must look clickable. From H: the "200 → 142" count, but not the OR bracket. From I: the eye icon. The modal must match the filter row in every variant.

**Delegated:** one converged row in three operator styles (segmented, dropdown, toggle), with operator and value list pulled into shared components used by both row and modal, and the picker listing every value.

**How it was checked:** `tsc`, ESLint, and a 23-assertion Playwright run, including that the modal's operator state, colour and "nor" joiner match the row. The modal looked see-through in a screenshot. A follow-up check showed this was the fade-in animation: computed opacity is 1 after it settles.

**Changed by hand:** nothing yet.

## 5. Search UI prototype, round 5 (Sun 15 Nov 2026)

**Prompt:** "J is best, but i still want a search bar"

**Delegated:** add a search bar to J. The agent made it the first, fixed line of the filter funnel instead of a separate mechanism, so the "in → out" counts stay honest. While doing so, it noticed the text matcher ignored country names, which the brief explicitly requires, and fixed that.

**How it was checked:** `tsc`, ESLint and a 13-assertion Playwright run (staging, pinning under drag, clear, country match, mobile).

**Changed by hand:** nothing yet.

Rounds 1–5 of the prototype live on branch `prototype/search-ui`, which is kept for reference and never merged. Its `src/app/prototype/search/README.md` records each round.

## 6. Spec issues (Sun 15 Nov 2026)

**Prompt:** "J wins, write up the spec issues"

**Delegated:** turn the decisions from the interview and the five prototype rounds into eight GitHub issues, one per vertical slice (#3–#10). Each has a goal, scope, acceptance criteria, the tests required or a manual QA checklist, and what is out of scope. They are labelled `needs-triage` and linked with GitHub's blocked-by dependencies. The agent also added the Search, Filter and Open access status terms to the glossary, and ADR-0003 for ordered Filters with per-Filter counts.

**Flagged for my decision:** the Author Filter picks Author IDs (#6) instead of the prototype's "name contains".

**Next, by me:** edit the issues and flip each to `ready-for-agent`. Merge PR #2 before slice 1 starts.

## 7. Slice 1: scaffold, Compose and schema (#3) (Sun 15 Nov 2026)

**Prompt:** "Work on issue #3 ([1/8] Scaffold app, Docker Compose and database schema)", then "open a PR when it's done".

**Delegated:** two separate agents. A test-writer agent wrote a Vitest smoke test (`src/smoke.test.ts`) and a schema integration test (`src/server/db/schema.integration.test.ts`) that checks the seven tables, their primary keys, `raw` as jsonb and a nullable `abstract`. These were committed on their own before any implementation. An implementer agent then cherry-picked the scaffold commit `aace991` (without the prototype route), renamed the app, fixed the self-referencing `--font-sans`, and added the Drizzle schema, Docker Compose (Postgres 17, Elasticsearch 9.2.1, standalone `web` image) and Vitest unit/integration projects. It was not allowed to edit the tests.

**How it was checked:** the implementer ran every acceptance command, including `docker compose up --build web` and a fresh clone with `pnpm install --frozen-lockfile`, and checked in headless Chrome that the computed font is Geist. I then confirmed independently that the test files were unchanged since their commit, and reran `pnpm test` (3 passed), `pnpm test:integration` (10 passed), `pnpm lint` and `pnpm tsc --noEmit`.

**Found along the way:** the generated name of the composite foreign key from `affiliations` to `authorships` exceeded Postgres's 63-character limit and was truncated. It is now named by hand. The implementer believed this stopped every `db:push` from seeing a change, but it did not: drizzle-kit 0.31 reads back the columns of a two-column foreign key in no fixed order, so each push drops and re-creates the key. `LayoutProps<"/">` broke `tsc` on a fresh clone because Next generates that type only at build time.

**Decisions for me to review:** nullability beyond what the issue lists (`doi`, `language`, `oa_url`, `pmid`, `orcid`, `ror` and institution `type` nullable; `publication_date` NOT NULL), foreign keys with cascade from `publications`, and pnpm 10 pinned through `packageManager` (run `corepack enable`).

**Changed after review (PR #11):** `title` is now nullable. #4 now asks the harvester to check whether OpenAlex Authorships can lack an Author ID. Before merging I found the foreign key re-created on every push; I chose to accept it and correct the comment and PR text rather than switch to migrations or drop the two-column key.

## 8. Slice 2: harvest and load (#4) (Sun 15 Nov 2026)

**Prompt:** `/triage`, then "let's triage #4", "grill me on those", and after the brief: "start the test-writer agent", then "start the implementer agent, and finish this pr autonomously". Claude Code with Claude Opus 5.5 for this session.

**Delegated:** triage of the spec issues, a grilling round on #4, an agent brief, then two separate agents as in slice 1. The test-writer fetched five real works one at a time as the fixture and committed 52 tests (mapper unit tests, load integration tests) before any implementation. The implementer added the OpenAlex client, the `data/raw/` cache, the mapper, the loader and `pnpm harvest`/`pnpm load`, and was not allowed to edit the tests.

**Facts the agent checked instead of guessing:**
- The issue titles #3–#10 were shifted one place against their bodies (#3 had an empty title), and the `Blocked by:` lines with them. GitHub's native dependencies were right. The agent retitled the issues and copied the dependencies into the text.
- 174 of the first 200 records' Authorships had no OpenAlex author ID, and skipping them, as the issue said, left 10 of those 200 Publications with no Danish Affiliation, failing the issue's own acceptance criterion.
- The list endpoint caps `authorships` at 100 without setting `is_authors_truncated` (W4406617993: 100 in the list, 241 alone).
- Found by the implementer: OpenAlex refuses cursor paging past page 1 without an API key, so the keyless path pages by number.

**My decisions:** keep unidentified Authorships with a null `author_id`, shown by their printed name and counted for Institution and Country Filters but never as Authors (`GLOSSARY.md`, ADR-0004); refetch every work with exactly 100 Authorships from the single-work endpoint; an Institution has at most one Country; the test-writer builds the fixture; the harvester works with or without a key. Comments on #6 and #7 carry the Authorship decision into those slices.

**How it was checked:** the tests were confirmed failing only on the missing modules before implementation, and the test files are unchanged since their commit (`bf66997`). I reran `pnpm test` (49 passed), `pnpm test:integration` (16 passed), `pnpm lint` and `tsc --noEmit`, and checked the acceptance criteria with SQL against the real harvest: 1,000 Publications, 0 without a Danish Affiliation, 0 with exactly 100 Authorships, identical counts after a second `pnpm load`, no requests from a second `pnpm harvest`, and the key in neither `data/raw/` nor git.

**Changed by hand:** ADR-0004's share of affected Publications, corrected from the 200-record sample to the full harvest (about a quarter, not a third).

## 9. Slices 3–8 in one autonomous run (#5–#10) (Sun 15 Nov 2026)

**Prompts:**

> i have used mattpocock skills framework to create some software, But I have lost touch with the code base. I mostly made informed decisions about the front end and the UI in prototyping sessions, but the rest of the architecture and the other decisions I didn't feel very informed. Is there a way to go from the current state with the current issues? To some complete product, maybe by cutting scope, maybe by Having some agent run way more autonomously. […] How can I in very little time go go from what I've created so far to complete assignment?

then, after reading the agent's plan: "go, keep variant J". Claude Code with Claude Fable 5.2.

**Why the process changed:** two slices had taken most of a day. Each went through triage, a grilling round, a test-writer agent, an implementer agent and a PR. That is thorough, but it is sized for a larger project than a 2–3 hour challenge, and it asked me for decisions on backend details I could not judge well. With the deadline the next morning I asked for a way to finish.

**What the agent proposed, and I accepted:**
- Keep the six open issues as the specification, since the decisions in them were already made, but build them in one run on one branch with one PR.
- Drop the per-issue triage gate and the separate test-writer and implementer agents. One agent wrote both code and tests this time, so these tests are a weaker independent check than those of slices 1 and 2.
- Keep prototype variant J, the part I designed, as the search page.
- Cut `wouldKeep` and the 400-validation matrix from #6, skip public deployment, and build only the three analyses the brief names for Task 4.
- Let the agent make the remaining decisions and record each one, so I can review them afterwards instead of being asked in the moment.

**Delegated:** merging PR #12; the Elasticsearch document, mapping and `pnpm index`; the search query builder and service; the three API routes; the search page (search bar, filter panel with drag-and-drop, value picker, results table, pagination); the detail page; the insights queries and charts; the Compose `seed` service; the README; ADR-0005 and ADR-0006; and `docs/WALKTHROUGH.md`, written so that I can get back in touch with the code before the interview.

**Decisions the agent made without asking me** (each is mine to overturn):
- The Author Filter picks Author IDs (ADR-0005), the decision #6 had flagged for me.
- Malformed URL parameters fall back to defaults instead of returning 400 (ADR-0006).
- Elasticsearch is called with `fetch`, not the official client.
- Search requires every word to match, each in any field, as one `multi_match` per word.
- Filter labels are read from Postgres by ID; counts come from Elasticsearch.
- The picker shows both "Here" and "Overall" counts after all. The plan had cut this to one count, but listing every value needs the overall aggregation anyway.
- The detail page's back link carries the search URL in a `from` parameter.
- Citation counts are binned in widening bins (0, 1, 2, 3–5, … 101+).

**How it was checked (by the agent, in this session):**
- `pnpm test`: 72 unit tests pass (49 from slice 2, 23 new). `pnpm test:integration`: 34 pass (16 earlier, 18 new), against real Postgres and Elasticsearch with the five-work fixture. Insights queries are compared with counts computed independently from the fixture JSON.
- `pnpm lint` and `pnpm tsc --noEmit` are clean; `pnpm build` succeeds.
- A scripted browser pass in Chrome (Playwright, not committed) with 28 assertions: draft search and Escape, country-name search, adding, picking, discarding, negating, switching off, keyboard reordering and deleting Filters, sorting, column hiding, row expansion, pagination, reload, the zero-results state, no sideways scroll at 390 px on all three pages, and no console errors. It passed against both `pnpm dev` and the Docker build. The agent also looked at screenshots of each page.
- A fresh clone in an empty directory, started with only `docker compose up --build`, harvested from OpenAlex without a key, loaded 1,000 Publications, built the index and served the app.
- No `.env` file and no API key appear anywhere in `git log -p --all`.

**Found along the way:**
- The first Docker build failed: `/insights` reads no request data, so Next.js ran its SQL while building the static shell, with no database there. It now waits for a request (`connection()`).
- One new integration test failed on first run because the test guessed a Topic ID that is not in the fixture. The test was wrong, not the code.
- An unknown Publication ID shows the not-found page with HTTP 200, because the page streams. The JSON API returns 404. Recorded as a limitation.
- The results table overflowed its column at 1400 px in the first screenshot and was fixed.

**Not done:** public deployment; automated UI tests in the repository; dark mode.

**My review:** _to be filled in by me after reading `docs/WALKTHROUGH.md` and clicking through the app._

**Changed by hand:** _nothing yet._
