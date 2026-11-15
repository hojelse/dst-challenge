import { parseSearchState } from "@/lib/search-params";
import { searchPublications } from "@/server/search/service";

/** GET /api/publications: Search plus ordered Filters (ADR-0003). */
export async function GET(request: Request) {
  const state = parseSearchState(new URL(request.url).searchParams);
  return Response.json(await searchPublications(state));
}
