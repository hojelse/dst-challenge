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
