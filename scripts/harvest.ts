// pnpm harvest [--force]
//
// Caches the top 1,000 works of the challenge query in data/raw/: five list
// pages, plus every work the list endpoint may have truncated, fetched again
// from the single-work endpoint. A cached file is skipped unless --force is
// passed, so a second run with a full cache makes no network requests.

import "./env";
import {
  PAGE_COUNT,
  isCached,
  pagePath,
  readPage,
  workPath,
  writeJson,
} from "@/server/openalex/cache";
import { fetchChallengePage, fetchWork } from "@/server/openalex/client";
import { shortenId } from "@/server/openalex/mapper";

/**
 * The list endpoint returns at most 100 Authorships per work, without
 * flagging it in `is_authors_truncated`. A work with exactly 100 may have
 * more.
 */
const LIST_AUTHORSHIP_CAP = 100;

const force = process.argv.includes("--force");

async function main() {
  let cursor: string | null = null;
  let singleWorksFetched = 0;

  for (let n = 1; n <= PAGE_COUNT; n++) {
    // A cached page keeps OpenAlex's `meta.next_cursor`, so the next page
    // can be fetched without fetching this one again.
    let page;
    if (!force && isCached(pagePath(n))) {
      page = await readPage(n);
    } else {
      page = await fetchChallengePage(n, cursor);
      if (page.results.length === 0) {
        throw new Error(`OpenAlex has no page ${n} for the challenge query`);
      }
      await writeJson(pagePath(n), page);
      console.log(`Cached page ${n}: ${page.results.length} works`);
    }
    cursor = page.meta.next_cursor;

    for (const work of page.results) {
      if (work.authorships.length !== LIST_AUTHORSHIP_CAP) continue;
      const shortId = shortenId(work.id);
      if (!force && isCached(workPath(shortId))) continue;
      const single = await fetchWork(shortId);
      await writeJson(workPath(shortId), single);
      singleWorksFetched++;
      console.log(
        `Cached ${shortId}: ${single.authorships.length} Authorships`,
      );
    }
  }

  console.log(
    `Harvest done; ${singleWorksFetched} single works fetched this run.`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
