import { db } from "@/server/db";
import { readPublication } from "@/server/publications/read";

/** GET /api/publications/{id}: one Publication in full, from Postgres. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const publication = await readPublication(db, id);
  if (!publication) {
    return Response.json({ error: "Publication not found" }, { status: 404 });
  }
  return Response.json(publication);
}
