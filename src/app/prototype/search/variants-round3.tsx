"use client";

// PROTOTYPE round 3: refinements of variant D.
// Kept from D: left-aligned filter column, centered modal picker, per-filter "removed" and
// "results" counts, TanStack results table. Dropped: timeline dots/lines, percentage bars,
// up/down arrows, "plan/step" wording. Added: drag handles, NOT (is none of / does not contain),
// disable-without-deleting with the result count with and without the filter.
//
// G, H and I share the panel and differ only in how a filter row looks:
//   G  Quiet text   values as plain text joined by "or", switch to disable, text button for NOT
//   H  Chip stack   values as chips stacked under an OR bracket, checkbox to disable, segmented NOT
//   I  Sentence     each filter reads as a sentence, eye icon to disable, click the verb for NOT

import { useMemo, useState, type ReactNode } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Eye, EyeOff, GripVertical, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { matchesAuthor, matchesQuery, PAGE_SIZE, type FacetKey, type Publication, type SearchFilters, type SortKey } from "./engine";
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
import { StagedFacetPicker } from "./staged-picker";
import type { OperatorStyle } from "./filter-parts";
import { localSort } from "./variants-round2";

export type FilterVariantProps = {
  filters: SearchFilters;
  pipeline: Pipeline;
  order: StepKey[];
  onSetText: (key: "q" | "author", value: string) => void;
  onApplyFacet: (key: FacetKey, values: string[], negated: boolean) => void;
  onSetNegated: (key: StepKey, negated: boolean) => void;
  onSetDisabled: (key: StepKey, disabled: boolean) => void;
  onSetOrder: (order: StepKey[]) => void;
  onRemove: (key: StepKey) => void;
  onClearAll: () => void;
  onSetSort: (sort: SortKey) => void;
  onSetPage: (page: number) => void;
};

const isFacet = (key: StepKey): key is FacetKey => (FACET_KEYS as string[]).includes(key);

/** What a row renderer gets. */
export type RowProps = {
  step: PipelineStep;
  labels: string[];
  handle: ReactNode;
  finalCount: number;
  onEdit: () => void;
  props: FilterVariantProps;
  editingText: boolean;
  textEditor: ReactNode;
};

function operator(step: PipelineStep): string {
  if (isFacet(step.key)) return step.negated ? "is none of" : "is any of";
  return step.negated ? "does not contain" : "contains";
}

// ───────────────────────────────────────────────────────────── shared panel

function SortableItem({ id, children }: { id: string; children: (handle: ReactNode, dragging: boolean) => ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label={`Reorder ${STEP_LABEL[id as StepKey]} filter. Press space, then arrow keys.`}
      className="-ml-1 cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
    >
      <GripVertical className="size-4" />
    </button>
  );
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`relative ${isDragging ? "z-10 rounded-lg bg-card shadow-lg ring-1 ring-border" : ""}`}
    >
      {children(handle, isDragging)}
    </li>
  );
}

function TextEditor({
  stepKey,
  value,
  negated,
  input,
  onCommit,
  onCancel,
}: {
  stepKey: "q" | "author";
  value: string;
  negated: boolean;
  input: Publication[];
  onCommit: (value: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const test = stepKey === "q" ? matchesQuery : matchesAuthor;
  const keep = draft.trim() ? input.filter((r) => test(r, draft) !== negated).length : input.length;
  return (
    <div className="space-y-1">
      <Input
        autoFocus
        value={draft}
        aria-label={`${STEP_LABEL[stepKey]} ${negated ? "does not contain" : "contains"}`}
        placeholder={stepKey === "q" ? "Title, author, topic, institution…" : "Author name…"}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => (draft.trim() ? onCommit(draft) : onCancel())}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            if (draft.trim()) onCommit(draft);
            else onCancel();
          }
          if (e.key === "Escape") onCancel();
        }}
      />
      <p className="text-xs text-muted-foreground" aria-live="polite">
        Keeps <span className="tabular-nums">{keep}</span> of {input.length}. Enter applies, Esc cancels.
      </p>
    </div>
  );
}

function AddFilterMenu({ pipeline, onPick }: { pipeline: Pipeline; onPick: (key: StepKey) => void }) {
  const [open, setOpen] = useState(false);
  const used = new Set(pipeline.steps.map((s) => s.key));
  const free = STEP_KEYS.filter((k) => !used.has(k));
  if (free.length === 0) return null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="outline" size="sm" />}>
        <Plus /> Add filter
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <Command>
          <CommandList>
            <CommandGroup>
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

type PanelOpts = { props: FilterVariantProps; Row: (p: RowProps) => ReactNode; gap?: string; operatorStyle?: OperatorStyle };

function FilterPanel({ props, Row, gap = "gap-1", operatorStyle }: PanelOpts) {
  const { pipeline, filters, order } = props;
  const [picker, setPicker] = useState<FacetKey | null>(null);
  const [text, setText] = useState<"q" | "author" | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = order.indexOf(active.id as StepKey);
    const to = order.indexOf(over.id as StepKey);
    if (from >= 0 && to >= 0) props.onSetOrder(arrayMove(order, from, to));
  }

  function open(key: StepKey) {
    if (isFacet(key)) setPicker(key);
    else setText(key);
  }

  const labelsOf = (step: PipelineStep) => (isFacet(step.key) ? step.summary.split(" or ") : [step.values[0] ?? ""]);
  const pendingNewText = text && !pipeline.steps.some((s) => s.key === text) ? text : null;

  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Filters</h2>
        {pipeline.steps.length > 0 ? (
          <Button variant="ghost" size="xs" onClick={props.onClearAll}>
            Clear all
          </Button>
        ) : null}
      </div>
      <div className="flex items-baseline justify-between border-b py-2 text-sm">
        <span className="text-muted-foreground">All publications</span>
        <span className="tabular-nums">{pipeline.all.length}</span>
      </div>

      <DndContext id="filters" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={pipeline.steps.map((s) => s.key)} strategy={verticalListSortingStrategy}>
          <ul className={`flex flex-col ${gap} py-2`} aria-label="Filters, applied top to bottom">
            {pipeline.steps.map((step) => (
              <SortableItem key={step.key} id={step.key}>
                {(handle) =>
                  Row({
                    step,
                    labels: labelsOf(step),
                    handle,
                    finalCount: pipeline.final.length,
                    onEdit: () => open(step.key),
                    props,
                    editingText: text === step.key,
                    textEditor:
                      text === step.key && !isFacet(step.key) ? (
                        <TextEditor
                          stepKey={step.key}
                          value={step.values[0] ?? ""}
                          negated={step.negated}
                          input={step.input}
                          onCommit={(v) => {
                            props.onSetText(step.key as "q" | "author", v);
                            setText(null);
                          }}
                          onCancel={() => setText(null)}
                        />
                      ) : null,
                  })
                }
              </SortableItem>
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {pendingNewText ? (
        <div className="mb-2 space-y-1 rounded-lg border border-dashed p-2">
          <p className="text-xs text-muted-foreground">{STEP_LABEL[pendingNewText]} contains</p>
          <TextEditor
            stepKey={pendingNewText}
            value=""
            negated={false}
            input={pipeline.final}
            onCommit={(v) => {
              props.onSetText(pendingNewText, v);
              setText(null);
            }}
            onCancel={() => setText(null)}
          />
        </div>
      ) : null}

      {pipeline.steps.length === 0 && !pendingNewText ? (
        <p className="py-2 text-sm text-muted-foreground">No filters yet.</p>
      ) : null}

      <div className="flex items-center justify-between gap-2 border-t pt-3">
        <AddFilterMenu pipeline={pipeline} onPick={open} />
        <span className="text-sm">
          <span className="text-muted-foreground">Results </span>
          <strong className="tabular-nums">{pipeline.final.length}</strong>
        </span>
      </div>

      {picker ? (
        <StagedFacetPicker
          key={picker}
          open
          negatable
          operatorStyle={operatorStyle}
          negated={pipeline.steps.find((s) => s.key === picker)?.negated ?? false}
          onOpenChange={(o) => !o && setPicker(null)}
          facet={picker}
          selected={filters[picker]}
          options={optionsForStep(pipeline, picker, filters[picker])}
          input={inputFor(pipeline, picker)}
          onApply={(values, negated) => props.onApplyFacet(picker, values, negated)}
        />
      ) : null}
    </div>
  );
}

export function Layout({ props, Row, gap, operatorStyle }: PanelOpts) {
  const { pipeline, filters } = props;
  const sorted = useMemo(() => localSort(pipeline.final, filters.sort, pipeline.all), [pipeline, filters.sort]);
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);
  const rows = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return (
    <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
      <aside className="lg:sticky lg:top-4 lg:self-start" aria-label="Filters">
        <FilterPanel props={props} Row={Row} gap={gap} operatorStyle={operatorStyle} />
      </aside>
      <section className="min-w-0 space-y-3">
        <ResultsTable
          records={rows}
          sort={filters.sort}
          onSetSort={props.onSetSort}
          caption={`${sorted.length} publications · page ${page} of ${pageCount}`}
        />
        <Pagination page={page} pageCount={pageCount} onPageChange={props.onSetPage} />
      </section>
    </div>
  );
}

function RemoveButton({ step, props }: { step: PipelineStep; props: FilterVariantProps }) {
  return (
    <Button variant="ghost" size="icon-xs" aria-label={`Delete ${step.label} filter`} onClick={() => props.onRemove(step.key)}>
      <X />
    </Button>
  );
}

// ───────────────────────────────────────────────────────────── G: Quiet text

const G_LIMIT = 3;

function RowG({ step, labels, handle, finalCount, onEdit, props, editingText, textEditor }: RowProps) {
  const shown = labels.slice(0, G_LIMIT);
  const more = labels.length - shown.length;
  return (
    <div className={`group flex gap-1 rounded-lg px-1 py-2 hover:bg-muted/40 ${step.disabled ? "opacity-60" : ""}`}>
      <div className="pt-0.5">{handle}</div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">{step.label}</span>
          <button
            type="button"
            className={`rounded px-1 text-xs underline decoration-dotted underline-offset-4 ${step.negated ? "text-destructive" : "text-muted-foreground"} hover:text-foreground`}
            title="Click to switch between include and exclude"
            onClick={() => props.onSetNegated(step.key, !step.negated)}
          >
            {operator(step)}
          </button>
          <span className="ml-auto flex items-center gap-1">
            <Switch
              size="sm"
              checked={!step.disabled}
              onCheckedChange={(on) => props.onSetDisabled(step.key, !on)}
              aria-label={`${step.label} filter ${step.disabled ? "off" : "on"}`}
            />
            <RemoveButton step={step} props={props} />
          </span>
        </div>

        {editingText ? (
          textEditor
        ) : (
          <button type="button" onClick={onEdit} className={`block w-full text-left text-sm leading-relaxed hover:underline ${step.disabled ? "line-through" : ""}`}>
            {shown.map((label, i) => (
              <span key={`${label}-${i}`}>
                {i > 0 ? <span className="text-muted-foreground"> or </span> : null}
                {isFacet(step.key) ? label : `“${label}”`}
              </span>
            ))}
            {more > 0 ? <span className="text-muted-foreground"> or {more} more…</span> : null}
          </button>
        )}

        <p className="text-xs text-muted-foreground tabular-nums">
          {step.disabled ? (
            <>
              Off · would remove {step.removes} · results {finalCount} → {step.finalIfToggled}
            </>
          ) : (
            <>
              −{step.removes} · {step.output.length} left · without it {step.finalIfToggled}
            </>
          )}
        </p>
      </div>
    </div>
  );
}

export function VariantG(props: FilterVariantProps) {
  return <Layout props={props} Row={RowG} />;
}

// ───────────────────────────────────────────────────────────── H: Chip stack

const H_LIMIT = 4;

function RowH({ step, labels, handle, onEdit, props, editingText, textEditor }: RowProps) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? labels : labels.slice(0, H_LIMIT);
  const more = labels.length - shown.length;
  const neg = step.negated;
  return (
    <div className={`rounded-lg border p-2 ${step.disabled ? "border-dashed bg-muted/30" : "bg-background"}`}>
      <div className="flex items-center gap-1.5">
        {handle}
        <Checkbox
          checked={!step.disabled}
          onCheckedChange={(on) => props.onSetDisabled(step.key, !on)}
          aria-label={`Apply ${step.label} filter`}
        />
        <span className={`text-sm font-medium ${step.disabled ? "text-muted-foreground" : ""}`}>{step.label}</span>
        <div className="ml-1 inline-flex rounded-md border p-px text-[11px]" role="radiogroup" aria-label={`${step.label} match`}>
          {[false, true].map((n) => (
            <button
              key={String(n)}
              type="button"
              role="radio"
              aria-checked={neg === n}
              onClick={() => props.onSetNegated(step.key, n)}
              className={`rounded px-1.5 py-0.5 ${neg === n ? (n ? "bg-destructive/10 text-destructive" : "bg-secondary") : "text-muted-foreground"}`}
            >
              {n ? (isFacet(step.key) ? "none of" : "excludes") : isFacet(step.key) ? "any of" : "contains"}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs whitespace-nowrap tabular-nums">
          {step.disabled ? (
            <span className="text-muted-foreground">would −{step.removes}</span>
          ) : (
            <>
              <span className="text-muted-foreground">{step.input.length} → </span>
              <strong>{step.output.length}</strong>
            </>
          )}
        </span>
        <RemoveButton step={step} props={props} />
      </div>

      <div className="mt-2 ml-7">
        {editingText ? (
          textEditor
        ) : (
          <div className={`flex gap-2 ${step.disabled ? "opacity-50" : ""}`}>
            {shown.length > 1 ? (
              <div className="flex w-5 shrink-0 flex-col items-center" aria-hidden>
                <span className="w-2 flex-1 rounded-tl border-t border-l border-muted-foreground/40" />
                <span className={`py-0.5 text-[10px] font-semibold uppercase ${neg ? "text-destructive" : "text-muted-foreground"}`}>
                  {neg ? "nor" : "or"}
                </span>
                <span className="w-2 flex-1 rounded-bl border-b border-l border-muted-foreground/40" />
              </div>
            ) : null}
            <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
              {shown.map((label, i) => (
                <button
                  key={`${label}-${i}`}
                  type="button"
                  onClick={onEdit}
                  className={`max-w-full truncate rounded-md px-2 py-0.5 text-left text-xs ${neg ? "bg-destructive/10 text-destructive" : "bg-secondary"}`}
                  title={label}
                >
                  {isFacet(step.key) ? label : `“${label}”`}
                </button>
              ))}
              {labels.length > H_LIMIT ? (
                <Button variant="link" size="xs" className="h-auto px-0" onClick={() => setExpanded((v) => !v)}>
                  {expanded ? "Show fewer" : `Show all ${labels.length}`}
                </Button>
              ) : null}
              {more === 0 && isFacet(step.key) ? (
                <Button variant="link" size="xs" className="h-auto px-0 text-muted-foreground" onClick={onEdit}>
                  Edit values
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function VariantH(props: FilterVariantProps) {
  return <Layout props={props} Row={RowH} gap="gap-2" />;
}

// ───────────────────────────────────────────────────────────── I: Sentence

function naturalList(labels: string[], word: string, limit: number, noun: string) {
  const shown = labels.slice(0, limit);
  const rest = labels.length - shown.length;
  const parts: ReactNode[] = [];
  shown.forEach((label, i) => {
    if (i > 0) parts.push(i === shown.length - 1 && rest === 0 ? ` ${word} ` : ", ");
    parts.push(<strong key={`${label}-${i}`} className="font-medium">{label}</strong>);
  });
  if (rest > 0) parts.push(` ${word} ${rest} other ${noun}${rest === 1 ? "" : "s"}`);
  return parts;
}

const NOUN: Record<StepKey, string> = {
  q: "text",
  author: "author",
  topics: "topic",
  countries: "country",
  institutions: "institution",
  oa: "status",
};

function RowI({ step, labels, handle, finalCount, onEdit, props, editingText, textEditor }: RowProps) {
  const facet = isFacet(step.key);
  const verb = facet ? (step.negated ? "is not" : "is") : step.negated ? "does not contain" : "contains";
  const joiner = step.negated && facet ? "nor" : "or";
  return (
    <div className="group flex gap-1 py-1.5">
      <div className="pt-0.5">{handle}</div>
      <div className={`min-w-0 flex-1 text-sm leading-relaxed ${step.disabled ? "text-muted-foreground" : ""}`}>
        {editingText ? (
          <>
            <p className="mb-1">
              {step.label} {verb}…
            </p>
            {textEditor}
          </>
        ) : (
          <p className={step.disabled ? "line-through decoration-muted-foreground/50" : ""}>
            {step.label}{" "}
            <button
              type="button"
              className={`rounded px-0.5 underline decoration-dotted underline-offset-4 hover:bg-muted ${step.negated ? "text-destructive" : ""}`}
              onClick={() => props.onSetNegated(step.key, !step.negated)}
              title="Click to negate"
            >
              {verb}
            </button>{" "}
            <button type="button" onClick={onEdit} className="text-left hover:underline">
              {facet ? naturalList(labels, joiner, 2, NOUN[step.key]) : <strong className="font-medium">“{labels[0]}”</strong>}
            </button>
          </p>
        )}
        <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
          {step.disabled
            ? `Hidden. Turning it on gives ${step.finalIfToggled} instead of ${finalCount}.`
            : `Removes ${step.removes}, ${step.output.length} left. Without it: ${step.finalIfToggled}.`}
        </p>
      </div>
      <div className="flex items-start gap-0.5 opacity-60 group-focus-within:opacity-100 group-hover:opacity-100">
        <Button
          variant="ghost"
          size="icon-xs"
          aria-pressed={!step.disabled}
          aria-label={step.disabled ? `Turn on ${step.label} filter` : `Turn off ${step.label} filter`}
          onClick={() => props.onSetDisabled(step.key, !step.disabled)}
        >
          {step.disabled ? <EyeOff /> : <Eye />}
        </Button>
        <RemoveButton step={step} props={props} />
      </div>
    </div>
  );
}

export function VariantI(props: FilterVariantProps) {
  return <Layout props={props} Row={RowI} gap="gap-0 divide-y" />;
}

