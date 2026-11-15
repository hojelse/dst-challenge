// Postgres is the system of record (ADR-0001). Every row comes from OpenAlex,
// and every ID is an OpenAlex short ID ("W…", "A…", "I…", "T…"), never a URL.
// Property names are camelCase in TypeScript; the string passed to each
// column builder is the snake_case column name in the database.

import {
  boolean,
  date,
  doublePrecision,
  foreignKey,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/** A Publication: one OpenAlex work. */
export const publications = pgTable("publications", {
  id: text("id").primaryKey(),
  doi: text("doi"),
  title: text("title"),
  abstract: text("abstract"),
  publicationDate: date("publication_date").notNull(),
  publicationYear: integer("publication_year").notNull(),
  type: text("type").notNull(),
  language: text("language"),
  sourceName: text("source_name"),
  citedByCount: integer("cited_by_count").notNull().default(0),
  isOa: boolean("is_oa").notNull(),
  /** Open access status: gold, green, hybrid, diamond, bronze or closed. */
  oaStatus: text("oa_status").notNull(),
  oaUrl: text("oa_url"),
  pmid: text("pmid"),
  /** The OpenAlex work exactly as harvested. */
  raw: jsonb("raw").notNull(),
  harvestedAt: timestamp("harvested_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** An Author: the disambiguated OpenAlex author entity. */
export const authors = pgTable("authors", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  orcid: text("orcid"),
});

/** An Institution. `countryCode` is its Country (ISO 3166-1 alpha-2). */
export const institutions = pgTable("institutions", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  countryCode: text("country_code"),
  ror: text("ror"),
  type: text("type"),
});

/** An Authorship: one Author's place in one Publication's author list. */
export const authorships = pgTable(
  "authorships",
  {
    publicationId: text("publication_id")
      .notNull()
      .references(() => publications.id, { onDelete: "cascade" }),
    /** 0-based order in the Publication's author list. */
    position: integer("position").notNull(),
    authorId: text("author_id")
      .notNull()
      .references(() => authors.id),
    /** OpenAlex's "first", "middle" or "last". */
    authorPosition: text("author_position").notNull(),
    isCorresponding: boolean("is_corresponding").notNull().default(false),
    /** The name as printed on this Publication. */
    rawAuthorName: text("raw_author_name").notNull(),
  },
  (table) => [primaryKey({ columns: [table.publicationId, table.position] })],
);

/** An Affiliation: an Institution listed on one Authorship. */
export const affiliations = pgTable(
  "affiliations",
  {
    publicationId: text("publication_id").notNull(),
    position: integer("position").notNull(),
    institutionId: text("institution_id")
      .notNull()
      .references(() => institutions.id),
  },
  (table) => [
    primaryKey({
      columns: [table.publicationId, table.position, table.institutionId],
    }),
    // Named explicitly: the generated name exceeds Postgres's 63-character
    // limit, gets truncated, and would make every push see a change.
    foreignKey({
      name: "affiliations_authorship_fk",
      columns: [table.publicationId, table.position],
      foreignColumns: [authorships.publicationId, authorships.position],
    }).onDelete("cascade"),
  ],
);

/** A Topic, with its place in the OpenAlex taxonomy (ADR-0002). */
export const topics = pgTable("topics", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  subfield: text("subfield").notNull(),
  field: text("field").notNull(),
  domain: text("domain").notNull(),
});

/** The Topics OpenAlex assigned to a Publication; one of them is primary. */
export const publicationTopics = pgTable(
  "publication_topics",
  {
    publicationId: text("publication_id")
      .notNull()
      .references(() => publications.id, { onDelete: "cascade" }),
    topicId: text("topic_id")
      .notNull()
      .references(() => topics.id),
    score: doublePrecision("score").notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
  },
  (table) => [primaryKey({ columns: [table.publicationId, table.topicId] })],
);
