import { useContext } from "react";
import type { ProviderCapabilities } from "../providers";
import { ProviderContext, type ProviderContextValue } from "./context";

/** The whole context value. Throws outside `ProviderRoot`. */
export function useProviders(): ProviderContextValue {
  const value = useContext(ProviderContext);
  if (!value) throw new Error("useProviders: no <ProviderRoot> above this component (see src/main.tsx)");
  return value;
}

export const useInteractionProvider = () => useProviders().providers.interaction;
export const useMediaProvider = () => useProviders().providers.media;
export const useCustomerDataProvider = () => useProviders().providers.customerData;
export const useAssistProvider = () => useProviders().providers.assist;
export const useActiveProfile = () => useProviders().profile;
export const useActiveDatabase = () => useProviders().database;
export const useTranscriptExportProvider = () => useProviders().providers.transcriptExport;
export const useProviderKind = () => useProviders().kind;

/** Whether the active providers support something, e.g.
 *  `useCapability((c) => c.interaction.transfer.consult)`. Use it when the
 *  answer feeds a prop (a lyra-ui `showX`, a filtered options list); wrap
 *  plain JSX in `<IfCapable>` instead. */
export function useCapability(select: (capabilities: ProviderCapabilities) => boolean): boolean {
  return select(useProviders().capabilities);
}
