"use client";

// PROTOTYPE round 4: the two pieces that appear both in a filter row and in its modal, so they
// always look and behave the same in both places.
//   OperatorControl  "is any of / is none of" (or "contains / does not contain"), three styles
//   ValueList        values joined by "or" (or "nor" when negated), red when negated

import { ArrowLeftRight, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type OperatorStyle = "segmented" | "dropdown" | "toggle";

export function operatorWords(facet: boolean): [string, string] {
  return facet ? ["is any of", "is none of"] : ["contains", "does not contain"];
}

export function OperatorControl({
  style,
  facet,
  negated,
  onChange,
  label,
}: {
  style: OperatorStyle;
  facet: boolean;
  negated: boolean;
  onChange: (negated: boolean) => void;
  /** Filter name, for screen readers. */
  label: string;
}) {
  const [pos, neg] = operatorWords(facet);

  if (style === "segmented") {
    return (
      <span
        role="radiogroup"
        aria-label={`${label} match`}
        className="inline-flex shrink-0 items-center rounded-full bg-muted p-0.5 text-xs font-normal"
      >
        {[false, true].map((n) => {
          const active = negated === n;
          return (
            <button
              key={String(n)}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(n)}
              className={`cursor-pointer rounded-full px-2.5 py-0.5 transition-colors ${
                active
                  ? n
                    ? "bg-background text-destructive shadow-sm ring-1 ring-destructive/30"
                    : "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {n ? neg : pos}
            </button>
          );
        })}
      </span>
    );
  }

  if (style === "dropdown") {
    return (
      <Select
        items={{ any: pos, none: neg }}
        value={negated ? "none" : "any"}
        onValueChange={(v) => onChange(v === "none")}
      >
        <SelectTrigger
          size="sm"
          aria-label={`${label} match`}
          className={`h-6 shrink-0 gap-1 rounded-md px-2 text-xs font-normal ${
            negated ? "border-destructive/40 bg-destructive/5 text-destructive [&_svg]:text-destructive" : ""
          }`}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="start" alignItemWithTrigger={false}>
          <SelectItem value="any">{pos}</SelectItem>
          <SelectItem value="none" className="text-destructive">
            {neg}
          </SelectItem>
        </SelectContent>
      </Select>
    );
  }

  // toggle: one button that flips, with an icon that says "click to swap"
  return (
    <button
      type="button"
      aria-pressed={negated}
      aria-label={`${label}: ${negated ? neg : pos}. Click to switch to ${negated ? pos : neg}.`}
      onClick={() => onChange(!negated)}
      className={`inline-flex h-6 shrink-0 cursor-pointer items-center gap-1 rounded-md border px-2 text-xs transition-colors ${
        negated
          ? "border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive/10"
          : "border-border text-foreground hover:bg-muted"
      }`}
    >
      {negated ? neg : pos}
      <ArrowLeftRight className="size-3 opacity-60" aria-hidden />
    </button>
  );
}

/**
 * Values joined by a muted "or" ("nor" when negated). Negated values are red.
 * With `onRemove`, each value gets a small remove button (used in the modal).
 */
export function ValueList({
  labels,
  negated,
  limit = Infinity,
  quote = false,
  muted = false,
  onRemove,
  moreLabel,
}: {
  labels: string[];
  negated: boolean;
  limit?: number;
  quote?: boolean;
  muted?: boolean;
  onRemove?: (index: number) => void;
  moreLabel?: (rest: number) => string;
}) {
  const shown = labels.slice(0, limit);
  const rest = labels.length - shown.length;
  const joiner = negated ? "nor" : "or";
  const tone = muted ? "text-muted-foreground" : negated ? "text-destructive" : "text-foreground";
  return (
    <span className={`leading-relaxed ${tone}`}>
      {shown.map((label, i) => (
        <span key={`${label}-${i}`} className="whitespace-normal">
          {i > 0 ? <span className="text-muted-foreground"> {joiner} </span> : null}
          <span className={onRemove ? "inline-flex items-baseline gap-0.5" : undefined}>
            {quote ? `“${label}”` : label}
            {onRemove ? (
              <button
                type="button"
                aria-label={`Remove ${label}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(i);
                }}
                className="cursor-pointer self-center rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            ) : null}
          </span>
        </span>
      ))}
      {rest > 0 ? (
        <span className="text-muted-foreground"> {moreLabel ? moreLabel(rest) : `${joiner} ${rest} more…`}</span>
      ) : null}
    </span>
  );
}
