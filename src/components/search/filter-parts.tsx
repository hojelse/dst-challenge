"use client";

// The two pieces shown both in a Filter row and in its picker, so they look
// and behave the same in both places.

import { X } from "lucide-react";

const OPERATORS = [
  { negated: false, words: "is any of" },
  { negated: true, words: "is none of" },
] as const;

/** The segmented "is any of / is none of" control. */
export function OperatorControl({
  negated,
  onChange,
  label,
}: {
  negated: boolean;
  onChange: (negated: boolean) => void;
  /** The Filter name, for screen readers. */
  label: string;
}) {
  return (
    <span
      role="radiogroup"
      aria-label={`${label} match`}
      className="inline-flex shrink-0 items-center rounded-full bg-muted p-0.5 text-xs font-normal"
    >
      {OPERATORS.map((operator) => {
        const active = negated === operator.negated;
        return (
          <button
            key={operator.words}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(operator.negated)}
            className={`cursor-pointer rounded-full px-2.5 py-0.5 transition-colors ${
              active
                ? operator.negated
                  ? "bg-background text-destructive shadow-sm ring-1 ring-destructive/30"
                  : "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {operator.words}
          </button>
        );
      })}
    </span>
  );
}

/**
 * Values joined by a muted "or" ("nor" when negated, and red). With
 * `onRemove`, each value gets a remove button (used in the picker).
 */
export function ValueList({
  labels,
  negated,
  limit = Infinity,
  muted = false,
  onRemove,
}: {
  labels: string[];
  negated: boolean;
  limit?: number;
  muted?: boolean;
  onRemove?: (index: number) => void;
}) {
  const shown = labels.slice(0, limit);
  const rest = labels.length - shown.length;
  const joiner = negated ? "nor" : "or";
  const tone = muted
    ? "text-muted-foreground"
    : negated
      ? "text-destructive"
      : "text-foreground";
  return (
    <span className={`leading-relaxed ${tone}`}>
      {shown.map((label, i) => (
        <span key={`${label}-${i}`}>
          {i > 0 ? (
            <span className="text-muted-foreground"> {joiner} </span>
          ) : null}
          <span
            className={onRemove ? "inline-flex items-baseline gap-0.5" : undefined}
          >
            {label}
            {onRemove ? (
              <button
                type="button"
                aria-label={`Remove ${label}`}
                onClick={() => onRemove(i)}
                className="cursor-pointer self-center rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            ) : null}
          </span>
        </span>
      ))}
      {rest > 0 ? (
        <span className="text-muted-foreground">
          {" "}
          {joiner} {rest} more…
        </span>
      ) : null}
    </span>
  );
}
