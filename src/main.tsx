import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@nicecxone/lyra-ui/styles";
import "./index.css";
import App from "./App";
import { ProviderRoot, readProviderKind } from "./provider-context";
import { PLACEHOLDER_PROFILE } from "./profiles/contact-center-profile";
import { PLACEHOLDER_DATABASE } from "./data/database-handle";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ProviderRoot
      kind={readProviderKind(window.location.search)}
      profile={PLACEHOLDER_PROFILE}
      database={PLACEHOLDER_DATABASE}
    >
      <App />
    </ProviderRoot>
  </StrictMode>
);
