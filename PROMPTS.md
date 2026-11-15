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

**Found along the way:** the generated name of the composite foreign key from `affiliations` to `authorships` exceeded Postgres's 63-character limit and was truncated, so every `db:push` saw a change. It is now named by hand. `LayoutProps<"/">` broke `tsc` on a fresh clone because Next generates that type only at build time.

**Decisions for me to review:** nullability beyond what the issue lists (`doi`, `language`, `oa_url`, `pmid`, `orcid`, `ror` and institution `type` nullable; `publication_date` NOT NULL), foreign keys with cascade from `publications`, and pnpm 10 pinned through `packageManager` (run `corepack enable`).

**Changed after review (PR #11):** `title` is now nullable. #4 now asks the harvester to check whether OpenAlex Authorships can lack an Author ID.
