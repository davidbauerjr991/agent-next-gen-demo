import { Fragment, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@nicecxone/lyra-ui/styles";
import "./index.css";
import App from "./App";
import { ProviderRoot, readProviderKind } from "./provider-context";
import { PLACEHOLDER_PROFILE } from "./profiles/contact-center-profile";
import { PLACEHOLDER_DATABASE } from "./data/database-handle";

// Opt-out for demo sessions: `VITE_NO_STRICT_MODE=1 npm run dev` skips
// StrictMode's double render/effect replay. Off by default; read at
// dev-server start (or build) time.
const Root = import.meta.env.VITE_NO_STRICT_MODE === "1" ? Fragment : StrictMode;

createRoot(document.getElementById("root")!).render(
  <Root>
    <ProviderRoot
      kind={readProviderKind(window.location.search)}
      profile={PLACEHOLDER_PROFILE}
      database={PLACEHOLDER_DATABASE}
    >
      <App />
    </ProviderRoot>
  </Root>
);
