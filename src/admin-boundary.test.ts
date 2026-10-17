// The Workspace → admin import boundary (P-EXTRACT): eslint.config.js forbids
// importing from src/admin/ anywhere else under src/, and admin code itself
// is free to. Linted through the real config.
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

// Vitest runs from the repo root, so paths are relative to it.
const eslint = new ESLint();

async function boundaryErrors(filePath: string, source: string) {
  const [result] = await eslint.lintText(source, { filePath });
  return result.messages.filter((m) => m.ruleId === "no-restricted-imports");
}

describe("the Workspace → admin boundary", () => {
  it.each([
    ['import { x } from "@/admin/areas";', "src/components/Example.tsx"],
    ['import { x } from "@/admin";', "src/contact-handling/example.ts"],
    ['import { x } from "../admin/areas";', "src/components/Example.tsx"],
    ['import { x } from "../../admin";', "src/contact-handling/workspace/example.ts"],
  ])("%s in %s is an error", async (source, file) => {
    expect(await boundaryErrors(file, `${source}\nexport const y = x;\n`)).toHaveLength(1);
  });

  it("admin code may import admin code, and the Workspace may import everything else", async () => {
    expect(await boundaryErrors("src/admin/areas/example.ts", 'import { x } from "@/admin/shell";\nexport const y = x;\n')).toHaveLength(0);
    expect(await boundaryErrors("src/components/Example.tsx", 'import { x } from "@/settings";\nexport const y = x;\n')).toHaveLength(0);
  });
}, 30_000);
