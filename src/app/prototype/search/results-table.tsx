"use client";

// PROTOTYPE (round 2): results as a TanStack Table.
// - Sorting is manual: clicking Date/Citations writes the URL `sort` param, the engine sorts
//   across all pages (like Elasticsearch would). Clearing the sort falls back to relevance.
// - Column visibility is client-only.
// - Rows expand inline to show every author, Danish institutions first, and all topics.

import { Fragment, useMemo } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { parseCountryLabel, type Publication, type SortKey } from "./engine";

const features = tableFeatures({
  rowSortingFeature,
  columnVisibilityFeature,
  rowExpandingFeature,
  expandedRowModel: createExpandedRowModel(),
});

const col = createColumnHelper<typeof features, Publication>();

function danishFirst(record: Publication) {
  return [...record.institutions].sort((a, b) => Number(b.country === "DK") - Number(a.country === "DK"));
}

const columns = col.columns([
  col.display({
    id: "expand",
    header: "",
    enableHiding: false,
    cell: ({ row }) => (
      <button
        type="button"
        aria-label={row.getIsExpanded() ? "Collapse details" : "Expand details"}
        aria-expanded={row.getIsExpanded()}
        className="rounded p-1 hover:bg-muted"
        onClick={() => row.toggleExpanded()}
      >
        <ChevronRight className={`size-4 transition-transform ${row.getIsExpanded() ? "rotate-90" : ""}`} />
      </button>
    ),
  }),
  col.accessor("title", {
    header: "Publication",
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => {
      const r = row.original;
      const dk = r.institutions.filter((i) => i.country === "DK");
      return (
        <div className="min-w-0 space-y-0.5">
          <a href={`#${r.id}`} className="line-clamp-2 font-medium hover:underline">
            {r.title}
          </a>
          <p className="truncate text-xs text-muted-foreground">
            {r.authors.slice(0, 3).map((a) => a.name).join(", ")}
            {r.authors.length > 3 ? ` +${r.authors.length - 3} more` : ""}
          </p>
          {dk.length > 0 ? (
            <p className="truncate text-xs text-muted-foreground">
              {dk.slice(0, 2).map((i) => i.name).join(", ")}
              {r.institutions.length > 2 ? ` +${r.institutions.length - Math.min(2, dk.length)} more` : ""}
            </p>
          ) : null}
        </div>
      );
    },
  }),
  col.accessor("type", { header: "Type", enableSorting: false }),
  col.accessor("date", { header: "Date", sortDescFirst: true, cell: (c) => <span className="whitespace-nowrap tabular-nums">{c.getValue()}</span> }),
  col.accessor((r) => r.topics, {
    id: "topics",
    header: "Topics",
    enableSorting: false,
    cell: (c) => (
      <div className="flex flex-wrap gap-1">
        {c.getValue().slice(0, 2).map((t) => (
          <Badge key={t.id} variant="secondary" className="h-auto max-w-48 justify-start py-0.5" title={t.name}>
            <span className="truncate">{t.name}</span>
          </Badge>
        ))}
      </div>
    ),
  }),
  col.accessor("oaStatus", {
    header: "Access",
    enableSorting: false,
    cell: (c) => <Badge variant={c.row.original.isOa ? "default" : "outline"}>{c.getValue()}</Badge>,
  }),
  col.accessor("citations", {
    header: "Citations",
    sortDescFirst: true,
    cell: (c) => <span className="block text-right tabular-nums">{c.getValue()}</span>,
  }),
]);

const sortToState: Record<SortKey, SortingState> = {
  relevance: [],
  date: [{ id: "date", desc: true }],
  citations: [{ id: "citations", desc: true }],
};

export function ResultsTable({
  records,
  sort,
  onSetSort,
  dense = false,
  caption,
}: {
  records: Publication[];
  sort: SortKey;
  onSetSort: (sort: SortKey) => void;
  dense?: boolean;
  caption?: string;
}) {
  const sorting = sortToState[sort];
  const table = useTable({
    features,
    columns,
    data: records,
    getRowId: (r) => r.id,
    manualSorting: true,
    enableMultiSort: false,
    enableSortingRemoval: true,
    // Display-only: header clicks write the URL sort param directly (see <th> below).
    state: { sorting },
    getRowCanExpand: () => true,
  });

  const pad = dense ? "px-2 py-1" : "px-3 py-2";
  const visibleCount = table.getVisibleLeafColumns().length;
  const columnsMenu = useMemo(() => table.getAllLeafColumns().filter((c) => c.getCanHide()), [table]);

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2 text-sm">
        <span className="text-muted-foreground">{caption}</span>
        <div className="flex items-center gap-2">
          {sort !== "relevance" ? (
            <Button variant="ghost" size="sm" onClick={() => onSetSort("relevance")}>
              Sort by relevance
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">Sorted by relevance</span>
          )}
          <Popover>
            <PopoverTrigger render={<Button variant="outline" size="sm" />}>
              <Columns3 /> Columns
            </PopoverTrigger>
            <PopoverContent align="end" className="w-48 gap-1">
              {columnsMenu.map((c) => (
                <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted">
                  <Checkbox checked={c.getIsVisible()} onCheckedChange={(v) => c.toggleVisibility(Boolean(v))} />
                  {String(c.columnDef.header)}
                </label>
              ))}
            </PopoverContent>
          </Popover>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b text-left">
                {hg.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      className={`${pad} font-medium whitespace-nowrap text-muted-foreground ${header.id === "citations" ? "text-right" : ""} ${header.id === "expand" ? "w-8" : ""}`}
                      aria-sort={sorted ? "descending" : undefined}
                    >
                      {header.column.getCanSort() ? (
                        <button
                          type="button"
                          className={`inline-flex items-center gap-1 hover:text-foreground ${sorted ? "text-foreground" : ""}`}
                          onClick={() => onSetSort(sorted ? "relevance" : (header.id as SortKey))}
                          title={sorted ? "Click to go back to relevance" : "Sort high to low"}
                        >
                          <table.FlexRender header={header} />
                          <ArrowDown className={`size-3 ${sorted ? "" : "opacity-30"}`} />
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
            {records.length === 0 ? (
              <tr>
                <td colSpan={visibleCount} className="px-3 py-10 text-center text-muted-foreground">
                  No publications match every step.
                </td>
              </tr>
            ) : null}
            {table.getRowModel().rows.map((row) => (
              <Fragment key={row.id}>
                <tr className="border-b align-top last:border-b-0 hover:bg-muted/30">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className={`${pad} ${cell.column.id === "title" ? "max-w-md" : ""}`}>
                      <table.FlexRender cell={cell} />
                    </td>
                  ))}
                </tr>
                {row.getIsExpanded() ? (
                  <tr className="border-b bg-muted/20">
                    <td />
                    <td colSpan={visibleCount - 1} className={pad}>
                      <Details record={row.original} />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Details({ record }: { record: Publication }) {
  const insts = danishFirst(record);
  return (
    <div className="grid gap-3 py-1 text-xs sm:grid-cols-3">
      <div>
        <p className="mb-1 font-medium">Authors ({record.authors.length})</p>
        <p className="text-muted-foreground">
          {record.authors.slice(0, 12).map((a) => a.name).join(", ")}
          {record.authors.length > 12 ? `, +${record.authors.length - 12} more` : ""}
        </p>
      </div>
      <div>
        <p className="mb-1 font-medium">Institutions ({insts.length})</p>
        <ul className="space-y-0.5 text-muted-foreground">
          {insts.slice(0, 6).map((i) => (
            <li key={i.id}>
              {i.name} · {parseCountryLabel(i.country)}
            </li>
          ))}
          {insts.length > 6 ? <li>+{insts.length - 6} more</li> : null}
        </ul>
      </div>
      <div>
        <p className="mb-1 font-medium">Topics</p>
        <ul className="space-y-0.5 text-muted-foreground">
          {record.topics.map((t) => (
            <li key={t.id}>
              {t.name} <span className="opacity-70">· {t.field}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-muted-foreground">
          {record.source} · {record.doi ? <a className="underline" href={record.doi}>DOI</a> : "no DOI"}
        </p>
      </div>
    </div>
  );
}
