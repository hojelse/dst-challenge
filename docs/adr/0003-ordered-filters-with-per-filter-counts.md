# Filters are ordered and each reports how many Publications it removes

Filters combine with AND, so their order never changes the final result. We still keep them in a user-defined order and show, for each one, how many Publications reach it and how many remain after it, like the rows of a Postgres EXPLAIN. Prototyping (branch `prototype/search-ui`, rounds 1 to 5) showed this narrowing view explains the result better than the usual independent facet counts. It also makes negation ("is none of") and switched-off Filters easy to reason about.

## Consequences

- The search API takes the Filter order, negation and off-state as input and returns per-Filter counts. Each Filter costs one Elasticsearch `filter` aggregation over the Filters before it.
- Value counts in a Filter's picker are counted against the Publications reaching that Filter, alongside the overall count. They are not the standard "all other facets applied" counts.
- Search is always the first line of the narrowing and cannot be reordered.
