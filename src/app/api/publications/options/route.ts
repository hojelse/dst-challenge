import { FILTER_KEYS, parseSearchState, type FilterKey } from "@/lib/search-params";
import { filterOptions } from "@/server/search/service";

/** GET /api/publications/options?key=topics&…: every value of one Filter. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const key = params.get("key");
  if (!key || !(FILTER_KEYS as readonly string[]).includes(key)) {
    return Response.json(
      { error: `key must be one of ${FILTER_KEYS.join(", ")}` },
      { status: 400 },
    );
  }
  const options = await filterOptions(parseSearchState(params), key as FilterKey);
  return Response.json(options);
}
