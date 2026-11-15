"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pagination } from "./pagination";
import type { ExplainPlanStep, FacetOption, Publication, SearchFilters, SearchView, SortKey } from "./engine";

type FacetFilterKey = "topics" | "countries" | "institutions" | "oa";

type SearchVariantProps = {
  filters: SearchFilters;
  view: SearchView;
  onSetTextFilter: (key: "q" | "author", value: string) => void;
  onSetFacetValues: (key: FacetFilterKey, values: string[]) => void;
  onToggleFacet: (
    key: "topics" | "countries" | "institutions" | "oa",
    value: string
  ) => void;
  onSetSort: (sort: SortKey) => void;
  onSetPage: (page: number) => void;
  onClearAll: () => void;
};

const sortItems: Record<SortKey, string> = {
  relevance: "Relevance",
  date: "Date (newest)",
  citations: "Citations (high to low)",
};

function joinWithOr(items: string[]): string {
  if (items.length === 0) {
    return "";
  }
  if (items.length === 1) {
    return items[0] ?? "";
  }

  return `${items.slice(0, -1).join(" or ")} or ${items[items.length - 1]}`;
}

function selectedLabels(options: FacetOption[]): string[] {
  return options.filter((option) => option.selected).map((option) => option.label);
}

function ResultCard({ record }: { record: Publication }) {
  const authors = record.authors.slice(0, 3);
  const institutions = record.institutions
    .filter((institution) => institution.country === "DK")
    .slice(0, 3);
  const topics = record.topics.slice(0, 3);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base leading-snug">{record.title}</CardTitle>
        <p className="text-xs text-muted-foreground">
          {record.type} · {record.date} · {record.source}
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Authors: {authors.map((author) => author.name).join(", ")}
          {record.authors.length > 3 ? ` +${record.authors.length - 3}` : ""}
        </p>
        {institutions.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            Danish institutions: {institutions.map((institution) => institution.name).join(", ")}
            {record.institutions.filter((institution) => institution.country === "DK").length > 3
              ? ` +${record.institutions.filter((institution) => institution.country === "DK").length - 3}`
              : ""}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          {topics.map((topic) => (
            <Badge key={topic.id} variant="secondary">
              {topic.name}
            </Badge>
          ))}
          {record.topics.length > 3 ? <Badge variant="outline">+{record.topics.length - 3} more</Badge> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={record.isOa ? "default" : "outline"}>{record.oaStatus}</Badge>
          <Badge variant="outline">Citations: {record.citations}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function FacetModalEditor({
  label,
  options,
  onApply,
  open,
  onClose,
}: {
  label: string;
  options: FacetOption[];
  onApply: (selectedIds: string[]) => void;
  open: boolean;
  onClose: () => void;
}) {
  const [draftSelectedIds, setDraftSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setDraftSelectedIds(
      options.filter((option) => option.selected).map((option) => option.id)
    );
  }, [open, options]);

  function toggleDraft(value: string) {
    setDraftSelectedIds((current) =>
      current.includes(value)
        ? current.filter((id) => id !== value)
        : [...current, value]
    );
  }

  function handleClose() {
    onApply(draftSelectedIds);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && handleClose()}>
      <DialogContent className="max-w-lg p-0" showCloseButton>
        <DialogHeader className="border-b px-4 py-3">
          <DialogTitle>Edit {label} filter</DialogTitle>
          <DialogDescription>
            OR within this filter, AND across filters.
          </DialogDescription>
        </DialogHeader>

        <Command>
          <CommandInput placeholder={`Find ${label.toLowerCase()}...`} />
          <CommandList className="max-h-72">
            <CommandEmpty>No matches</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  value={option.label}
                  onSelect={() => toggleDraft(option.id)}
                >
                  <Checkbox checked={draftSelectedIds.includes(option.id)} />
                  <span className="flex-1">{option.label}</span>
                  <span className="text-xs text-muted-foreground">{option.count}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

function ResultListEmpty() {
  return (
    <Card>
      <CardContent className="py-8 text-center text-muted-foreground">
        No publications matched this filter combination.
      </CardContent>
    </Card>
  );
}

function QueryPlanViewer({
  view,
  filters,
  onClearAll,
  onSetFacetValues,
  openFacetEditor,
  onOpenFacetEditorChange,
}: {
  view: SearchView;
  filters: SearchFilters;
  onClearAll: () => void;
  onSetFacetValues: (key: FacetFilterKey, values: string[]) => void;
  openFacetEditor: FacetFilterKey | null;
  onOpenFacetEditorChange: (key: FacetFilterKey | null) => void;
}) {
  const baseRows = view.plan[0]?.outputRows ?? view.total;
  const activeFilters = view.plan.filter(
    (step: ExplainPlanStep) => step.node === "Filter" && step.active
  );
  const [facetPickerOpen, setFacetPickerOpen] = useState(false);
  const countColumnClass = "w-16 text-right tabular-nums";

  const facetMeta: Array<{
    key: FacetFilterKey;
    label: string;
    explanation: string;
    options: FacetOption[];
    selected: string[];
  }> = [
    {
      key: "topics",
      label: "Topic",
      explanation: "Research themes and subject areas attached to each publication.",
      options: view.facets.topics,
      selected: filters.topics,
    },
    {
      key: "countries",
      label: "Country",
      explanation: "Country of contributing institutions.",
      options: view.facets.countries,
      selected: filters.countries,
    },
    {
      key: "institutions",
      label: "Institution",
      explanation: "Affiliated research organizations and universities.",
      options: view.facets.institutions,
      selected: filters.institutions,
    },
    {
      key: "oa",
      label: "OA",
      explanation: "Open access status such as gold, green, hybrid, and closed.",
      options: view.facets.oa,
      selected: filters.oa,
    },
  ];

  const missingFacetRows = facetMeta.filter((facet) => facet.selected.length === 0);

  function rowFacetKey(stepId: string): FacetFilterKey | null {
    if (stepId === "topics") {
      return "topics";
    }
    if (stepId === "countries") {
      return "countries";
    }
    if (stepId === "institutions") {
      return "institutions";
    }
    if (stepId === "oa") {
      return "oa";
    }

    return null;
  }

  function selectedFacetLabels(key: FacetFilterKey): string[] {
    const facet = facetMeta.find((item) => item.key === key);
    if (!facet) {
      return [];
    }

    return facet.options.filter((option) => option.selected).map((option) => option.label);
  }

  function facetLabelForKey(key: FacetFilterKey): string {
    return facetMeta.find((item) => item.key === key)?.label ?? key;
  }

  function applyFacetSelection(key: FacetFilterKey, nextSelectedIds: string[]) {
    onSetFacetValues(key, nextSelectedIds);
  }

  return (
    <div className="space-y-2 rounded-xl border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Progressive Filters</p>
        <Button variant="ghost" size="sm" onClick={onClearAll}>
          Clear all
        </Button>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between gap-2 text-muted-foreground">
          <span>base records</span>
          <span className={countColumnClass}>{baseRows}</span>
        </div>
        {activeFilters.map((step, index) => {
          const facetKey = rowFacetKey(step.id);
          const labels = facetKey ? selectedFacetLabels(facetKey) : [];
          const facetLabel = facetKey ? facetLabelForKey(facetKey) : "Filter";

          return (
            <div key={step.id} className="space-y-2 rounded-md border bg-muted/15 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{facetLabel} is any of</span>
                <div className="flex items-center gap-2">
                  {facetKey ? (
                    <button
                      type="button"
                      className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                      onClick={() => onOpenFacetEditorChange(facetKey)}
                    >
                      Edit filter
                    </button>
                  ) : null}
                  <span className={countColumnClass}>{step.outputRows}</span>
                </div>
              </div>

              <div className="grid gap-1">
                {labels.map((label, labelIndex) => (
                  <div key={label} className="flex items-center gap-2">
                    <Badge variant="outline" className="h-auto justify-start py-1 text-xs font-normal">
                      {label}
                    </Badge>
                    {labelIndex < labels.length - 1 ? (
                      <span className="text-xs text-muted-foreground">OR</span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {activeFilters.length === 0 ? (
          <p className="text-muted-foreground">No active filter predicates.</p>
        ) : null}

        {missingFacetRows.length > 0 ? (
          <div className="space-y-1 border-t pt-1">
            <div className="flex items-center justify-between gap-2 text-muted-foreground">
              <span>Add filter</span>
              <Popover open={facetPickerOpen} onOpenChange={setFacetPickerOpen}>
                <PopoverTrigger render={<button className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground" />}>
                  Add filter
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-0" align="end">
                  <PopoverHeader className="border-b px-3 py-2">
                    <PopoverTitle>Add filter</PopoverTitle>
                    <PopoverDescription>
                      Search facets by name or explanation.
                    </PopoverDescription>
                  </PopoverHeader>
                  <Command>
                    <CommandInput placeholder="Search facets..." />
                    <CommandList>
                      <CommandEmpty>No facets left to add</CommandEmpty>
                      <CommandGroup>
                        {missingFacetRows.map((facet) => (
                          <CommandItem
                            key={facet.key}
                            value={`${facet.label} ${facet.explanation}`}
                            onSelect={() => {
                              onOpenFacetEditorChange(facet.key);
                              setFacetPickerOpen(false);
                            }}
                          >
                            <div className="flex flex-col gap-0.5">
                              <span>{facet.label}</span>
                              <span className="text-xs text-muted-foreground">
                                {facet.explanation}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        ) : null}

      </div>

      {facetMeta
        .filter((facet) => facet.key === openFacetEditor)
        .map((facet) => (
          <FacetModalEditor
            key={facet.key}
            label={facet.label}
            options={facet.options}
            open
            onApply={(selectedIds) => applyFacetSelection(facet.key, selectedIds)}
            onClose={() => onOpenFacetEditorChange(null)}
          />
        ))}
    </div>
  );
}

export function VariantA(props: SearchVariantProps) {
  const { filters, view, onSetTextFilter, onToggleFacet, onSetFacetValues, onSetSort, onSetPage, onClearAll } = props;
  const [openFacetEditor, setOpenFacetEditor] = useState<FacetFilterKey | null>(null);

  return (
    <div className="grid gap-4 md:grid-cols-[320px_1fr]">
      <aside className="space-y-4 md:sticky md:top-4 md:self-start">
        <div className="space-y-3 rounded-xl border bg-card p-3">
          <Input
            value={filters.q}
            onChange={(event) => onSetTextFilter("q", event.target.value)}
            placeholder="Search title, source, author, topic..."
          />
          <Input
            value={filters.author}
            onChange={(event) => onSetTextFilter("author", event.target.value)}
            placeholder="Author contains..."
          />

          <Select value={filters.sort} onValueChange={(value) => onSetSort(value as SortKey)}>
            <SelectTrigger className="w-full justify-between">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent align="start">
              {Object.entries(sortItems).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <QueryPlanViewer
          filters={filters}
          view={view}
          onClearAll={onClearAll}
          onSetFacetValues={onSetFacetValues}
          openFacetEditor={openFacetEditor}
          onOpenFacetEditorChange={setOpenFacetEditor}
        />
      </aside>

      <section className="space-y-3">
        <div className="flex items-center justify-between rounded-xl border bg-card px-3 py-2 text-sm">
          <span className="text-muted-foreground">final records</span>
          <span className="w-16 text-right tabular-nums">{view.total}</span>
        </div>

        {view.records.length === 0 ? <ResultListEmpty /> : null}
        {view.records.map((record) => (
          <ResultCard key={record.id} record={record} />
        ))}

        <Pagination page={view.page} pageCount={view.pageCount} onPageChange={onSetPage} />
      </section>
    </div>
  );
}

function FacetChecklist({
  title,
  options,
  onToggle,
}: {
  title: string;
  options: FacetOption[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">{title}</h3>
      <div className="space-y-1.5">
        {options.map((option) => (
          <label key={option.id} className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox checked={option.selected} onCheckedChange={() => onToggle(option.id)} />
            <span className="flex-1 truncate">{option.label}</span>
            <span className="text-xs text-muted-foreground">{option.count}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function VariantB(props: SearchVariantProps) {
  const { filters, view, onSetTextFilter, onToggleFacet, onSetSort, onSetPage, onClearAll } = props;
  const topicLabels = selectedLabels(view.facets.topics);
  const countryLabels = selectedLabels(view.facets.countries);

  return (
    <div className="grid gap-4 md:grid-cols-[280px_1fr]">
      <aside className="hidden space-y-4 rounded-xl border bg-card p-4 md:block">
        <FacetChecklist
          title="Topic"
          options={view.facets.topics}
          onToggle={(value) => onToggleFacet("topics", value)}
        />
        <FacetChecklist
          title="Country"
          options={view.facets.countries}
          onToggle={(value) => onToggleFacet("countries", value)}
        />
        <FacetChecklist
          title="Institution"
          options={view.facets.institutions}
          onToggle={(value) => onToggleFacet("institutions", value)}
        />
        <FacetChecklist title="OA" options={view.facets.oa} onToggle={(value) => onToggleFacet("oa", value)} />
      </aside>

      <section className="space-y-4">
        <div className="rounded-xl border bg-card p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={filters.q}
              onChange={(event) => onSetTextFilter("q", event.target.value)}
              placeholder="Search query"
              className="min-w-52 flex-1"
            />
            <Input
              value={filters.author}
              onChange={(event) => onSetTextFilter("author", event.target.value)}
              placeholder="Author"
              className="w-44"
            />
            <Select value={filters.sort} onValueChange={(value) => onSetSort(value as SortKey)}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent align="end">
                {Object.entries(sortItems).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Sheet>
              <SheetTrigger
                render={<Button size="sm" variant="outline" className="md:hidden" />}
              >
                Filters
              </SheetTrigger>
              <SheetContent side="left" className="overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Facet Filters</SheetTitle>
                  <SheetDescription>OR within each facet, AND across facets.</SheetDescription>
                </SheetHeader>
                <div className="space-y-4 px-4 pb-6">
                  <FacetChecklist
                    title="Topic"
                    options={view.facets.topics}
                    onToggle={(value) => onToggleFacet("topics", value)}
                  />
                  <FacetChecklist
                    title="Country"
                    options={view.facets.countries}
                    onToggle={(value) => onToggleFacet("countries", value)}
                  />
                  <FacetChecklist
                    title="Institution"
                    options={view.facets.institutions}
                    onToggle={(value) => onToggleFacet("institutions", value)}
                  />
                  <FacetChecklist
                    title="OA"
                    options={view.facets.oa}
                    onToggle={(value) => onToggleFacet("oa", value)}
                  />
                </div>
              </SheetContent>
            </Sheet>
            <Button variant="ghost" size="sm" onClick={onClearAll}>
              Clear all
            </Button>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Showing {view.total} publications
          {topicLabels.length > 0 ? ` with Topic ${joinWithOr(topicLabels)}` : ""}
          {countryLabels.length > 0 ? `${topicLabels.length > 0 ? ", and" : " with"} Country ${joinWithOr(countryLabels)}` : ""}.
        </p>

        <div className="overflow-hidden rounded-xl border">
          {view.records.length === 0 ? <ResultListEmpty /> : null}
          {view.records.map((record) => (
            <div key={record.id} className="border-b p-3 last:border-b-0">
              <p className="line-clamp-2 text-sm font-medium">{record.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {record.date} · {record.source} · {record.type} · citations {record.citations} · {record.oaStatus}
              </p>
            </div>
          ))}
        </div>

        <Pagination page={view.page} pageCount={view.pageCount} onPageChange={onSetPage} />
      </section>
    </div>
  );
}

function QueryPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-sm">
      {label}
      <button className="text-muted-foreground hover:text-foreground" onClick={onRemove}>
        x
      </button>
    </span>
  );
}

function AddFacetControl({
  title,
  options,
  onToggle,
}: {
  title: string;
  options: FacetOption[];
  onToggle: (id: string) => void;
}) {
  const firstUnselected = options.find((option) => !option.selected);

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={!firstUnselected}
      onClick={() => {
        if (firstUnselected) {
          onToggle(firstUnselected.id);
        }
      }}
    >
      + Add {title}
    </Button>
  );
}

export function VariantC(props: SearchVariantProps) {
  const { filters, view, onSetTextFilter, onToggleFacet, onSetSort, onSetPage, onClearAll } = props;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Query Sentence</CardTitle>
          <p className="text-sm text-muted-foreground">
            Build clauses as explicit OR groups joined by AND.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm leading-8">
            <span>Find publications where</span>
            {view.facets.topics.filter((option) => option.selected).map((option) => (
              <QueryPill
                key={option.id}
                label={`Topic is ${option.label}`}
                onRemove={() => onToggleFacet("topics", option.id)}
              />
            ))}
            {view.facets.countries.filter((option) => option.selected).map((option) => (
              <QueryPill
                key={option.id}
                label={`Country is ${option.label}`}
                onRemove={() => onToggleFacet("countries", option.id)}
              />
            ))}
            {view.facets.institutions.filter((option) => option.selected).map((option) => (
              <QueryPill
                key={option.id}
                label={`Institution is ${option.label}`}
                onRemove={() => onToggleFacet("institutions", option.id)}
              />
            ))}
            {view.facets.oa.filter((option) => option.selected).map((option) => (
              <QueryPill
                key={option.id}
                label={`OA is ${option.label}`}
                onRemove={() => onToggleFacet("oa", option.id)}
              />
            ))}
            {!view.facets.topics.some((option) => option.selected) &&
            !view.facets.countries.some((option) => option.selected) &&
            !view.facets.institutions.some((option) => option.selected) &&
            !view.facets.oa.some((option) => option.selected) ? (
              <span className="text-muted-foreground">no facet filters</span>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <AddFacetControl
              title="Topic"
              options={view.facets.topics}
              onToggle={(id) => onToggleFacet("topics", id)}
            />
            <AddFacetControl
              title="Country"
              options={view.facets.countries}
              onToggle={(id) => onToggleFacet("countries", id)}
            />
            <AddFacetControl
              title="Institution"
              options={view.facets.institutions}
              onToggle={(id) => onToggleFacet("institutions", id)}
            />
            <AddFacetControl title="OA" options={view.facets.oa} onToggle={(id) => onToggleFacet("oa", id)} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="min-w-52 flex-1"
              value={filters.q}
              onChange={(event) => onSetTextFilter("q", event.target.value)}
              placeholder="Text query"
            />
            <Input
              className="w-44"
              value={filters.author}
              onChange={(event) => onSetTextFilter("author", event.target.value)}
              placeholder="Author contains"
            />
            <Select value={filters.sort} onValueChange={(value) => onSetSort(value as SortKey)}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent align="end">
                {Object.entries(sortItems).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={onClearAll}>
              Clear all
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-xl border bg-card">
        <div className="grid grid-cols-[1fr_100px_96px_96px] border-b px-3 py-2 text-xs font-medium text-muted-foreground">
          <span>Title / source</span>
          <span>Type</span>
          <span>Date</span>
          <span>Citations</span>
        </div>
        {view.records.length === 0 ? <ResultListEmpty /> : null}
        {view.records.map((record) => (
          <div key={record.id} className="grid grid-cols-[1fr_100px_96px_96px] border-b px-3 py-2 text-sm last:border-b-0">
            <div>
              <p className="line-clamp-2 font-medium">{record.title}</p>
              <p className="text-xs text-muted-foreground">{record.source}</p>
            </div>
            <span>{record.type}</span>
            <span>{record.date}</span>
            <span>{record.citations}</span>
          </div>
        ))}
      </div>

      <Pagination page={view.page} pageCount={view.pageCount} onPageChange={onSetPage} />
    </div>
  );
}
