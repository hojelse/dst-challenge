import { describe, expect, it } from "vitest";
import { parseSearchState, toSearchParams } from "./search-params";

const parse = (query: string) => parseSearchState(new URLSearchParams(query));

describe("parseSearchState", () => {
  it("defaults to no Search, no Filters, relevance, page 1 of 20", () => {
    expect(parse("")).toEqual({
      q: "",
      filters: [],
      sort: "relevance",
      page: 1,
      size: 20,
    });
  });

  it("puts Filters in the given order, and unordered ones last", () => {
    const state = parse("topics=T1&oa=gold&countries=DE,GB&order=countries,oa");
    expect(state.filters.map((f) => f.key)).toEqual(["countries", "oa", "topics"]);
    expect(state.filters[0].values).toEqual(["DE", "GB"]);
  });

  it("reads negated and switched-off Filters", () => {
    const state = parse("oa=gold&countries=DE&not=oa&off=countries");
    expect(state.filters).toEqual([
      { key: "countries", values: ["DE"], negated: false, off: true },
      { key: "oa", values: ["gold"], negated: true, off: false },
    ]);
  });

  it("ignores a Filter named in order, not or off that has no values", () => {
    expect(parse("order=oa&not=oa&off=topics").filters).toEqual([]);
  });

  it("falls back to defaults on malformed input instead of failing", () => {
    const state = parse("sort=random&page=-3&size=5000&order=bogus");
    expect(state).toMatchObject({ sort: "relevance", page: 1, size: 20 });
  });
});

describe("toSearchParams", () => {
  it("leaves defaults out of the URL", () => {
    expect(toSearchParams(parse("")).toString()).toBe("");
  });

  it("round-trips a full search state", () => {
    const query =
      "q=arctic+ice&oa=gold&topics=T1,T2&order=oa,topics&not=topics&off=oa&sort=date&page=3";
    const state = parse(query);
    expect(parseSearchState(toSearchParams(state))).toEqual(state);
  });
});
