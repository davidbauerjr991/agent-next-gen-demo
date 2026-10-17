# src/admin/

The administration areas (PLAN.md "Administration — the Workspace and the admin areas"): the area switcher's non-Workspace areas, the `AdminShell` and the areas built on it. Empty until P-ADMIN.

**Boundary.** Workspace code never imports from here. `eslint.config.js` enforces it with `no-restricted-imports` on every file outside `src/admin/` (P-EXTRACT). Admin code may import shared pieces (providers, settings, lyra-ui); the Workspace and the admin areas meet only through the app shell and the settings store.
