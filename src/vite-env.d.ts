/// <reference types="vite/client" />

// CSS-only alias (see vite.config.ts); imported for its side effect.
declare module "@nicecxone/lyra-ui/styles";

// Dev-only devtools handle set by ProviderRoot (src/provider-context). App
// code must never read it — use the provider hooks.
interface Window {
  __providers?: import("./providers").ProviderSet;
}
