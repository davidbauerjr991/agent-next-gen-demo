// Writes docs/layout-matrix.md from the registries (P-LAYOUT). Run with `npm run docs`, which goes through vite-node
// so the TypeScript sources and the `@/` alias resolve as they do in the app. src/layout/matrix.test.ts fails when the
// committed file differs from what this writes.
import { writeFileSync } from "node:fs";
import { renderLayoutMatrix } from "../src/layout/matrix.ts";

const target = new URL("../docs/layout-matrix.md", import.meta.url);
writeFileSync(target, renderLayoutMatrix());
console.log(`wrote ${target.pathname}`);
