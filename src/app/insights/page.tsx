import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { BarChart } from "@/components/insights/bar-chart";
import { countryName } from "@/lib/countries";
import { db } from "@/server/db";
import {
  authorsByCountry,
  citationDistribution,
  topDanishAuthors,
} from "@/server/insights/queries";

export const metadata: Metadata = { title: "Insights" };

/** Countries shown as bars; the rest are in the table below the chart. */
const TOP_COUNTRIES = 20;

export default function InsightsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-10 py-2">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Insights</h1>
        <p className="text-muted-foreground">
          Three questions asked of the harvested publications, answered with
          SQL over Postgres.
        </p>
      </header>
      <Suspense
        fallback={
          <p role="status" className="text-muted-foreground">
            Loading insights…
          </p>
        }
      >
        <Insights />
      </Suspense>
    </div>
  );
}

async function Insights() {
  // Query at request time, not while the static shell is built.
  await connection();
  const [authors, countries, citations] = await Promise.all([
    topDanishAuthors(db),
    authorsByCountry(db),
    citationDistribution(db),
  ]);
  const uncited = citations[0]?.publications ?? 0;
  const total = citations.reduce((sum, bin) => sum + bin.publications, 0);

  return (
    <>
      <Section
        title="Top 20 Danish authors"
        note="A Danish author has at least one affiliation at a Danish institution on any harvested publication. Ranked by number of publications."
      >
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th scope="col" className="w-10 px-3 py-2 font-medium">
                  #
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Author
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Publications
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Affiliations
                </th>
              </tr>
            </thead>
            <tbody>
              {authors.map((author, i) => (
                <tr key={author.id} className="border-b align-top last:border-b-0">
                  <td className="px-3 py-2 text-muted-foreground tabular-nums">
                    {i + 1}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <Link
                      href={`/?authors=${author.id}`}
                      className="hover:underline"
                    >
                      {author.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {author.publications}
                  </td>
                  <td className="px-3 py-2">
                    <ul className="space-y-0.5">
                      {author.institutions.map((institution) => (
                        <li key={institution.id}>
                          {institution.name}
                          {institution.countryCode !== "DK" ? (
                            <span className="text-muted-foreground">
                              {" "}
                              ·{" "}
                              {institution.countryCode
                                ? countryName(institution.countryCode)
                                : "country unknown"}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        title="Where authors are affiliated"
        note={`Authors per country, for the ${TOP_COUNTRIES} largest of ${countries.length} countries. An author affiliated in several countries counts once in each.`}
      >
        <BarChart
          horizontal
          unit="authors"
          height={TOP_COUNTRIES * 26 + 40}
          data={countries.slice(0, TOP_COUNTRIES).map((row) => ({
            label: countryName(row.countryCode),
            value: row.authors,
          }))}
        />
        <DataTable
          summary={`All ${countries.length} countries as a table`}
          columns={["Country", "Authors"]}
          rows={countries.map((row) => [
            countryName(row.countryCode),
            row.authors,
          ])}
        />
      </Section>

      <Section
        title="Citations per publication"
        note={`Publications by number of citations. The bins widen to the right because the tail is long: ${uncited} of ${total} publications have not been cited yet.`}
      >
        <BarChart
          unit="publications"
          height={280}
          data={citations.map((bin) => ({
            label: bin.label,
            value: bin.publications,
          }))}
        />
        <DataTable
          summary="The distribution as a table"
          columns={["Citations", "Publications"]}
          rows={citations.map((bin) => [bin.label, bin.publications])}
        />
      </Section>
    </>
  );
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{note}</p>
      </div>
      {children}
    </section>
  );
}

/** The chart's numbers as a table, for screen readers and exact values. */
function DataTable({
  summary,
  columns,
  rows,
}: {
  summary: string;
  columns: [string, string];
  rows: [string, number][];
}) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
        {summary}
      </summary>
      <table className="mt-2 w-full max-w-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th scope="col" className="py-1 font-medium">
              {columns[0]}
            </th>
            <th scope="col" className="py-1 text-right font-medium">
              {columns[1]}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label} className="border-b last:border-b-0">
              <td className="py-1">{label}</td>
              <td className="py-1 text-right tabular-nums">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
