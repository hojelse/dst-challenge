const bar = "animate-pulse rounded-md bg-muted";

/** The outline of the search page while the first results load. */
export function SearchSkeleton() {
  return (
    <div className="space-y-3" role="status" aria-label="Loading publications">
      <div className={`${bar} h-10`} />
      <div className="h-4" />
      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <div className={`${bar} h-48`} />
        <div className="space-y-2">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className={`${bar} h-16`} />
          ))}
        </div>
      </div>
    </div>
  );
}
