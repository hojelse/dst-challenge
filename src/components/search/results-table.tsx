"use client";

// The results as a TanStack table. Sorting is done by Elasticsearch across
// all pages: a header click only changes the `sort` URL parameter. Column
// visibility and expanded rows are client-only.

import { Fragment, useMemo } from "react";
import Link from "next/link";
import {
  columnVisibilityFeature,
  createColumnHelper,
  createExpandedRowModel,
  rowExpandingFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ChevronRight, Columns3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { countryName } from "@/lib/countries";
import type { Sort } from "@/lib/search-params";
import type { PublicationSummary } from "@/server/search/service";

const features = tableFeatures({
  rowSortingFeature,
  columnVisibilityFeature,
  rowExpandingFeature,
  expandedRowModel: createExpandedRowModel(),
});

const col = createColumnHelper<typeof features, PublicationSummary>();

const plusMore = (total: number, shown: number) =>
  total > shown ? ` +${total - shown} more` : "";

/** `detailQuery` carries the search URL to the detail page's back link. */
function buildColumns(detailQuery: string) {
  return col.columns([
    col.display({
      id: "expand",
      header: "",
      enableHiding: false,
      cell: ({ row }) => (
        <button
          type="button"
          aria-label={row.getIsExpanded() ? "Collapse details" : "Expand details"}
          aria-expanded={row.getIsExpanded()}
          className="cursor-pointer rounded p-1 hover:bg-muted"
          onClick={() => row.toggleExpanded()}
        >
          <ChevronRight
            className={`size-4 transition-transform ${row.getIsExpanded() ? "rotate-90" : ""}`}
          />
        </button>
      ),
    }),
    col.accessor("title", {
      header: "Publication",
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => {
        const publication = row.original;
        const authors = publication.authors.slice(0, 3);
        const institutions = publication.institutions.slice(0, 2);
        return (
          <div className="min-w-0 space-y-0.5">
            <Link
              href={`/publications/${publication.id}${detailQuery}`}
              className="line-clamp-2 font-medium hover:underline"
            >
              {publication.title ?? "Untitled"}
            </Link>
            <p className="truncate text-xs text-muted-foreground">
              {authors.map((a) => a.name).join(", ")}
              {plusMore(publication.author_count, authors.length)}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {institutions.map((i) => i.name).join(", ")}
              {plusMore(publication.institution_count, institutions.length)}
            </p>
          </div>
        );
      },
    }),
    col.accessor("type", { header: "Type", enableSorting: false }),
    col.accessor("publication_date", {
      id: "date",
      header: "Date",
      sortDescFirst: true,
      cell: (cell) => (
        <span className="whitespace-nowrap tabular-nums">{cell.getValue()}</span>
      ),
    }),
    col.accessor((publication) => publication.topics, {
      id: "topics",
      header: "Topics",
      enableSorting: false,
      cell: (cell) => (
        <div className="flex flex-wrap gap-1">
          {cell
            .getValue()
            .slice(0, 2)
            .map((topic) => (
              <Badge
                key={topic.id}
                variant="secondary"
                className="h-auto max-w-44 justify-start py-0.5"
                title={topic.name}
              >
                <span className="truncate">{topic.name}</span>
              </Badge>
            ))}
        </div>
      ),
    }),
    col.accessor("oa_status", {
      id: "access",
      header: "Access",
      enableSorting: false,
      cell: (cell) => (
        <Badge variant={cell.row.original.is_oa ? "default" : "outline"}>
          {cell.getValue()}
        </Badge>
      ),
    }),
    col.accessor("cited_by_count", {
      id: "citations",
      header: "Citations",
      sortDescFirst: true,
      cell: (cell) => (
        <span className="block text-right tabular-nums">{cell.getValue()}</span>
      ),
    }),
  ]);
}

const SORTING: Record<Sort, SortingState> = {
  relevance: [],
  date: [{ id: "date", desc: true }],
  citations: [{ id: "citations", desc: true }],
};

export function ResultsTable({
  items,
  sort,
  onSetSort,
  caption,
  detailQuery,
  empty,
}: {
  items: PublicationSummary[];
  sort: Sort;
  onSetSort: (sort: Sort) => void;
  caption: string;
  detailQuery: string;
  /** Shown instead of rows when nothing matches. */
  empty: React.ReactNode;
}) {
  const columns = useMemo(() => buildColumns(detailQuery), [detailQuery]);
  const table = useTable({
    features,
    columns,
    data: items,
    getRowId: (publication) => publication.id,
    manualSorting: true,
    enableMultiSort: false,
    // Display only: header clicks write the URL `sort` parameter (see <th>).
    state: { sorting: SORTING[sort] },
    getRowCanExpand: () => true,
  });

  const visibleCount = table.getVisibleLeafColumns().length;
  const hideable = table.getAllLeafColumns().filter((c) => c.getCanHide());

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 text-sm">
        <span className="text-muted-foreground" aria-live="polite">
          {caption}
        </span>
        <div className="flex items-center gap-2">
          {sort !== "relevance" ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSetSort("relevance")}
            >
              Sort by relevance
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">
              Sorted by relevance
            </span>
          )}
          <Popover>
            <PopoverTrigger render={<Button variant="outline" size="sm" />}>
              <Columns3 /> Columns
            </PopoverTrigger>
            <PopoverContent align="end" className="w-48 gap-1">
              {hideable.map((column) => (
                <label
                  key={column.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted"
                >
                  <Checkbox
                    checked={column.getIsVisible()}
                    onCheckedChange={(checked) =>
                      column.toggleVisibility(Boolean(checked))
                    }
                  />
                  {String(column.columnDef.header)}
                </label>
              ))}
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="px-3 py-12 text-center">{empty}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              {table.getHeaderGroups().map((group) => (
                <tr key={group.id} className="border-b text-left">
                  {group.headers.map((header) => {
                    const sorted = header.column.getIsSorted();
                    return (
                      <th
                        key={header.id}
                        scope="col"
                        className={`px-3 py-2 font-medium whitespace-nowrap text-muted-foreground ${header.id === "citations" ? "text-right" : ""} ${header.id === "expand" ? "w-8" : ""}`}
                        aria-sort={sorted ? "descending" : undefined}
                      >
                        {header.id === "expand" ? (
                          <span className="sr-only">Details</span>
                        ) : header.column.getCanSort() ? (
                          <button
                            type="button"
                            className={`inline-flex cursor-pointer items-center gap-1 hover:text-foreground ${sorted ? "text-foreground" : ""}`}
                            onClick={() =>
                              onSetSort(sorted ? "relevance" : (header.id as Sort))
                            }
                            title={
                              sorted
                                ? "Click to go back to relevance"
                                : "Sort high to low"
                            }
                          >
                            <table.FlexRender header={header} />
                            <ArrowDown
                              className={`size-3 ${sorted ? "" : "opacity-30"}`}
                            />
                          </button>
                        ) : (
                          <table.FlexRender header={header} />
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <Fragment key={row.id}>
                  <tr className="border-b align-top last:border-b-0 hover:bg-muted/30">
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        // `w-full max-w-0` gives the title the width left over by
                        // the other columns and lets its lines truncate.
                        className={`px-3 py-2 ${cell.column.id === "title" ? "w-full max-w-0 min-w-64" : ""}`}
                      >
                        <table.FlexRender cell={cell} />
                      </td>
                    ))}
                  </tr>
                  {row.getIsExpanded() ? (
                    <tr className="border-b bg-muted/20">
                      <td />
                      <td colSpan={visibleCount - 1} className="px-3 py-2">
                        <Details publication={row.original} />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Details({ publication }: { publication: PublicationSummary }) {
  return (
    <div className="grid max-h-80 gap-3 overflow-y-auto py-1 text-xs sm:grid-cols-3">
      <div>
        <p className="mb-1 font-medium">Authors ({publication.author_count})</p>
        <p className="text-muted-foreground">
          {publication.authors.map((a) => a.name).join(", ")}
        </p>
      </div>
      <div>
        <p className="mb-1 font-medium">
          Institutions ({publication.institution_count})
        </p>
        <ul className="space-y-0.5 text-muted-foreground">
          {publication.institutions.map((institution) => (
            <li key={institution.id}>
              {institution.name}
              {institution.country_code
                ? ` · ${countryName(institution.country_code)}`
                : ""}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="mb-1 font-medium">Topics</p>
        <ul className="space-y-0.5 text-muted-foreground">
          {publication.topics.length === 0 ? <li>None assigned</li> : null}
          {publication.topics.map((topic) => (
            <li key={topic.id}>
              {topic.name} <span className="opacity-70">· {topic.field}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-muted-foreground">
          {publication.source_name ?? "No source"}
        </p>
      </div>
    </div>
  );
}
