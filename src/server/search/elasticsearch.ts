// A minimal Elasticsearch client over fetch. The app needs five endpoints,
// so the official client would be more dependency than code saved.

/** The index name. Integration tests set ELASTICSEARCH_INDEX to a test index. */
export function indexName(): string {
  return process.env.ELASTICSEARCH_INDEX ?? "publications";
}

export class ElasticsearchError extends Error {
  constructor(
    readonly status: number,
    body: string,
  ) {
    super(`Elasticsearch responded ${status}: ${body.slice(0, 500)}`);
  }
}

/**
 * Sends one request. `body` is sent as JSON, or as-is when it is already a
 * string (the bulk API takes newline-delimited JSON).
 */
export async function elasticsearch<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  const base = process.env.ELASTICSEARCH_URL;
  if (!base) {
    throw new Error("ELASTICSEARCH_URL is not set. Copy .env.example to .env.");
  }
  const ndjson = typeof body === "string";
  const response = await fetch(new URL(path, base), {
    method,
    headers: body
      ? { "content-type": ndjson ? "application/x-ndjson" : "application/json" }
      : undefined,
    body: body ? (ndjson ? body : JSON.stringify(body)) : undefined,
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok) throw new ElasticsearchError(response.status, text);
  return JSON.parse(text) as T;
}
