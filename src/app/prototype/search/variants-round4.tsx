"use client";

// PROTOTYPE round 4: one converged filter row, three operator styles.
// From G: layout, eye/delete side by side at the right, OR-joined values as the click target
//         to edit, red when negated.
// From H: "in → out" count.
// From I: eye icon for on/off.
// The modal renders the same OperatorControl and ValueList as the row (filter-parts.tsx).
//   J  segmented pill   K  dropdown   L  toggle button with a swap icon

import { useState } from "react";
import { Eye, EyeOff, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { matchesQuery } from "./engine";
import { FACET_KEYS, type StepKey } from "./pipeline";
import { OperatorControl, ValueList, type OperatorStyle } from "./filter-parts";
import { Layout, type FilterVariantProps, type RowProps } from "./variants-round3";

const isFacet = (key: StepKey) => (FACET_KEYS as string[]).includes(key);
const LIMIT = 3;

function makeRow(style: OperatorStyle) {
  return function Row({ step, labels, handle, onEdit, props, editingText, textEditor }: RowProps) {
    const facet = isFacet(step.key);
    const off = step.disabled;
    return (
      <div className="rounded-lg px-1 py-2 hover:bg-muted/40">
        <div className="flex items-center gap-1.5">
          {handle}
          <span className={`text-sm font-medium ${off ? "text-muted-foreground" : ""}`}>{step.label}</span>
          <OperatorControl
            style={style}
            facet={facet}
            negated={step.negated}
            onChange={(n) => props.onSetNegated(step.key, n)}
            label={step.label}
          />
          <span className="ml-auto flex items-center">
            <Button
              variant="ghost"
              size="icon-xs"
              aria-pressed={!off}
              aria-label={off ? `Turn on ${step.label} filter` : `Turn off ${step.label} filter`}
              title={off ? "Turn on" : "Turn off"}
              onClick={() => props.onSetDisabled(step.key, !off)}
            >
              {off ? <EyeOff /> : <Eye />}
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Delete ${step.label} filter`}
              title="Delete"
              onClick={() => props.onRemove(step.key)}
            >
              <X />
            </Button>
          </span>
        </div>

        <div className="mt-1 ml-7 space-y-0.5">
          {editingText ? (
            textEditor
          ) : (
            <button
              type="button"
              onClick={onEdit}
              title="Edit values"
              className={`block w-full cursor-pointer rounded text-left text-sm hover:underline hover:decoration-muted-foreground/50 ${off ? "line-through decoration-muted-foreground/60" : ""}`}
            >
              <ValueList labels={labels} negated={step.negated} limit={LIMIT} quote={!facet} muted={off} />
            </button>
          )}
          <p className="text-xs text-muted-foreground tabular-nums">
            {off ? (
              <>
                Off · when on: {step.input.length} → {step.input.length - step.removes}
              </>
            ) : (
              <>
                {step.input.length} → <strong className="text-foreground">{step.output.length}</strong>
              </>
            )}
          </p>
        </div>
      </div>
    );
  };
}

const RowJ = makeRow("segmented");
const RowK = makeRow("dropdown");
const RowL = makeRow("toggle");

/**
 * Round 5: search bar for variant J. Same staged rule as everything else: typing is a draft with a
 * live match count, Enter (or the button) applies, Escape reverts. It feeds the "q" filter, which
 * the panel shows as a fixed first line of the funnel.
 */
function SearchBar({ props }: { props: FilterVariantProps }) {
  const applied = props.filters.q;
  const [draft, setDraft] = useState(applied);
  const [synced, setSynced] = useState(applied);
  if (applied !== synced) {
    // URL changed elsewhere (clear all, clear search): follow it.
    setSynced(applied);
    setDraft(applied);
  }
  const dirty = draft.trim() !== applied.trim();
  const matches = draft.trim() ? props.pipeline.all.filter((r) => matchesQuery(r, draft)).length : props.pipeline.all.length;

  return (
    <form
      role="search"
      className="mb-4"
      onSubmit={(e) => {
        e.preventDefault();
        props.onSetText("q", draft.trim());
      }}
    >
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setDraft(applied);
            }}
            aria-label="Search publications"
            aria-describedby="search-hint"
            placeholder="Search by title, author, institution or country…"
            className="h-10 pl-9 text-base"
          />
        </div>
        <Button type="submit" size="lg" className="h-10">
          Search
        </Button>
      </div>
      <p id="search-hint" className="mt-1 h-4 text-xs text-muted-foreground" aria-live="polite">
        {dirty ? (draft.trim() ? `${matches} of ${props.pipeline.all.length} match. Press Enter to search.` : "Press Enter to clear the search.") : ""}
      </p>
    </form>
  );
}

export function VariantJ(props: FilterVariantProps) {
  return (
    <>
      <SearchBar props={props} />
      <Layout props={props} Row={RowJ} operatorStyle="segmented" searchBar />
    </>
  );
}
export function VariantK(props: FilterVariantProps) {
  return <Layout props={props} Row={RowK} operatorStyle="dropdown" />;
}
export function VariantL(props: FilterVariantProps) {
  return <Layout props={props} Row={RowL} operatorStyle="toggle" />;
}
