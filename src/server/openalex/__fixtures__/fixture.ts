import { readFileSync } from "node:fs";

// Test-only helpers for the fixture in works.json: five real OpenAlex works,
// each fetched from the single-work endpoint so author lists are complete.
//
// RawWork describes only the parts of an OpenAlex work the tests read. The
// mapper and load functions take the full work; tests cast to their type.

export type RawInstitution = {
  id: string;
  display_name: string;
  country_code: string | null;
  ror: string | null;
  type: string | null;
};

export type RawAuthorship = {
  author_position: string;
  author: { id: string | null; display_name: string; orcid: string | null };
  institutions: RawInstitution[];
  is_corresponding: boolean;
  raw_author_name: string;
};

export type RawTopic = {
  id: string;
  display_name: string;
  score: number;
  subfield: { id: string; display_name: string };
  field: { id: string; display_name: string };
  domain: { id: string; display_name: string };
};

export type RawWork = {
  id: string;
  title: string | null;
  publication_year: number;
  publication_date: string;
  type: string;
  language: string | null;
  cited_by_count: number;
  primary_location: { source: { display_name: string } | null } | null;
  open_access: { is_oa: boolean; oa_status: string; oa_url: string | null };
  authorships: RawAuthorship[];
  primary_topic: RawTopic | null;
  topics: RawTopic[];
  abstract_inverted_index: Record<string, number[]> | null;
  [key: string]: unknown;
};

/** Fixture work IDs, in file order. */
export const FIXTURE_IDS = [
  "W4406617993", // 241 Authorships, 8 unidentified; gold
  "W4407152801", // no abstract; closed
  "W4410557539", // no source; 1 unidentified Authorship with no Affiliations
  "W7132088526", // no Topics; closed
  "W7223643305", // no abstract and no source; green
] as const;

export type FixtureId = (typeof FIXTURE_IDS)[number];

/** A fresh deep copy of every fixture work, safe to edit in a test. */
export function fixtureWorks(): RawWork[] {
  const text = readFileSync(new URL("./works.json", import.meta.url), "utf8");
  return JSON.parse(text) as RawWork[];
}

/** A fresh deep copy of one fixture work. */
export function fixtureWork(id: FixtureId): RawWork {
  const work = fixtureWorks().find((w) => w.id === `https://openalex.org/${id}`);
  if (!work) throw new Error(`${id} is not in the fixture`);
  return work;
}
