"use client";

// PROTOTYPE round 2. Three takes on "EXPLAIN-style narrowing" + "picks apply on close".
//   D  Plan rail     vertical funnel (top-down), Dialog picker, TanStack results table
//   E  Step inspector horizontal pipeline, click any step to see the rows at that point
//                    (kept or dropped there), Sheet picker, card list
//   F  EXPLAIN console literal bottom-up EXPLAIN ANALYZE text, inline editors that apply on
//                    collapse, dense TanStack table
// Shared: pipeline.ts (ordered steps + per-step counts), staged-picker.tsx, results-table.tsx.

import { useMemo, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Pencil, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { matchesAuthor, matchesQuery, PAGE_SIZE, type FacetKey, type Publication, type SearchFilters, type SearchView, type SortKey } from "./engine";
import { Pagination } from "./pagination";
import {
  FACET_KEYS,
  inputFor,
  optionsForStep,
  STEP_HINT,
  STEP_KEYS,
  STEP_LABEL,
  type Pipeline,
  type PipelineStep,
  type StepKey,
} from "./pipeline";
import { ResultsTable } from "./results-table";
import { InlineStagedEditor, StagedFacetPicker } from "./staged-picker";

export type PipelineVariantProps = {
  filters: SearchFilters;
  view: SearchView;
  pipeline: Pipeline;
  onSetTextFilter: (key: "q" | "author", value: string) => void;
  onSetFacetValues: (key: FacetKey, values: string[]) => void;
  onSetSort: (sort: SortKey) => void;
  onSetPage: (page: number) => void;
  onClearAll: () => void;
  onMoveStep: (key: StepKey, dir: -1 | 1) => void;
  onRemoveStep: (key: StepKey) => void;
};

const isFacet = (key: StepKey): key is FacetKey => (FACET_KEYS as string[]).includes(key);

function verb(key: StepKey) {
  return isFacet(key) ? "is any of" : "contains";
}

function OrList({ step }: { step: PipelineStep }) {
  if (!isFacet(step.key)) return <span className="font-medium">“{step.values[0]}”</span>;
  const labels = step.summary.split(" or ");
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {labels.map((label, i) => (
        <span key={`${label}-${i}`} className="inline-flex items-center gap-1">
          {i > 0 ? <span className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">or</span> : null}
          <Badge variant="secondary" className="h-auto max-w-56 justify-start py-0.5" title={label}>
            <span className="truncate">{label}</span>
          </Badge>
        </span>
      ))}
    </span>
  );
}

function Bar({ value, ghost, max }: { value: number; ghost?: number; max: number }) {
  const w = (n: number) => `${max === 0 ? 0 : (n / max) * 100}%`;
  return (
    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
      {ghost !== undefined ? <div className="absolute inset-y-0 left-0 bg-primary/20" style={{ width: w(ghost) }} /> : null}
      <div className="absolute inset-y-0 left-0 bg-primary" style={{ width: w(value) }} />
    </div>
  );
}

/** Text step editor: draft while typing with a live count, commits on Enter / blur, Escape reverts. */
function TextStepEditor({
  stepKey,
  value,
  input,
  onCommit,
  autoFocus,
  className,
}: {
  stepKey: "q" | "author";
  value: string;
  input: Publication[];
  onCommit: (value: string) => void;
  autoFocus?: boolean;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  const test = stepKey === "q" ? matchesQuery : matchesAuthor;
  const keep = draft.trim() ? input.filter((r) => test(r, draft)).length : input.length;
  const dirty = draft !== value;
  return (
    <div className={className}>
      <Input
        autoFocus={autoFocus}
        value={draft}
        aria-label={`${STEP_LABEL[stepKey]} contains`}
        placeholder={stepKey === "q" ? "Search title, author, topic, institution…" : "Author name contains…"}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => dirty && onCommit(draft)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onCommit(draft);
          if (e.key === "Escape") setDraft(value);
        }}
      />
      {dirty ? (
        <p className="mt-1 text-xs text-muted-foreground" aria-live="polite">
          Would keep <span className="tabular-nums">{keep}</span> of {input.length}. Press Enter to apply.
        </p>
      ) : null}
    </div>
  );
}

/** "+ Add step" menu listing the step kinds not yet in the pipeline. */
function AddStepMenu({
  pipeline,
  onPick,
  label = "Add step",
}: {
  pipeline: Pipeline;
  onPick: (key: StepKey) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const used = new Set(pipeline.steps.map((s) => s.key));
  const free = STEP_KEYS.filter((k) => !used.has(k));
  if (free.length === 0) return null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="outline" size="sm" />}>
        <Plus /> {label}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <Command>
          <CommandList>
            <CommandGroup heading={`Narrow the ${pipeline.final.length} remaining publications by…`}>
              {free.map((key) => (
                <CommandItem
                  key={key}
                  value={`${STEP_LABEL[key]} ${STEP_HINT[key]}`}
                  onSelect={() => {
                    setOpen(false);
                    onPick(key);
                  }}
                >
                  <div className="flex flex-col">
                    <span>{STEP_LABEL[key]}</span>
                    <span className="text-xs text-muted-foreground">{STEP_HINT[key]}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Shared state for "which facet picker is open" and "which new text step is pending". */
function useEditing(props: PipelineVariantProps) {
  const [picker, setPicker] = useState<FacetKey | null>(null);
  const [pendingText, setPendingText] = useState<"q" | "author" | null>(null);

  function open(key: StepKey) {
    if (isFacet(key)) setPicker(key);
    else setPendingText(key);
  }

  const pickerEl = picker ? (
    <StagedFacetPicker
      key={picker}
      open
      onOpenChange={(o) => !o && setPicker(null)}
      facet={picker}
      selected={props.filters[picker]}
      options={optionsForStep(props.pipeline, picker, props.filters[picker])}
      input={inputFor(props.pipeline, picker)}
      onApply={(values) => props.onSetFacetValues(picker, values)}
    />
  ) : null;

  return { picker, setPicker, pendingText, setPendingText, open, pickerEl };
}

function StepActions({
  step,
  index,
  count,
  props,
  onEdit,
  horizontal = false,
}: {
  step: PipelineStep;
  index: number;
  count: number;
  props: PipelineVariantProps;
  onEdit?: () => void;
  horizontal?: boolean;
}) {
  const Prev = horizontal ? ArrowLeft : ArrowUp;
  const Next = horizontal ? ArrowRight : ArrowDown;
  return (
    <div className="flex items-center gap-0.5">
      {onEdit ? (
        <Button variant="ghost" size="icon-xs" aria-label={`Edit ${step.label}`} onClick={onEdit}>
          <Pencil />
        </Button>
      ) : null}
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={`Move ${step.label} earlier`}
        disabled={index === 0}
        onClick={() => props.onMoveStep(step.key, -1)}
      >
        <Prev />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={`Move ${step.label} later`}
        disabled={index === count - 1}
        onClick={() => props.onMoveStep(step.key, 1)}
      >
        <Next />
      </Button>
      <Button variant="ghost" size="icon-xs" aria-label={`Remove ${step.label}`} onClick={() => props.onRemoveStep(step.key)}>
        <X />
      </Button>
    </div>
  );
}

// ───────────────────────────────────────────────────────────── D: Plan rail

export function VariantD(props: PipelineVariantProps) {
  const { pipeline, view, filters } = props;
  const editing = useEditing(props);
  const all = pipeline.all.length;

  return (
    <div className="grid gap-4 lg:grid-cols-[400px_1fr]">
      <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start" aria-label="Filter plan">
        <div className="rounded-xl border bg-card p-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Plan</h2>
            {pipeline.steps.length > 0 ? (
              <Button variant="ghost" size="sm" onClick={props.onClearAll}>
                Clear all
              </Button>
            ) : null}
          </div>

          <ol className="space-y-0">
            <li className="space-y-1 pb-3">
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium">All publications</span>
                <span className="tabular-nums">{all}</span>
              </div>
              <Bar value={all} max={all} />
            </li>

            {pipeline.steps.map((step, i) => {
              const removed = step.input.length - step.output.length;
              const editingText = !isFacet(step.key) && editing.pendingText === step.key;
              return (
                <li key={step.key} className="relative ml-2 border-l-2 border-primary/30 pb-3 pl-4">
                  <span className="absolute top-2 -left-[5px] size-2 rounded-full bg-primary" aria-hidden />
                  <div className="flex items-start justify-between gap-2">
                    <p className="pt-0.5 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{step.label}</span> {verb(step.key)}
                    </p>
                    <StepActions
                      step={step}
                      index={i}
                      count={pipeline.steps.length}
                      props={props}
                      onEdit={() => (isFacet(step.key) ? editing.setPicker(step.key) : editing.setPendingText(step.key))}
                    />
                  </div>
                  {editingText ? (
                    <TextStepEditor
                      autoFocus
                      className="mt-1"
                      stepKey={step.key as "q" | "author"}
                      value={step.values[0] ?? ""}
                      input={step.input}
                      onCommit={(v) => {
                        props.onSetTextFilter(step.key as "q" | "author", v);
                        editing.setPendingText(null);
                      }}
                    />
                  ) : (
                    <div className="mt-1 text-sm">
                      <OrList step={step} />
                    </div>
                  )}
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <Bar value={step.output.length} ghost={step.input.length} max={all} />
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {step.input.length} → <strong className="text-foreground">{step.output.length}</strong>
                    </span>
                  </div>
                  {removed > 0 ? <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">−{removed} removed here</p> : null}
                </li>
              );
            })}

            {editing.pendingText && !pipeline.steps.some((s) => s.key === editing.pendingText) ? (
              <li className="relative ml-2 border-l-2 border-dashed border-primary/30 pb-3 pl-4">
                <p className="mb-1 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{STEP_LABEL[editing.pendingText]}</span> contains
                </p>
                <TextStepEditor
                  autoFocus
                  stepKey={editing.pendingText}
                  value=""
                  input={pipeline.final}
                  onCommit={(v) => {
                    props.onSetTextFilter(editing.pendingText!, v);
                    editing.setPendingText(null);
                  }}
                />
              </li>
            ) : null}
          </ol>

          <div className="flex items-center justify-between gap-2 border-t pt-3">
            <AddStepMenu pipeline={pipeline} onPick={editing.open} />
            <span className="text-sm">
              <span className="text-muted-foreground">Result </span>
              <strong className="tabular-nums">{view.total}</strong>
            </span>
          </div>
        </div>
        <p className="px-1 text-xs text-muted-foreground">
          Each step only sees what the step above let through. Order changes the numbers per step, never the final result.
        </p>
      </aside>

      <section className="min-w-0 space-y-3">
        <ResultsTable
          records={view.records}
          sort={filters.sort}
          onSetSort={props.onSetSort}
          caption={`${view.total} publications · page ${view.page} of ${view.pageCount}`}
        />
        <Pagination page={view.page} pageCount={view.pageCount} onPageChange={props.onSetPage} />
      </section>

      {editing.pickerEl}
    </div>
  );
}

// ───────────────────────────────────────────────────────────── E: Step inspector

function localSort(records: Publication[], sort: SortKey, all: Publication[]): Publication[] {
  if (sort === "relevance") {
    const rank = new Map(all.map((r, i) => [r.id, i]));
    return [...records].sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
  }
  if (sort === "date") return [...records].sort((a, b) => b.date.localeCompare(a.date));
  return [...records].sort((a, b) => b.citations - a.citations);
}

function CompactCard({ record, dropped }: { record: Publication; dropped?: boolean }) {
  const dk = record.institutions.filter((i) => i.country === "DK");
  return (
    <Card className={dropped ? "opacity-70" : undefined}>
      <CardContent className="space-y-1.5">
        <div className="flex items-start justify-between gap-3">
          <a href={`#${record.id}`} className="font-medium leading-snug hover:underline">
            {record.title}
          </a>
          <span className="shrink-0 text-right text-xs text-muted-foreground tabular-nums">
            {record.citations} cit.
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {record.date} · {record.type} · {record.authors.slice(0, 3).map((a) => a.name).join(", ")}
          {record.authors.length > 3 ? ` +${record.authors.length - 3}` : ""}
        </p>
        {dk.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            {dk.slice(0, 2).map((i) => i.name).join(", ")}
            {record.institutions.length > 2 ? ` +${record.institutions.length - Math.min(2, dk.length)} more` : ""}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-1">
          <Badge variant={record.isOa ? "default" : "outline"}>{record.oaStatus}</Badge>
          {record.topics.slice(0, 3).map((t) => (
            <Badge key={t.id} variant="secondary" className="h-auto py-0.5">
              {t.name}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function VariantE(props: PipelineVariantProps) {
  const { pipeline, filters } = props;
  const editing = useEditing(props);
  const [inspectKey, setInspectKey] = useState<StepKey | "all" | null>(null);
  const [mode, setMode] = useState<"kept" | "dropped">("kept");
  const [page, setPage] = useState(1);

  const steps = pipeline.steps;
  const inspected =
    inspectKey === "all" ? null : steps.find((s) => s.key === inspectKey) ?? steps[steps.length - 1] ?? null;
  const isLast = inspected === null ? steps.length === 0 : inspected === steps[steps.length - 1];

  const rows = useMemo(() => {
    if (!inspected) return pipeline.all;
    if (mode === "kept") return inspected.output;
    const kept = new Set(inspected.output.map((r) => r.id));
    return inspected.input.filter((r) => !kept.has(r.id));
  }, [inspected, mode, pipeline.all]);

  const sorted = useMemo(() => localSort(rows, filters.sort, pipeline.all), [rows, filters.sort, pipeline.all]);
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function inspect(key: StepKey | "all") {
    setInspectKey(key);
    setPage(1);
    if (key === "all") setMode("kept");
  }

  const node = "flex min-w-40 flex-col gap-1 rounded-lg border bg-card p-2.5 text-left text-sm transition-colors";
  const nodeActive = "border-primary ring-2 ring-primary/30";

  return (
    <div className="space-y-4">
      <nav aria-label="Filter pipeline" className="overflow-x-auto rounded-xl border bg-muted/30 p-3">
        <ol className="flex items-stretch gap-2">
          <li>
            <button
              type="button"
              className={`${node} ${inspected === null ? nodeActive : "hover:border-primary/50"}`}
              aria-current={inspected === null ? "step" : undefined}
              onClick={() => inspect("all")}
            >
              <span className="text-xs text-muted-foreground">Start</span>
              <span className="font-medium">All publications</span>
              <span className="text-2xl font-semibold tabular-nums">{pipeline.all.length}</span>
            </button>
          </li>
          {steps.map((step, i) => {
            const active = inspected?.key === step.key;
            return (
              <li key={step.key} className="flex items-stretch gap-2">
                <span className="flex items-center text-muted-foreground" aria-hidden>
                  <ArrowRight className="size-4" />
                </span>
                <div className={`${node} max-w-72 ${active ? nodeActive : ""}`}>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs text-muted-foreground">
                      {step.label} {verb(step.key)}
                    </span>
                    <StepActions
                      horizontal
                      step={step}
                      index={i}
                      count={steps.length}
                      props={props}
                      onEdit={() => (isFacet(step.key) ? editing.setPicker(step.key) : editing.setPendingText(step.key))}
                    />
                  </div>
                  <button
                    type="button"
                    className="flex flex-col gap-1 text-left"
                    aria-current={active ? "step" : undefined}
                    onClick={() => inspect(step.key)}
                  >
                    <span className="line-clamp-2 font-medium">{step.summary}</span>
                    <span className="flex items-baseline gap-2">
                      <span className="text-2xl font-semibold tabular-nums">{step.output.length}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        of {step.input.length} · −{step.input.length - step.output.length}
                      </span>
                    </span>
                  </button>
                  {editing.pendingText === step.key ? (
                    <TextStepEditor
                      autoFocus
                      stepKey={step.key as "q" | "author"}
                      value={step.values[0] ?? ""}
                      input={step.input}
                      onCommit={(v) => {
                        props.onSetTextFilter(step.key as "q" | "author", v);
                        editing.setPendingText(null);
                      }}
                    />
                  ) : null}
                </div>
              </li>
            );
          })}
          <li className="flex items-center gap-2">
            <span className="text-muted-foreground" aria-hidden>
              <ArrowRight className="size-4" />
            </span>
            <div className="flex min-w-56 flex-col gap-2">
              {editing.pendingText && !steps.some((s) => s.key === editing.pendingText) ? (
                <TextStepEditor
                  autoFocus
                  stepKey={editing.pendingText}
                  value=""
                  input={pipeline.final}
                  onCommit={(v) => {
                    props.onSetTextFilter(editing.pendingText!, v);
                    editing.setPendingText(null);
                  }}
                />
              ) : null}
              <div className="flex gap-2">
                <AddStepMenu pipeline={pipeline} onPick={editing.open} label="Narrow" />
                {steps.length > 0 ? (
                  <Button variant="ghost" size="sm" onClick={props.onClearAll}>
                    Clear
                  </Button>
                ) : null}
              </div>
            </div>
          </li>
        </ol>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm">
          {inspected === null ? (
            <>Showing all <strong>{pipeline.all.length}</strong> publications</>
          ) : (
            <>
              Inspecting after <strong>{inspected.label}</strong>:{" "}
              <strong className="tabular-nums">{rows.length}</strong> {mode === "kept" ? "kept" : "dropped at this step"}
              {!isLast ? <span className="text-muted-foreground"> · not the final result</span> : null}
            </>
          )}
        </p>
        <div className="flex items-center gap-2">
          {inspected ? (
            <div className="inline-flex rounded-lg border p-0.5" role="group" aria-label="Rows to show">
              {(["kept", "dropped"] as const).map((m) => (
                <Button
                  key={m}
                  size="xs"
                  variant={mode === m ? "secondary" : "ghost"}
                  aria-pressed={mode === m}
                  onClick={() => {
                    setMode(m);
                    setPage(1);
                  }}
                >
                  {m === "kept" ? "Kept" : "Dropped here"}
                </Button>
              ))}
            </div>
          ) : null}
          <SortButtons sort={filters.sort} onSetSort={props.onSetSort} />
        </div>
      </div>

      <div className="grid gap-2">
        {pageRows.length === 0 ? (
          <p className="rounded-xl border p-8 text-center text-muted-foreground">Nothing here.</p>
        ) : null}
        {pageRows.map((r) => (
          <CompactCard key={r.id} record={r} dropped={mode === "dropped"} />
        ))}
      </div>
      <Pagination page={safePage} pageCount={pageCount} onPageChange={setPage} />

      {editing.picker ? (
        <StagedFacetPicker
          key={editing.picker}
          container="sheet"
          open
          onOpenChange={(o) => !o && editing.setPicker(null)}
          facet={editing.picker}
          selected={filters[editing.picker]}
          options={optionsForStep(pipeline, editing.picker, filters[editing.picker])}
          input={inputFor(pipeline, editing.picker)}
          onApply={(values) => props.onSetFacetValues(editing.picker!, values)}
        />
      ) : null}
    </div>
  );
}

function SortButtons({ sort, onSetSort }: { sort: SortKey; onSetSort: (s: SortKey) => void }) {
  const labels: Record<SortKey, string> = { relevance: "Relevance", date: "Newest", citations: "Most cited" };
  return (
    <div className="inline-flex rounded-lg border p-0.5" role="group" aria-label="Sort">
      {(Object.keys(labels) as SortKey[]).map((s) => (
        <Button key={s} size="xs" variant={sort === s ? "secondary" : "ghost"} aria-pressed={sort === s} onClick={() => onSetSort(s)}>
          {labels[s]}
        </Button>
      ))}
    </div>
  );
}

// ───────────────────────────────────────────────────────────── F: EXPLAIN console

export function VariantF(props: PipelineVariantProps) {
  // min-w-0 wrapper keeps the console's own horizontal scroll from widening the page.
  const { pipeline, view, filters } = props;
  const [openKey, setOpenKey] = useState<StepKey | null>(null);
  const [adding, setAdding] = useState<StepKey | null>(null);
  const steps = pipeline.steps;

  // Bottom-up like real EXPLAIN: Limit at the top, Seq Scan at the bottom.
  const reversed = [...steps].reverse();
  const depthOf = (i: number) => 2 + (steps.length - 1 - i); // Limit=0, Sort=1, last filter=2 …
  const indent = (d: number) => ({ paddingLeft: `${d * 1.5}rem` });

  function editorFor(key: StepKey, input: Publication[], isNew: boolean) {
    const close = () => (isNew ? setAdding(null) : setOpenKey(null));
    if (isFacet(key)) {
      return (
        <InlineStagedEditor
          facet={key}
          selected={filters[key]}
          options={optionsForStep(pipeline, key, filters[key])}
          input={input}
          onApply={(values) => props.onSetFacetValues(key, values)}
          onClose={close}
        />
      );
    }
    return (
      <div className="rounded-lg border bg-background p-3 font-sans">
        <TextStepEditor
          autoFocus
          stepKey={key}
          value={filters[key]}
          input={input}
          onCommit={(v) => {
            props.onSetTextFilter(key, v);
            close();
          }}
        />
      </div>
    );
  }

  const line = "flex w-full items-baseline gap-3 rounded px-2 py-0.5 text-left";
  const arrow = <span className="text-muted-foreground">-&gt;</span>;

  return (
    <div className="min-w-0 space-y-4">
      <div className="overflow-x-auto rounded-xl border bg-zinc-950 p-4 font-mono text-[13px] leading-6 text-zinc-100 dark:bg-zinc-900">
        <div className="mb-2 flex items-center justify-between font-sans">
          <span className="text-xs tracking-wide text-zinc-400 uppercase">Explain analyze</span>
          <div className="flex gap-2">
            <AddFilterInline steps={steps} onPick={(k) => { setOpenKey(null); setAdding(k); }} />
            {steps.length > 0 ? (
              <Button size="xs" variant="ghost" className="text-zinc-300 hover:bg-zinc-800 hover:text-white" onClick={props.onClearAll}>
                Clear
              </Button>
            ) : null}
          </div>
        </div>

        <div className={line} style={indent(0)}>
          <span className="text-sky-300">Limit</span>
          <span className="text-zinc-400">page {view.page}/{view.pageCount}</span>
          <span className="ml-auto text-zinc-400">(rows={view.records.length})</span>
        </div>
        <div className={line} style={indent(1)}>
          {arrow}
          <span className="text-sky-300">Sort</span>
          <span className="text-zinc-400">key: {filters.sort}</span>
          <span className="ml-auto text-zinc-400">(rows={view.total})</span>
        </div>

        {adding ? (
          <div className="my-1" style={indent(2)}>
            <div className={`${line} text-amber-300`}>
              {arrow} Filter: {STEP_LABEL[adding].toLowerCase()} {isFacet(adding) ? "IN (…)" : "~ '…'"}
              <span className="ml-auto text-zinc-400">(new, input rows={pipeline.final.length})</span>
            </div>
            <div className="mt-1 text-foreground">{editorFor(adding, pipeline.final, true)}</div>
          </div>
        ) : null}

        {reversed.map((step) => {
          const i = steps.indexOf(step);
          const open = openKey === step.key;
          const removed = step.input.length - step.output.length;
          const predicate = isFacet(step.key)
            ? `${STEP_LABEL[step.key].toLowerCase()} IN (${step.summary.split(" or ").map((s) => `'${s}'`).join(", ")})`
            : `${STEP_LABEL[step.key].toLowerCase()} ~ '${step.values[0]}'`;
          return (
            <div key={step.key} style={indent(depthOf(i))}>
              <div className="group flex items-baseline gap-2">
                <button
                  type="button"
                  aria-expanded={open}
                  className={`${line} min-w-0 flex-1 hover:bg-zinc-800 ${open ? "bg-zinc-800" : ""}`}
                  onClick={() => {
                    setAdding(null);
                    setOpenKey(open ? null : step.key);
                  }}
                >
                  {arrow}
                  <span className="text-emerald-300">Filter:</span>
                  <span className="min-w-0 truncate">{predicate}</span>
                  <span className="ml-auto shrink-0 text-zinc-400">
                    (rows={step.output.length}
                    <span className={removed > 0 ? "text-rose-300" : ""}> removed={removed}</span>)
                  </span>
                </button>
                <div className="flex opacity-60 group-focus-within:opacity-100 group-hover:opacity-100">
                  <Button size="icon-xs" variant="ghost" className="text-zinc-300 hover:bg-zinc-800" aria-label={`Run ${step.label} later`} disabled={i === steps.length - 1} onClick={() => props.onMoveStep(step.key, 1)}>
                    <ArrowUp />
                  </Button>
                  <Button size="icon-xs" variant="ghost" className="text-zinc-300 hover:bg-zinc-800" aria-label={`Run ${step.label} earlier`} disabled={i === 0} onClick={() => props.onMoveStep(step.key, -1)}>
                    <ArrowDown />
                  </Button>
                  <Button size="icon-xs" variant="ghost" className="text-zinc-300 hover:bg-zinc-800" aria-label={`Remove ${step.label}`} onClick={() => props.onRemoveStep(step.key)}>
                    <X />
                  </Button>
                </div>
              </div>
              {open ? <div className="my-1 text-foreground">{editorFor(step.key, step.input, false)}</div> : null}
            </div>
          );
        })}

        <div className={line} style={indent(2 + steps.length)}>
          {arrow}
          <span className="text-sky-300">Seq Scan on publications</span>
          <span className="ml-auto text-zinc-400">(rows={pipeline.all.length})</span>
        </div>
        <p className="mt-3 font-sans text-xs text-zinc-400">
          Read bottom-up. Click a Filter line to edit it; edits apply when you press Done.
        </p>
      </div>

      <ResultsTable
        dense
        records={view.records}
        sort={filters.sort}
        onSetSort={props.onSetSort}
        caption={`${view.total} rows`}
      />
      <Pagination page={view.page} pageCount={view.pageCount} onPageChange={props.onSetPage} />
    </div>
  );
}

function AddFilterInline({ steps, onPick }: { steps: PipelineStep[]; onPick: (key: StepKey) => void }) {
  const used = new Set(steps.map((s) => s.key));
  const free = STEP_KEYS.filter((k) => !used.has(k));
  const [open, setOpen] = useState(false);
  if (free.length === 0) return null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button size="xs" variant="secondary" />}>
        <Plus /> Filter
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 gap-0 p-1">
        {free.map((k) => (
          <button
            key={k}
            type="button"
            className="rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
            onClick={() => {
              setOpen(false);
              onPick(k);
            }}
          >
            {STEP_LABEL[k]}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
