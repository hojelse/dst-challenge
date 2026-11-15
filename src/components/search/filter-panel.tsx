"use client";

// The Filters column: the narrowing from all Publications, through Search
// and each Filter in order, down to the results (ADR-0003).

import { useState, type ReactNode } from "react";
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
import { Eye, EyeOff, GripVertical, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  FILTER_HINT,
  FILTER_KEYS,
  FILTER_LABEL,
  type FilterKey,
  type FilterState,
  type SearchState,
} from "@/lib/search-params";
import type { FilterResult, SearchResult } from "@/server/search/service";
import { OperatorControl, ValueList } from "./filter-parts";
import { FilterPicker } from "./filter-picker";

/** Values shown in a row before "or N more…". */
const VALUE_LIMIT = 3;

function SortableItem({
  id,
  children,
}: {
  id: FilterKey;
  children: (handle: ReactNode) => ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label={`Reorder ${FILTER_LABEL[id]} filter. Press space, then arrow keys.`}
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
      {children(handle)}
    </li>
  );
}

function FilterRow({
  filter,
  handle,
  onEdit,
  onChange,
  onRemove,
}: {
  filter: FilterResult;
  handle: ReactNode;
  onEdit: () => void;
  onChange: (patch: Partial<FilterState>) => void;
  onRemove: () => void;
}) {
  const label = FILTER_LABEL[filter.key];
  const off = filter.off;
  return (
    <div className="rounded-lg px-1 py-2 hover:bg-muted/40">
      <div className="flex items-start gap-1.5">
        {handle}
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 pt-0.5">
          <span
            className={`text-sm font-medium ${off ? "text-muted-foreground" : ""}`}
          >
            {label}
          </span>
          <OperatorControl
            negated={filter.negated}
            onChange={(negated) => onChange({ negated })}
            label={label}
          />
        </span>
        <span className="flex shrink-0 items-center">
          <Button
            variant="ghost"
            size="icon-xs"
            aria-pressed={!off}
            aria-label={
              off ? `Turn on ${label} filter` : `Turn off ${label} filter`
            }
            title={off ? "Turn on" : "Turn off"}
            onClick={() => onChange({ off: !off })}
          >
            {off ? <EyeOff /> : <Eye />}
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`Delete ${label} filter`}
            title="Delete"
            onClick={onRemove}
          >
            <X />
          </Button>
        </span>
      </div>

      <div className="mt-1 ml-7 space-y-0.5">
        <button
          type="button"
          onClick={onEdit}
          title="Edit values"
          className={`block w-full cursor-pointer rounded text-left text-sm hover:underline hover:decoration-muted-foreground/50 ${off ? "line-through decoration-muted-foreground/60" : ""}`}
        >
          <ValueList
            labels={filter.values.map((v) => v.label)}
            negated={filter.negated}
            limit={VALUE_LIMIT}
            muted={off}
          />
        </button>
        <p className="text-xs text-muted-foreground tabular-nums">
          {off ? (
            <>Off · {filter.input} pass through</>
          ) : (
            <>
              {filter.input} →{" "}
              <strong className="text-foreground">{filter.output}</strong>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function AddFilterMenu({
  used,
  onPick,
}: {
  used: FilterKey[];
  onPick: (key: FilterKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const free = FILTER_KEYS.filter((key) => !used.includes(key));
  if (free.length === 0) return <span />;
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
                  value={FILTER_LABEL[key]}
                  onSelect={() => {
                    setOpen(false);
                    onPick(key);
                  }}
                >
                  <div className="flex flex-col">
                    <span>{FILTER_LABEL[key]}</span>
                    <span className="text-xs text-muted-foreground">
                      {FILTER_HINT[key]}
                    </span>
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

export function FilterPanel({
  state,
  result,
  onChange,
}: {
  state: SearchState;
  result: SearchResult;
  /** Called with the new Search text and Filters; the page resets to 1. */
  onChange: (patch: Partial<Pick<SearchState, "q" | "filters">>) => void;
}) {
  const [picker, setPicker] = useState<FilterKey | null>(null);
  const keys = state.filters.map((f) => f.key);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = keys.indexOf(active.id as FilterKey);
    const to = keys.indexOf(over.id as FilterKey);
    if (from >= 0 && to >= 0) {
      onChange({ filters: arrayMove(state.filters, from, to) });
    }
  }

  const patch = (key: FilterKey, change: Partial<FilterState>) =>
    onChange({
      filters: state.filters.map((f) =>
        f.key === key ? { ...f, ...change } : f,
      ),
    });

  const remove = (key: FilterKey) =>
    onChange({ filters: state.filters.filter((f) => f.key !== key) });

  /** Closing the picker: no values means no Filter. */
  function applyPicker(key: FilterKey, values: string[], negated: boolean) {
    if (values.length === 0) return remove(key);
    if (keys.includes(key)) return patch(key, { values, negated });
    onChange({
      filters: [...state.filters, { key, values, negated, off: false }],
    });
  }

  const picked = result.filters.find((f) => f.key === picker);

  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Filters</h2>
        {result.search || result.filters.length > 0 ? (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => onChange({ q: "", filters: [] })}
          >
            Clear all
          </Button>
        ) : null}
      </div>
      <div className="flex items-baseline justify-between border-b py-2 text-sm">
        <span className="text-muted-foreground">All publications</span>
        <span className="tabular-nums">{result.all}</span>
      </div>

      {result.search ? (
        <div className="flex items-start gap-1.5 border-b py-2 pl-1 text-sm">
          <Search
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="break-words">
              <span className="font-medium">Search</span>{" "}
              <span className="text-muted-foreground">“{result.search.q}”</span>
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {result.search.input} →{" "}
              <strong className="text-foreground">{result.search.output}</strong>
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Clear search"
            onClick={() => onChange({ q: "" })}
          >
            <X />
          </Button>
        </div>
      ) : null}

      <DndContext
        id="filters"
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={keys} strategy={verticalListSortingStrategy}>
          <ul
            className="flex flex-col gap-1 py-2"
            aria-label="Filters, applied top to bottom"
          >
            {result.filters.map((filter) => (
              <SortableItem key={filter.key} id={filter.key}>
                {(handle) => (
                  <FilterRow
                    filter={filter}
                    handle={handle}
                    onEdit={() => setPicker(filter.key)}
                    onChange={(change) => patch(filter.key, change)}
                    onRemove={() => remove(filter.key)}
                  />
                )}
              </SortableItem>
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {result.filters.length === 0 ? (
        <p className="pb-2 text-sm text-muted-foreground">No filters yet.</p>
      ) : null}

      <div className="flex items-center justify-between gap-2 border-t pt-3">
        <AddFilterMenu used={keys} onPick={setPicker} />
        <span className="text-sm" aria-live="polite">
          <span className="text-muted-foreground">Results </span>
          <strong className="tabular-nums">{result.total}</strong>
        </span>
      </div>

      {picker ? (
        <FilterPicker
          key={picker}
          filterKey={picker}
          selected={picked?.values ?? []}
          negated={picked?.negated ?? false}
          // A new Filter goes last, so it is reached by the current results.
          input={picked?.input ?? result.total}
          state={state}
          onApply={(values, negated) => applyPicker(picker, values, negated)}
          onClose={() => setPicker(null)}
        />
      ) : null}
    </div>
  );
}
