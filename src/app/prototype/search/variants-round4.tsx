"use client";

// PROTOTYPE round 4: one converged filter row, three operator styles.
// From G: layout, eye/delete side by side at the right, OR-joined values as the click target
//         to edit, red when negated.
// From H: "in → out" count.
// From I: eye icon for on/off.
// The modal renders the same OperatorControl and ValueList as the row (filter-parts.tsx).
//   J  segmented pill   K  dropdown   L  toggle button with a swap icon

import { Eye, EyeOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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

export function VariantJ(props: FilterVariantProps) {
  return <Layout props={props} Row={RowJ} operatorStyle="segmented" />;
}
export function VariantK(props: FilterVariantProps) {
  return <Layout props={props} Row={RowK} operatorStyle="dropdown" />;
}
export function VariantL(props: FilterVariantProps) {
  return <Layout props={props} Row={RowL} operatorStyle="toggle" />;
}
