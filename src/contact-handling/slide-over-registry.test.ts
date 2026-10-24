// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { MARCUS_WEBB_ID } from "./scenario-cases";
import { slideOverEntry } from "./slide-over-registry";

describe("the slide-over registry", () => {
  it("resolves a memory entry for Marcus Webb", () => {
    const entry = slideOverEntry(MARCUS_WEBB_ID, "memory");
    expect(entry).toBeDefined();
    expect(entry!.Body).toBeTypeOf("function");
  });

  it("returns undefined for an unknown key and for an unknown case", () => {
    expect(slideOverEntry(MARCUS_WEBB_ID, "no-such-panel")).toBeUndefined();
    expect(slideOverEntry("no-such-case", "memory")).toBeUndefined();
    expect(slideOverEntry(undefined, "memory")).toBeUndefined();
  });
});
