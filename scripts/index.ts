// pnpm index
//
// Rebuilds the Elasticsearch index from Postgres. The index is dropped and
// recreated, never appended to, so it is safe to run at any time.

import "./env";
import { db } from "@/server/db";
import { rebuildIndex } from "@/server/search/build-index";
import { indexName } from "@/server/search/elasticsearch";

async function main() {
  const count = await rebuildIndex(db);
  console.log(`Indexed ${count} Publications into "${indexName()}".`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$client.end());
