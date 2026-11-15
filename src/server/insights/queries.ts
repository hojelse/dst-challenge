// The Task 4 analyses, as SQL over Postgres. Each counts Authors, so
// unidentified Authorships (null author_id, ADR-0004) are left out.

import { sql } from "drizzle-orm";
import type { db as appDb } from "@/server/db";

type Db = typeof appDb;

export type DanishAuthor = {
  id: string;
  name: string;
  publications: number;
  /** Every Institution the Author is affiliated with, Danish ones first. */
  institutions: { id: string; name: string; countryCode: string | null }[];
};

/**
 * The 20 Danish Authors with the most Publications. A Danish Author has at
 * least one Affiliation at a Danish Institution on any harvested Publication.
 */
export async function topDanishAuthors(db: Db): Promise<DanishAuthor[]> {
  const rows = await db.execute(sql`
    with author_institutions as (
      select distinct a.author_id, i.id, i.display_name, i.country_code
      from authorships a
      join affiliations af
        on af.publication_id = a.publication_id and af.position = a.position
      join institutions i on i.id = af.institution_id
      where a.author_id is not null
    ),
    danish_authors as (
      select distinct author_id from author_institutions where country_code = 'DK'
    )
    select
      au.id,
      au.display_name as name,
      count(distinct a.publication_id)::int as publications,
      (
        select json_agg(
          json_build_object('id', ai.id, 'name', ai.display_name, 'countryCode', ai.country_code)
          order by (ai.country_code = 'DK') desc nulls last, ai.display_name
        )
        from author_institutions ai
        where ai.author_id = au.id
      ) as institutions
    from danish_authors d
    join authors au on au.id = d.author_id
    join authorships a on a.author_id = au.id
    group by au.id, au.display_name
    order by publications desc, au.display_name
    limit 20
  `);
  return rows as unknown as DanishAuthor[];
}

export type CountryAuthors = { countryCode: string; authors: number };

/**
 * Authors per Country. An Author affiliated with three Countries adds one to
 * each, and never more than one to the same Country.
 */
export async function authorsByCountry(db: Db): Promise<CountryAuthors[]> {
  const rows = await db.execute(sql`
    select i.country_code as "countryCode", count(distinct a.author_id)::int as authors
    from authorships a
    join affiliations af
      on af.publication_id = a.publication_id and af.position = a.position
    join institutions i on i.id = af.institution_id
    where a.author_id is not null and i.country_code is not null
    group by i.country_code
    order by authors desc, i.country_code
  `);
  return rows as unknown as CountryAuthors[];
}

/** Upper bounds of the citation bins; the last bin is open-ended. */
export const CITATION_BINS = [0, 1, 2, 5, 10, 20, 50, 100] as const;

export type CitationBin = { label: string; publications: number };

/** Publications per citation-count bin. Bins widen because the tail is long. */
export async function citationDistribution(db: Db): Promise<CitationBin[]> {
  const rows = (await db.execute(sql`
    select width_bucket(cited_by_count, ${sql.raw(`array[${CITATION_BINS.map((b) => b + 1).join(",")}]`)}) as bin,
           count(*)::int as publications
    from publications
    group by bin
  `)) as unknown as { bin: number; publications: number }[];
  const counts = new Map(rows.map((row) => [row.bin, row.publications]));

  return [...CITATION_BINS, Infinity].map((upper, bin) => {
    const lower = bin === 0 ? 0 : CITATION_BINS[bin - 1] + 1;
    const label =
      upper === Infinity
        ? `${lower}+`
        : lower === upper
          ? String(lower)
          : `${lower}–${upper}`;
    return { label, publications: counts.get(bin) ?? 0 };
  });
}
