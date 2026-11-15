"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const DEBOUNCE_MS = 250;

/** "N of M match" for a draft Search, asked from the API without results. */
function useMatchCount(draft: string, enabled: boolean) {
  const [match, setMatch] = useState<{ q: string; count: number } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: draft, size: "0" });
        const response = await fetch(`/api/publications?${params}`, {
          signal: controller.signal,
        });
        if (!response.ok) return;
        const result = (await response.json()) as { total: number };
        setMatch({ q: draft, count: result.total });
      } catch {
        // Aborted or offline: the hint just stays empty.
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [draft, enabled]);

  return match?.q === draft ? match.count : null;
}

/**
 * Typing is a draft with a live match count. Enter or the button applies it;
 * Escape reverts to the applied Search.
 */
export function SearchBar({
  applied,
  all,
  onApply,
}: {
  applied: string;
  /** Publications in the index. */
  all: number;
  onApply: (q: string) => void;
}) {
  const [draft, setDraft] = useState(applied);
  const [synced, setSynced] = useState(applied);
  if (applied !== synced) {
    // The URL changed elsewhere (the Search was cleared): follow it.
    setSynced(applied);
    setDraft(applied);
  }

  const trimmed = draft.trim();
  const dirty = trimmed !== applied;
  const matches = useMatchCount(trimmed, dirty && trimmed !== "");

  let hint = "";
  if (dirty && trimmed === "") hint = "Press Enter to clear the search.";
  else if (dirty && matches !== null) {
    hint = `${matches} of ${all} match. Press Enter to search.`;
  }

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        onApply(trimmed);
      }}
    >
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setDraft(applied);
            }}
            aria-label="Search publications"
            aria-describedby="search-hint"
            placeholder="Search by title, author, institution, country or topic…"
            className="h-10 pl-9 text-base"
          />
        </div>
        <Button type="submit" size="lg" className="h-10 px-4">
          Search
        </Button>
      </div>
      <p
        id="search-hint"
        className="mt-1 h-4 text-xs text-muted-foreground"
        aria-live="polite"
      >
        {hint}
      </p>
    </form>
  );
}
