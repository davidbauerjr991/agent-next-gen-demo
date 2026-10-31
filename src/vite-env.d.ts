/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "1" skips StrictMode (src/main.tsx). For demo sessions; off by default. */
  readonly VITE_NO_STRICT_MODE?: string;
}

// CSS-only alias (see vite.config.ts); imported for its side effect.
declare module "@nicecxone/lyra-ui/styles";

// Dev-only devtools handle set by ProviderRoot (src/provider-context). App
// code must never read it — use the provider hooks.
interface Window {
  __providers?: import("./providers").ProviderSet;
  /** Dev-only customer side of the sim bus (P0.4), until the P0.6 console. */
  __simCustomer?: import("./adapters/sim/sim-customer-client").SimCustomerClient;
  /** Dev-only: Playwright registers a Copilot result for a question (e2e `registerCardResult`, P-LAYOUT-F1 F). */
  __copilotResults?: { register: typeof import("./contact-handling/copilot-results").registerCopilotResult };
}
