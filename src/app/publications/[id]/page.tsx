import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { countryName } from "@/lib/countries";
import { db } from "@/server/db";
import {
  readPublication,
  type PublicationRecord,
} from "@/server/publications/read";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string | string[] }>;
};

/** The detail page for one Publication, read from Postgres (ADR-0001). */
export default function PublicationPage(props: Props) {
  return (
    <Suspense
      fallback={
        <div role="status" className="py-16 text-center text-muted-foreground">
          Loading publication…
        </div>
      }
    >
      <Publication {...props} />
    </Suspense>
  );
}

async function Publication({ params, searchParams }: Props) {
  const [{ id }, { from }] = await Promise.all([params, searchParams]);
  const publication = await readPublication(db, id);
  if (!publication) notFound();

  // `from` is the search page's query string, so the link returns to the
  // exact search the user came from. It is only ever appended to "/".
  const back = typeof from === "string" && from ? `/?${from}` : "/";
  const title = publication.title ?? "Untitled";
  const countries = [
    ...new Set(
      publication.authorships.flatMap((a) =>
        a.affiliations.flatMap((i) => i.countryCode ?? []),
      ),
    ),
  ]
    .map(countryName)
    .sort();

  return (
    <article className="mx-auto max-w-4xl space-y-6 py-2">
      <title>{`${title} · TheGreenDiamond`}</title>
      <Link
        href={back}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden /> Back to search
      </Link>

      <header className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          {title}
        </h1>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span>{publication.type}</span>
          <span className="tabular-nums">{publication.publicationDate}</span>
          {publication.sourceName ? <span>{publication.sourceName}</span> : null}
          <Badge variant={publication.isOa ? "default" : "outline"}>
            {publication.oaStatus}
          </Badge>
          <span>
            Cited by{" "}
            <strong className="text-foreground tabular-nums">
              {publication.citedByCount}
            </strong>
          </span>
        </p>
        <Links publication={publication} />
      </header>

      <Section title="Abstract">
        {publication.abstract ? (
          <p className="leading-relaxed">{publication.abstract}</p>
        ) : (
          <p className="text-muted-foreground">No abstract available.</p>
        )}
      </Section>

      <Section title="Topics">
        {publication.topics.length === 0 ? (
          <p className="text-muted-foreground">No topics assigned.</p>
        ) : (
          <ul className="space-y-1">
            {publication.topics.map((topic) => (
              <li key={topic.id}>
                <Link href={`/?topics=${topic.id}`} className="hover:underline">
                  {topic.name}
                </Link>{" "}
                <span className="text-sm text-muted-foreground">
                  · {topic.field} · {topic.domain}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Countries (${countries.length})`}>
        <p>{countries.join(" · ") || "None known."}</p>
      </Section>

      <Section title={`Authors (${publication.authorships.length})`}>
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
                <th scope="col" className="px-3 py-2 font-medium">
                  Affiliations
                </th>
              </tr>
            </thead>
            <tbody>
              {publication.authorships.map((authorship) => (
                <tr
                  key={authorship.position}
                  className="border-b align-top last:border-b-0"
                >
                  <td className="px-3 py-2 text-muted-foreground tabular-nums">
                    {authorship.position + 1}
                  </td>
                  <td className="px-3 py-2">
                    {authorship.authorId ? (
                      <Link
                        href={`/?authors=${authorship.authorId}`}
                        className="hover:underline"
                        title="Search this author's publications"
                      >
                        {authorship.name}
                      </Link>
                    ) : (
                      // An unidentified Authorship (ADR-0004): no Author to link.
                      authorship.name
                    )}
                    {authorship.isCorresponding ? (
                      <Badge variant="secondary" className="ml-2">
                        corresponding
                      </Badge>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    {authorship.affiliations.length === 0 ? (
                      <span className="text-muted-foreground">None listed</span>
                    ) : (
                      <ul className="space-y-0.5">
                        {authorship.affiliations.map((institution) => (
                          <li key={institution.id}>
                            {institution.name}
                            <span className="text-muted-foreground">
                              {institution.countryCode
                                ? ` · ${countryName(institution.countryCode)}`
                                : " · country unknown"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </article>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Links({ publication }: { publication: PublicationRecord }) {
  const links = [
    { label: "DOI", href: publication.doi },
    { label: "OpenAlex", href: `https://openalex.org/${publication.id}` },
    { label: "Open access copy", href: publication.oaUrl },
    { label: "PubMed", href: publication.pmid },
  ].filter((link): link is { label: string; href: string } =>
    Boolean(link.href?.startsWith("http")),
  );
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      {links.map((link) => (
        <li key={link.label}>
          <a
            href={link.href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 underline underline-offset-2"
          >
            {link.label}
            <ExternalLink className="size-3" aria-hidden />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
