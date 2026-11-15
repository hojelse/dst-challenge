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
