"use client";

import { Button } from "@/components/ui/button";

type PaginationProps = {
  page: number;
  pageCount: number;
  onPageChange: (nextPage: number) => void;
};

export function Pagination({ page, pageCount, onPageChange }: PaginationProps) {
  const canGoPrev = page > 1;
  const canGoNext = page < pageCount;

  return (
    <div className="flex items-center justify-between gap-4 border-t pt-4">
      <p className="text-sm text-muted-foreground">
        Page {page} of {pageCount}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!canGoPrev}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!canGoNext}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
