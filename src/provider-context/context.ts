import { createContext } from "react";
import type { DatabaseHandle } from "../data/database-handle";
import type { ContactCenterProfile } from "../profiles/contact-center-profile";
import type { ProviderCapabilities, ProviderSet } from "../providers";
import type { ProviderKind } from "./provider-kind";

/** What the provider context supplies. Read it through the hooks in
 *  `hooks.ts`, never `useContext(ProviderContext)` directly. */
export interface ProviderContextValue {
  kind: ProviderKind;
  providers: ProviderSet;
  capabilities: ProviderCapabilities;
  profile: ContactCenterProfile;
  database: DatabaseHandle;
}

export const ProviderContext = createContext<ProviderContextValue | null>(null);
