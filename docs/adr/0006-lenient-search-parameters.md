# Search parameters are lenient, and the search API is narrower than first specified

The search page and `GET /api/publications` read the same URL parameters through one parser (`src/lib/search-params.ts`). Issue #6 specified a 400 response for each kind of malformed input. We instead fall back to defaults (an unknown `sort` is relevance, a bad `page` is 1, an unknown Filter key is ignored), because the same URLs are typed and edited by people, and a page of results is more useful to them than an error. Only `/api/publications/options` rejects input, since it cannot answer without a valid `key`.

Two other parts of issue #6 were cut to finish within the challenge's time: `wouldKeep` (what a switched-off Filter would leave if it were on; the row shows "Off" and its input instead), and validation tests for each malformed input.

## Consequences

- A mistyped parameter is silently ignored, so an API client gets no hint that it was wrong.
- Display names of Topics, Institutions and Authors in the Filters are read from Postgres by ID, not from Elasticsearch. The index stores only what it searches and counts.
