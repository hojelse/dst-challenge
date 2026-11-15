# TheGreenDiamond

Scholarly publications on climate change from Danish research institutions,
published in 2025, harvested from [OpenAlex](https://openalex.org) and made
searchable. See `GLOSSARY.md` for the domain language and `docs/adr/` for the
decisions behind the design.

Next.js 16 (App Router), Tailwind 4 and shadcn/ui on the front end; Postgres
(via Drizzle ORM) as the system of record; Elasticsearch as the search index.

## Setup

You need Node 24 (`nvm use`), pnpm via corepack (`corepack enable`), and
Docker.

```bash
cp .env.example .env              # then set OPENALEX_API_KEY
docker compose up -d postgres elasticsearch
pnpm install
pnpm db:push                      # create the tables from src/server/db/schema.ts
pnpm dev                          # http://localhost:3000
```

To run the whole stack in Docker instead, including the app:

```bash
docker compose up --build
```

## Configuration

| Variable            | Purpose                                    |
| ------------------- | ------------------------------------------ |
| `DATABASE_URL`      | Postgres connection string                 |
| `ELASTICSEARCH_URL` | Elasticsearch base URL                     |
| `OPENALEX_API_KEY`  | OpenAlex API key, used by the harvester    |

## Tests

```bash
pnpm test               # unit tests (*.test.ts)
pnpm test:integration   # *.integration.test.ts, against the Compose services
pnpm lint
pnpm tsc --noEmit
```

Integration tests use the `thegreendiamond_test` database on the same Postgres
server (created and pushed automatically) and the `publications_test`
Elasticsearch index, so they never touch development data.
