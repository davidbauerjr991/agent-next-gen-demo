// P-LAYOUT: docs/layout-matrix.md is generated (`npm run docs`). It fails here when the committed file is stale — a
// registry, a legacy field, a constraint or a built-in profile changed without regenerating it — and the render is
// deterministic, so a regenerate never churns.
import { describe, expect, it } from "vitest";
import { LEGACY_FIELDS } from "./presets";
import { renderLayoutMatrix } from "./matrix";

// Read as Vite reads any file (`?raw`, as size-limit.test does), so the app's tsconfig needs no Node types.
const files = import.meta.glob<string>("/docs/layout-matrix.md", { query: "?raw", import: "default", eager: true });
const committed = () => files["/docs/layout-matrix.md"];

describe("the generated layout matrix (P-LAYOUT)", () => {
  it("the committed docs/layout-matrix.md is current (run `npm run docs` after changing the registries, fields, constraints or profiles)", () => {
    expect(committed()).toBe(renderLayoutMatrix());
  });

  it("renders the same text every time", () => {
    expect(renderLayoutMatrix()).toBe(renderLayoutMatrix());
  });

  it("its retirement checklist has a row for every read-through legacy field", () => {
    const checklist = renderLayoutMatrix().split("## Variables")[0];
    for (const field of LEGACY_FIELDS) expect(checklist, field.id).toContain(`\`${field.id}\``);
  });
});
