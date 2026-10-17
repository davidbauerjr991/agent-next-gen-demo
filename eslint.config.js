import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      /* ── Rule zero, enforced ──
         CLAUDE.md's "Rule zero: never hand-roll a button" was previously
         documentation only — nothing actually caught a violation short of
         a human noticing in a screenshot (see the "Scroll To Latest" pill,
         built as a raw `<button>` with guessed styling instead of
         composing `Button`). `npm run lint` was ALSO silently broken this
         whole time (no `eslint.config.js` existed at all, so every run
         failed outright before evaluating a single file) — meaning this
         rule had zero enforcement from either direction. This restriction
         makes a bare `<button>` a hard lint error anywhere in this app's
         `src/`, forcing `Button`/`ActionIconButton`/an existing lyra-ui
         button atom instead. lyra-ui itself is a separate repo/lint config
         — its own components (panel-pin-button.tsx, etc.) legitimately
         build on native `<button>`, so this rule only applies here, the
         consuming app. */
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXOpeningElement[name.name='button']",
          message:
            "Don't hand-roll a <button>. Use Button, ActionIconButton, or an existing lyra-ui button atom (FavoriteButton/PanelPinButton/KebabMenuButton/OutboundAddButton/etc.) from @nicecxone/lyra-ui — see CLAUDE.md's Rule zero.",
        },
      ],
    },
  },
  {
    /* The Workspace → admin boundary (P-EXTRACT, for P-ADMIN): nothing outside
       `src/admin/` imports from it, so the admin areas can grow (and later
       ship separately) without the Workspace depending on them. See
       src/admin/README.md. */
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/admin/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/admin", "@/admin/**", "**/admin", "**/admin/**"],
              message: "Workspace code doesn't import from src/admin/ (the Workspace → admin boundary; see src/admin/README.md).",
            },
          ],
        },
      ],
    },
  }
);
