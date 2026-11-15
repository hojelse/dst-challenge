import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("vitest smoke test", () => {
  it("runs and resolves the @/ path alias", () => {
    expect(typeof cn).toBe("function");
  });

  it("cn merges conflicting Tailwind classes, last one wins", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("cn drops falsy values", () => {
    expect(cn("text-sm", false && "hidden", undefined, "font-bold")).toBe(
      "text-sm font-bold",
    );
  });
});
