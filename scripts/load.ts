// pnpm load
//
// Loads the pages cached by `pnpm harvest` into Postgres, one page per
// transaction. A work with a cached single-work file is stored in that
// version. Idempotent: a re-run yields the same row counts.

import "./env";
import { db } from "@/server/db";
import { PAGE_COUNT, readPage, readSingleWorks } from "@/server/openalex/cache";
import { loadWorks } from "@/server/openalex/load";

async function main() {
  const singleWorks = await readSingleWorks();
  let publications = 0;
  let unidentified = 0;

  for (let n = 1; n <= PAGE_COUNT; n++) {
    const page = await readPage(n);
    const summary = await loadWorks(db, page.results, singleWorks);
    publications += summary.publications;
    unidentified += summary.unidentifiedAuthorships;
    console.log(`Loaded page ${n}: ${summary.publications} Publications`);
  }

  console.log(
    `Loaded ${publications} Publications, ${singleWorks.length} of them from single-work files.`,
  );
  // Kept, not skipped (ADR-0004).
  console.warn(`${unidentified} unidentified Authorships (no OpenAlex Author).`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$client.end());
