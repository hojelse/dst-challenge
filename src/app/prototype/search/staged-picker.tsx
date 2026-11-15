"use client";

// PROTOTYPE (round 2): facet value picker with a staged draft.
// Ticking values only edits a draft. Closing the modal (Done, X, Escape, backdrop)
// applies the draft. "Discard" is the only way out without applying.
// The value list is a TanStack Table: sortable by name / count at this step / overall.

import { useMemo, useRef, useState } from "react";
import {
  columnFilteringFeature,
  createColumnHelper,
  createFilteredRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { FacetKey, Publication } from "./engine";
import { previewKeep, STEP_HINT, STEP_LABEL, type StepOption } from "./pipeline";

const features = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  globalFilteringFeature,
  sortedRowModel: createSortedRowModel(),
  filteredRowModel: createFilteredRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic },
  filterFns: { includesString: filterFn_includesString },
});

const col = createColumnHelper<typeof features, StepOption>();

type PickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  facet: FacetKey;
  options: StepOption[];
  selected: string[];
  /** Rows reaching this step; used for the live "keeps N of M" preview. */
  input: Publication[];
  onApply: (values: string[]) => void;
  container?: "dialog" | "sheet";
};

export function StagedFacetPicker(props: PickerProps) {
  // Mount the body only while open so the draft re-initialises from `selected` each time.
  const Shell = props.container === "sheet" ? SheetShell : DialogShell;
  return <Shell {...props} />;
}

function useStaged(props: PickerProps) {
  const [draft, setDraft] = useState<string[]>(props.selected);
  const discard = useRef(false);

  function handleOpenChange(next: boolean) {
    if (!next) {
      if (!discard.current) props.onApply(draft);
      discard.current = false;
    }
    props.onOpenChange(next);
  }

  function discardAndClose() {
    discard.current = true;
    handleOpenChange(false);
  }

  return { draft, setDraft, handleOpenChange, discardAndClose };
}

function DialogShell(props: PickerProps) {
  return props.open ? <DialogBody {...props} /> : null;
}

function DialogBody(props: PickerProps) {
  const staged = useStaged(props);
  return (
    <Dialog open onOpenChange={staged.handleOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-3 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{STEP_LABEL[props.facet]} is any of…</DialogTitle>
          <DialogDescription>{STEP_HINT[props.facet]} Changes apply when you close this window.</DialogDescription>
        </DialogHeader>
        <PickerBody {...props} draft={staged.draft} setDraft={staged.setDraft} />
        <DialogFooter className="items-center sm:justify-between">
          <Preview {...props} draft={staged.draft} />
          <div className="flex gap-2">
            <Button variant="ghost" onClick={staged.discardAndClose}>
              Discard changes
            </Button>
            <Button onClick={() => staged.handleOpenChange(false)}>Done</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SheetShell(props: PickerProps) {
  return props.open ? <SheetBody {...props} /> : null;
}

function SheetBody(props: PickerProps) {
  const staged = useStaged(props);
  return (
    <Sheet open onOpenChange={staged.handleOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-3 sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{STEP_LABEL[props.facet]} is any of…</SheetTitle>
          <SheetDescription>{STEP_HINT[props.facet]} Changes apply when you close this panel.</SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-3 px-4">
          <PickerBody {...props} draft={staged.draft} setDraft={staged.setDraft} />
        </div>
        <SheetFooter className="gap-3">
          <Preview {...props} draft={staged.draft} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={staged.discardAndClose}>
              Discard changes
            </Button>
            <Button onClick={() => staged.handleOpenChange(false)}>Done</Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Preview({ input, facet, draft, selected }: PickerProps & { draft: string[] }) {
  const keep = previewKeep(input, facet, draft);
  const now = previewKeep(input, facet, selected);
  const pct = input.length === 0 ? 0 : (keep / input.length) * 100;
  const changed = draft.length !== selected.length || draft.some((id) => !selected.includes(id));
  return (
    <div className="min-w-0 flex-1 space-y-1 text-sm" aria-live="polite">
      <p>
        This step keeps <strong className="tabular-nums">{keep}</strong> of{" "}
        <span className="tabular-nums">{input.length}</span> publications
        {changed ? <span className="text-muted-foreground"> (currently {now})</span> : null}
      </p>
      <div className="h-1.5 w-full max-w-64 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function PickerBody({
  facet,
  options,
  input,
  draft,
  setDraft,
}: PickerProps & { draft: string[]; setDraft: (next: string[] | ((prev: string[]) => string[])) => void }) {
  const toggle = (id: string) =>
    setDraft((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));

  const columns = useMemo(
    () =>
      col.columns([
        col.display({ id: "pick", header: "", enableSorting: false }),
        col.accessor("label", { header: STEP_LABEL[facet], sortFn: "alphanumeric" }),
        col.accessor("stepCount", { header: "At this step", sortFn: "basic", sortDescFirst: true }),
        col.accessor("totalCount", { header: "Overall", sortFn: "basic", sortDescFirst: true }),
      ]),
    [facet]
  );

  const table = useTable({
    features,
    columns,
    data: options,
    getRowId: (row) => row.id,
    globalFilterFn: "includesString",
    initialState: { sorting: [{ id: "stepCount", desc: true }], globalFilter: "" },
  });

  const labelOf = new Map(options.map((o) => [o.id, o.label]));
  const max = Math.max(1, input.length);

  return (
    <>
      <div className="flex min-h-7 flex-wrap items-center gap-1.5 text-sm">
        {draft.length === 0 ? (
          <span className="text-muted-foreground">Nothing picked: this step lets everything through.</span>
        ) : (
          draft.map((id, i) => (
            <span key={id} className="inline-flex items-center gap-1.5">
              {i > 0 ? <span className="text-xs font-medium text-muted-foreground uppercase">or</span> : null}
              <Badge variant="secondary" className="h-6 gap-1 pr-1">
                {labelOf.get(id) ?? id}
                <button
                  type="button"
                  aria-label={`Remove ${labelOf.get(id) ?? id}`}
                  className="rounded-full p-0.5 hover:bg-background"
                  onClick={() => toggle(id)}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            </span>
          ))
        )}
      </div>

      <Input
        autoFocus
        placeholder={`Find ${STEP_LABEL[facet].toLowerCase()}…`}
        value={(table.state.globalFilter as string) ?? ""}
        onChange={(e) => table.setGlobalFilter(e.target.value)}
        aria-label={`Filter ${STEP_LABEL[facet]} values`}
      />

      <div className="min-h-0 flex-1 overflow-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-background">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b">
                {hg.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  const numeric = header.id !== "label";
                  return (
                    <th
                      key={header.id}
                      className={`px-2 py-1.5 font-medium text-muted-foreground ${numeric ? "text-right" : "text-left"} ${header.id === "pick" ? "w-8" : ""}`}
                      aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                    >
                      {header.column.getCanSort() ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 hover:text-foreground"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          <table.FlexRender header={header} />
                          {sorted === "asc" ? <ArrowUp className="size-3" /> : null}
                          {sorted === "desc" ? <ArrowDown className="size-3" /> : null}
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
            {table.getRowModel().rows.map((row) => {
              const o = row.original;
              const checked = draft.includes(o.id);
              return (
                <tr
                  key={row.id}
                  className={`cursor-pointer border-b last:border-b-0 hover:bg-muted/50 ${checked ? "bg-primary/5" : ""} ${o.stepCount === 0 ? "text-muted-foreground" : ""}`}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("[data-slot=checkbox]")) return;
                    toggle(o.id);
                  }}
                >
                  <td className="px-2 py-1.5">
                    <Checkbox checked={checked} onCheckedChange={() => toggle(o.id)} aria-label={o.label} />
                  </td>
                  <td className="px-2 py-1.5">{o.label}</td>
                  <td className="px-2 py-1.5 text-right">
                    <span className="inline-flex items-center gap-2">
                      <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-muted sm:inline-block">
                        <span className="block h-full bg-primary/70" style={{ width: `${(o.stepCount / max) * 100}%` }} />
                      </span>
                      <span className="w-8 tabular-nums">{o.stepCount}</span>
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{o.totalCount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Inline (non-modal) variant: same staged draft, applied when the editor collapses. */
export function InlineStagedEditor(
  props: Omit<PickerProps, "open" | "onOpenChange" | "container"> & { onClose: () => void }
) {
  const [draft, setDraft] = useState<string[]>(props.selected);
  const full: PickerProps = { ...props, open: true, onOpenChange: () => {} };
  return (
    <div className="flex max-h-[28rem] flex-col gap-2 rounded-lg border bg-background p-3 font-sans">
      <PickerBody {...full} draft={draft} setDraft={setDraft} />
      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2">
        <Preview {...full} draft={draft} />
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={props.onClose}>
            Discard changes
          </Button>
          <Button
            size="sm"
            onClick={() => {
              props.onApply(draft);
              props.onClose();
            }}
          >
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
