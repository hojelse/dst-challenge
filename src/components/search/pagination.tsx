"use client";

import { Button } from "@/components/ui/button";

/** Page numbers to show: first, last, and two either side of the current. */
function pageNumbers(page: number, pageCount: number): (number | "gap")[] {
  const pages: (number | "gap")[] = [];
  for (let n = 1; n <= pageCount; n++) {
    if (n === 1 || n === pageCount || Math.abs(n - page) <= 2) pages.push(n);
    else if (pages.at(-1) !== "gap") pages.push("gap");
  }
  return pages;
}

export function Pagination({
  page,
  pageCount,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}) {
  if (pageCount <= 1) return null;
  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-center gap-1"
    >
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        Previous
      </Button>
      {pageNumbers(page, pageCount).map((n, i) =>
        n === "gap" ? (
          <span key={`gap-${i}`} className="px-1 text-muted-foreground" aria-hidden>
            …
          </span>
        ) : (
          <Button
            key={n}
            variant={n === page ? "default" : "ghost"}
            size="sm"
            className="min-w-7 tabular-nums"
            aria-label={`Page ${n}`}
            aria-current={n === page ? "page" : undefined}
            onClick={() => onPageChange(n)}
          >
            {n}
          </Button>
        ),
      )}
      <Button
        variant="outline"
        size="sm"
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </Button>
    </nav>
  );
}
