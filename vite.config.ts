/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  // GitHub Pages project site — served at
  // https://davidbauerjr991.github.io/agent-next-gen-demo/, a subpath, not
  // the domain root — so built asset URLs need this prefix or they 404.
  base: "/agent-next-gen-demo/",
  plugins: [react()],
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@nicecxone/lyra-ui/styles": path.resolve(__dirname, "../lyra-ui/src/styles/lyra-tokens.css"),
      // Mock "database" fixtures for the CreateNew → Outbound demo (agent
      // and customer records) — kept out of lyra-ui's public index.ts since
      // they're story-only fixtures, not real design-system exports, but
      // aliased individually (same pattern as /styles above) so this app's
      // demo data stays in sync with lyra-ui's instead of hand-copying a
      // second, drifting list. See lyra-ui/CONTRIBUTING.md §1.
      "@nicecxone/lyra-ui/agents-data": path.resolve(__dirname, "../lyra-ui/src/components/__stories__/create-new-agents-data.ts"),
      "@nicecxone/lyra-ui/customers-data": path.resolve(__dirname, "../lyra-ui/src/components/__stories__/create-new-customers-data.ts"),
      "@nicecxone/lyra-ui": path.resolve(__dirname, "../lyra-ui/src/index.ts"),
    },
  },
});
