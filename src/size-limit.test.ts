// The size rule (P-SHRINK): no non-test source file under src/ exceeds
// LIMIT lines unless scripts/size-allowlist.json lists it with an owner step.
// The allowlist only shrinks: an entry that's under the limit, gone, or has
// grown past the lines it was listed at fails. The page keeps its own 621.
import { describe, expect, it } from "vitest";
import allowlistJson from "../scripts/size-allowlist.json";

const LIMIT = 1200;
const PAGE = "src/components/AgentWorkspaceAdvancedPage.tsx";
const PAGE_LIMIT = 621;

const allowlist: Record<string, { owner?: string; lines?: number }> = allowlistJson;

// Every .ts/.tsx under src/ as text, keyed "/src/…".
const sources = import.meta.glob<string>(["/src/**/*.{ts,tsx}"], { query: "?raw", import: "default", eager: true });

const isTestFile = (path: string) => /\.(test|spec|stories)\.tsx?$/.test(path) || path.startsWith("src/test-utils/");

/** Lines as `wc -l` counts them. */
const lineCount = (source: string) => (source.match(/\n/g) ?? []).length;

describe("the size rule", () => {
  const sizes = new Map(
    Object.entries(sources)
      .map(([key, source]) => [key.slice(1), lineCount(source)] as const)
      .filter(([path]) => !isTestFile(path)),
  );

  it(`no source file over ${LIMIT} lines outside the allowlist`, () => {
    const over = [...sizes].filter(([path, lines]) => lines > LIMIT && !allowlist[path]).map(([path, lines]) => `${path} (${lines})`);
    expect(over, "split the file, or list it in scripts/size-allowlist.json with an owner step").toEqual([]);
  });

  it("every allowlist entry has an owner, still exists, is still over the limit and hasn't grown", () => {
    const problems = Object.entries(allowlist).flatMap(([path, entry]) => {
      const lines = sizes.get(path);
      if (!entry.owner) return [`${path}: no owner step`];
      if (lines === undefined) return [`${path}: no such file; remove it from the allowlist`];
      if (lines <= LIMIT) return [`${path}: ${lines} lines, under the limit; remove it from the allowlist`];
      if (entry.lines !== undefined && lines > entry.lines) return [`${path}: grew from ${entry.lines} to ${lines}`];
      return [];
    });
    expect(problems).toEqual([]);
  });

  it(`the page stays at or under ${PAGE_LIMIT} lines`, () => {
    expect(sizes.get(PAGE)).toBeLessThanOrEqual(PAGE_LIMIT);
  });
});
