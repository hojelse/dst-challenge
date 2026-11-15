import { describe, expect, it } from "vitest";
import { parseSearchState } from "@/lib/search-params";
import {
  buildOptionsRequest,
  buildSearchRequest,
  filterClause,
  searchClause,
} from "./query";

const state = (query: string) => parseSearchState(new URLSearchParams(query));

const germany = { terms: { countries: ["DE"] } };
const notGold = { bool: { must_not: [{ terms: { oa_status: ["gold"] } }] } };

describe("searchClause", () => {
  it("matches everything without Search text", () => {
    expect(searchClause("")).toEqual({ match_all: {} });
  });

  it("requires every word, each in any field, with title boosted", () => {
    const clause = searchClause("arctic  ice") as {
      bool: { must: { multi_match: { query: string; fields: string[] } }[] };
    };
    expect(clause.bool.must.map((m) => m.multi_match.query)).toEqual([
      "arctic",
      "ice",
    ]);
    expect(clause.bool.must[0].multi_match.fields).toContain("title^3");
    expect(clause.bool.must[0].multi_match.fields).toContain("country_names");
  });
});

describe("filterClause", () => {
  it("is a terms query, wrapped in must_not when negated", () => {
    const [country, oa] = state("countries=DE&oa=gold&not=oa").filters;
    expect(filterClause(country)).toEqual(germany);
    expect(filterClause(oa)).toEqual(notGold);
  });
});

describe("buildSearchRequest", () => {
  it("ANDs Search with every switched-on Filter", () => {
    const request = buildSearchRequest(
      state("q=ice&countries=DE&oa=gold&not=oa&topics=T1&off=topics"),
    );
    expect(request.query).toEqual({
      bool: { must: [searchClause("ice")], filter: [germany, notGold] },
    });
  });

  it("counts each step as Search plus the Filters up to it, in order", () => {
    const request = buildSearchRequest(
      state("countries=DE&oa=gold&not=oa&order=oa,countries"),
    );
    const steps = request.aggs.all.aggs;
    expect(Object.keys(steps)).toEqual(["search", "step_0", "step_1"]);
    expect(steps.step_0).toEqual({
      filter: { bool: { must: [{ match_all: {} }], filter: [notGold] } },
    });
    expect(steps.step_1).toEqual({
      filter: { bool: { must: [{ match_all: {} }], filter: [notGold, germany] } },
    });
  });

  it("gives a switched-off Filter the same step as the one before it", () => {
    const request = buildSearchRequest(
      state("countries=DE&oa=gold&order=countries,oa&off=oa"),
    );
    const steps = request.aggs.all.aggs;
    expect(steps.step_1).toEqual(steps.step_0);
  });

  it("pages with from and size", () => {
    const request = buildSearchRequest(state("page=3&size=10"));
    expect(request).toMatchObject({ from: 20, size: 10 });
  });

  it("sorts by score with Search, newest first without, or as asked", () => {
    expect(buildSearchRequest(state("q=ice")).sort[0]).toEqual({ _score: "desc" });
    expect(buildSearchRequest(state("")).sort[0]).toEqual({
      publication_date: "desc",
    });
    expect(buildSearchRequest(state("q=ice&sort=citations")).sort[0]).toEqual({
      cited_by_count: "desc",
    });
  });
});

describe("buildOptionsRequest", () => {
  const here = (query: string, key: "countries" | "oa" | "topics") =>
    buildOptionsRequest(state(query), key).aggs.all.aggs.here.filter;

  it("counts 'here' after only the Filters before the one being picked", () => {
    const query = "countries=DE&oa=gold&not=oa&order=oa,countries";
    expect(here(query, "oa")).toEqual({
      bool: { must: [{ match_all: {} }], filter: [] },
    });
    expect(here(query, "countries")).toEqual({
      bool: { must: [{ match_all: {} }], filter: [notGold] },
    });
  });

  it("counts 'here' after every Filter for a Filter not in use yet", () => {
    expect(here("countries=DE", "topics")).toEqual({
      bool: { must: [{ match_all: {} }], filter: [germany] },
    });
  });

  it("aggregates on the Filter's own field, overall and here", () => {
    const { overall, here } = buildOptionsRequest(state(""), "topics").aggs.all.aggs;
    expect(overall.terms.field).toBe("topic_ids");
    expect(here.aggs.values.terms.field).toBe("topic_ids");
  });
});
