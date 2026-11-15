import type { db as appDb } from "@/server/db";
import { readPublications } from "@/server/publications/read";
import { buildDocument, INDEX_MAPPING } from "./document";
import {
  elasticsearch,
  ElasticsearchError,
  indexName,
} from "./elasticsearch";

const BATCH_SIZE = 200;

/**
 * Drops the index and rebuilds it from Postgres (ADR-0001). Returns the
 * number of Publications indexed.
 */
export async function rebuildIndex(db: typeof appDb): Promise<number> {
  const index = indexName();

  try {
    await elasticsearch("DELETE", `/${index}`);
  } catch (error) {
    // No index yet on the first run.
    if (!(error instanceof ElasticsearchError && error.status === 404)) {
      throw error;
    }
  }
  await elasticsearch("PUT", `/${index}`, {
    settings: { number_of_shards: 1, number_of_replicas: 0 },
    mappings: INDEX_MAPPING,
  });

  const documents = (await readPublications(db)).map(buildDocument);
  for (let start = 0; start < documents.length; start += BATCH_SIZE) {
    const lines = documents
      .slice(start, start + BATCH_SIZE)
      .flatMap((doc) => [{ index: { _id: doc.id } }, doc])
      .map((line) => JSON.stringify(line));
    const result = await elasticsearch<{
      errors: boolean;
      items: { index: { error?: unknown } }[];
    }>("POST", `/${index}/_bulk`, lines.join("\n") + "\n");
    if (result.errors) {
      const first = result.items.find((item) => item.index.error);
      throw new Error(`Bulk indexing failed: ${JSON.stringify(first)}`);
    }
  }

  await elasticsearch("POST", `/${index}/_refresh`);
  return documents.length;
}
