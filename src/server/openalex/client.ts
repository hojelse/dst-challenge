// A small client for the OpenAlex API: the challenge query, page by page, and
// single works. Sends OPENALEX_API_KEY as `api_key` when it is set; works
// without it. The key is never logged or returned.

import type { OpenAlexWork } from "./mapper";

const BASE_URL = "https://api.openalex.org";

/** The challenge query: 2025 "climate change" works with a Danish Institution. */
const CHALLENGE_QUERY = {
  search: "climate change",
  filter:
    "institutions.country_code:DK,from_publication_date:2025-01-01,to_publication_date:2025-12-31",
};

export const PER_PAGE = 200;

/** One page of the works list endpoint, as OpenAlex returns it. */
export type WorksPage = {
  meta: { count: number; per_page: number; next_cursor: string | null };
  results: OpenAlexWork[];
};

const MAX_RETRIES = 3;

function isRetryable(status: number) {
  return status === 429 || status >= 500;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** The URL without its `api_key`, safe to log or put in an error. */
function redact(url: URL): string {
  const copy = new URL(url);
  copy.searchParams.delete("api_key");
  return copy.toString();
}

/**
 * GETs a path from the OpenAlex API and parses the JSON. Retries 429 and 5xx
 * responses up to MAX_RETRIES times with exponential backoff, honouring
 * Retry-After when OpenAlex sends it.
 */
async function get<T>(path: string, params: Record<string, string> = {}) {
  const url = new URL(path, BASE_URL);
  for (const [name, value] of Object.entries(params)) {
    url.searchParams.set(name, value);
  }
  const apiKey = process.env.OPENALEX_API_KEY;
  if (apiKey) url.searchParams.set("api_key", apiKey);

  for (let attempt = 0; ; attempt++) {
    console.log(`GET ${redact(url)}`);
    const response = await fetch(url);
    if (response.ok) return (await response.json()) as T;

    if (!isRetryable(response.status) || attempt === MAX_RETRIES) {
      throw new Error(
        `OpenAlex responded ${response.status} for ${redact(url)}`,
      );
    }
    const retryAfter = Number(response.headers.get("retry-after"));
    const delay = retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt;
    console.warn(
      `OpenAlex responded ${response.status}; retrying in ${delay} ms`,
    );
    await sleep(delay);
  }
}

/**
 * Page `n` (1-based) of the challenge query in default relevance order, with
 * full records (no `select`). Pages by cursor: pass the previous page's
 * `meta.next_cursor`. OpenAlex refuses cursor paging past the first page
 * without an API key, so without one, or without a cursor, it pages by
 * number instead; for the top 1,000 both give the same works in the same
 * order.
 */
export function fetchChallengePage(
  n: number,
  cursor: string | null,
): Promise<WorksPage> {
  const byCursor = process.env.OPENALEX_API_KEY && (n === 1 || cursor !== null);
  return get<WorksPage>("/works", {
    ...CHALLENGE_QUERY,
    "per-page": String(PER_PAGE),
    ...(byCursor ? { cursor: cursor ?? "*" } : { page: String(n) }),
  });
}

/**
 * One work from the single-work endpoint, which, unlike the list endpoint,
 * does not cap `authorships` at 100.
 */
export function fetchWork(shortId: string): Promise<OpenAlexWork> {
  return get<OpenAlexWork>(`/works/${shortId}`);
}
