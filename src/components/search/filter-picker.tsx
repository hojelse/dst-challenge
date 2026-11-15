"use client";

// The value picker for one Filter. Picks and negation are a draft: closing
// the dialog by any route (Done, X, Escape, backdrop) applies them, and only
// "Discard changes" cancels.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  FILTER_HINT,
  FILTER_LABEL,
  toSearchParams,
  type FilterKey,
  type SearchState,
} from "@/lib/search-params";
import type {
  FilterOption,
  FilterValue,
  SearchResult,
} from "@/server/search/service";
import { OperatorControl, ValueList } from "./filter-parts";

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic },
});

const col = createColumnHelper<typeof features, FilterOption>();

/** Picked values shown before "Show all". */
const PICKED_LIMIT = 8;
/** Rows rendered at once. There are about 7,600 Authors. */
const ROW_LIMIT = 200;
const DEBOUNCE_MS = 250;

export type PickerProps = {
  filterKey: FilterKey;
  selected: FilterValue[];
  negated: boolean;
  /** Publications reaching this Filter. */
  input: number;
  /** The applied search state, which the counts are relative to. */
  state: SearchState;
  onApply: (values: string[], negated: boolean) => void;
  onClose: () => void;
};

/** Loads every value of the Filter, with its counts. */
function useOptions(filterKey: FilterKey, state: SearchState) {
  const [options, setOptions] = useState<FilterOption[] | null>(null);
  const [failed, setFailed] = useState(false);
  const query = `key=${filterKey}&${toSearchParams(state)}`;

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/publications/options?${query}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<FilterOption[]>;
      })
      .then(setOptions)
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          console.error(error);
          setFailed(true);
        }
      });
    return () => controller.abort();
  }, [query]);

  return { options, failed };
}

/** How many Publications the Filter would keep with the draft applied. */
function useDraftKeep(
  { filterKey, state, input }: PickerProps,
  draft: string[],
  draftNegated: boolean,
) {
  const [keep, setKeep] = useState<{ query: string; count: number } | null>(
    null,
  );

  const query = useMemo(() => {
    if (draft.length === 0) return null;
    const drafted = {
      key: filterKey,
      values: draft,
      negated: draftNegated,
      off: false,
    };
    const exists = state.filters.some((f) => f.key === filterKey);
    return toSearchParams({
      ...state,
      filters: exists
        ? state.filters.map((f) => (f.key === filterKey ? drafted : f))
        : [...state.filters, drafted],
      page: 1,
      size: 0,
    }).toString();
  }, [draft, draftNegated, filterKey, state]);

  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/publications?${query}`, {
          signal: controller.signal,
        });
        if (!response.ok) return;
        const result = (await response.json()) as SearchResult;
        const filter = result.filters.find((f) => f.key === filterKey);
        if (filter) setKeep({ query, count: filter.output });
      } catch {
        // Aborted or offline: the preview keeps its last value.
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, filterKey]);

  // Nothing picked: the Filter lets everything through.
  if (!query) return input;
  return keep?.query === query ? keep.count : null;
}

export function FilterPicker(props: PickerProps) {
  const { filterKey, selected, input } = props;
  const label = FILTER_LABEL[filterKey];

  const [draft, setDraft] = useState(() => selected.map((v) => v.id));
  const [draftNegated, setDraftNegated] = useState(props.negated);
  const [showAllPicked, setShowAllPicked] = useState(false);
  const [narrow, setNarrow] = useState("");
  const discard = useRef(false);

  const { options, failed } = useOptions(filterKey, props.state);
  const keep = useDraftKeep(props, draft, draftNegated);

  function close() {
    if (!discard.current) props.onApply(draft, draftNegated);
    props.onClose();
  }

  const toggle = (id: string) =>
    setDraft((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id],
    );

  const labelOf = useMemo(() => {
    const labels = new Map(selected.map((v) => [v.id, v.label]));
    for (const option of options ?? []) labels.set(option.id, option.label);
    return labels;
  }, [selected, options]);

  const narrowed = useMemo(() => {
    const needle = narrow.trim().toLowerCase();
    if (!options || !needle) return options ?? [];
    return options.filter((o) => o.label.toLowerCase().includes(needle));
  }, [options, narrow]);

  const columns = useMemo(
    () =>
      col.columns([
        col.display({ id: "pick", header: "", enableSorting: false }),
        col.accessor("label", { header: label, sortFn: "alphanumeric" }),
        col.accessor("here", {
          header: "Here",
          sortFn: "basic",
          sortDescFirst: true,
        }),
        col.accessor("overall", {
          header: "Overall",
          sortFn: "basic",
          sortDescFirst: true,
        }),
      ]),
    [label],
  );

  const table = useTable({
    features,
    columns,
    data: narrowed,
    getRowId: (row) => row.id,
    initialState: { sorting: [{ id: "here", desc: true }] },
  });

  const rows = table.getRowModel().rows;
  const max = Math.max(1, input);

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-3 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            <span className="inline-flex flex-wrap items-center gap-2">
              {label}
              <OperatorControl
                negated={draftNegated}
                onChange={setDraftNegated}
                label={label}
              />
            </span>
          </DialogTitle>
          <DialogDescription>
            {FILTER_HINT[filterKey]} Changes apply when you close this window.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-7 items-start gap-2 text-sm">
          <div className="min-w-0 flex-1">
            {draft.length === 0 ? (
              <span className="text-muted-foreground">
                Nothing picked: this filter lets everything through.
              </span>
            ) : (
              <ValueList
                labels={draft.map((id) => labelOf.get(id) ?? id)}
                negated={draftNegated}
                limit={showAllPicked ? Infinity : PICKED_LIMIT}
                onRemove={(i) => toggle(draft[i])}
              />
            )}
            {draft.length > PICKED_LIMIT ? (
              <Button
                variant="link"
                size="xs"
                className="h-auto px-1"
                onClick={() => setShowAllPicked((v) => !v)}
              >
                {showAllPicked ? "Show fewer" : "Show all"}
              </Button>
            ) : null}
          </div>
          {draft.length > 1 ? (
            <Button variant="ghost" size="xs" onClick={() => setDraft([])}>
              Clear picks
            </Button>
          ) : null}
        </div>

        <Input
          autoFocus
          placeholder={`Find ${label.toLowerCase()}…`}
          value={narrow}
          onChange={(event) => setNarrow(event.target.value)}
          aria-label={`Narrow ${label} values by name`}
        />

        <div className="min-h-40 flex-1 overflow-auto rounded-md border">
          {failed ? (
            <p role="alert" className="p-4 text-sm text-destructive">
              The values could not be loaded. Close this window and try again.
            </p>
          ) : !options ? (
            <p className="p-4 text-sm text-muted-foreground">Loading values…</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-popover">
                {table.getHeaderGroups().map((group) => (
                  <tr key={group.id} className="border-b">
                    {group.headers.map((header) => {
                      const sorted = header.column.getIsSorted();
                      const numeric =
                        header.id === "here" || header.id === "overall";
                      return (
                        <th
                          key={header.id}
                          scope="col"
                          className={`px-2 py-1.5 font-medium text-muted-foreground ${numeric ? "text-right" : "text-left"} ${header.id === "pick" ? "w-8" : ""}`}
                          aria-sort={
                            sorted === "asc"
                              ? "ascending"
                              : sorted === "desc"
                                ? "descending"
                                : undefined
                          }
                        >
                          {header.column.getCanSort() ? (
                            <button
                              type="button"
                              className="inline-flex cursor-pointer items-center gap-1 hover:text-foreground"
                              onClick={header.column.getToggleSortingHandler()}
                            >
                              <table.FlexRender header={header} />
                              {sorted === "asc" ? (
                                <ArrowUp className="size-3" />
                              ) : null}
                              {sorted === "desc" ? (
                                <ArrowDown className="size-3" />
                              ) : null}
                            </button>
                          ) : (
                            <span className="sr-only">Picked</span>
                          )}
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody>
                {rows.slice(0, ROW_LIMIT).map((row) => {
                  const option = row.original;
                  const checked = draft.includes(option.id);
                  return (
                    <tr
                      key={row.id}
                      className={`cursor-pointer border-b last:border-b-0 hover:bg-muted/50 ${checked ? "bg-primary/5" : ""} ${option.here === 0 ? "text-muted-foreground" : ""}`}
                      onClick={(event) => {
                        const target = event.target as HTMLElement;
                        if (target.closest("[data-slot=checkbox]")) return;
                        toggle(option.id);
                      }}
                    >
                      <td className="px-2 py-1.5">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggle(option.id)}
                          aria-label={option.label}
                        />
                      </td>
                      <td className="px-2 py-1.5">{option.label}</td>
                      <td className="px-2 py-1.5 text-right">
                        <span className="inline-flex items-center gap-2">
                          <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-muted sm:inline-block">
                            <span
                              className="block h-full bg-primary/70"
                              style={{ width: `${(option.here / max) * 100}%` }}
                            />
                          </span>
                          <span className="w-8 tabular-nums">{option.here}</span>
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-right text-muted-foreground tabular-nums">
                        {option.overall}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {options && rows.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              No {label.toLowerCase()} matches “{narrow}”.
            </p>
          ) : null}
          {rows.length > ROW_LIMIT ? (
            <p className="border-t p-2 text-center text-xs text-muted-foreground">
              Showing the first {ROW_LIMIT} of {rows.length}. Narrow by name to
              find the rest.
            </p>
          ) : null}
        </div>

        <DialogFooter className="items-center sm:justify-between">
          <p className="min-w-0 flex-1 text-sm" aria-live="polite">
            This filter keeps{" "}
            <strong className="tabular-nums">{keep ?? "…"}</strong> of{" "}
            <span className="tabular-nums">{input}</span> publications
          </p>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                discard.current = true;
                close();
              }}
            >
              Discard changes
            </Button>
            <Button onClick={close}>Done</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
