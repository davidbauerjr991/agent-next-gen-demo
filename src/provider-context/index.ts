// Provider context (P0.3): the only way UI reaches providers, the active
// profile, and the active database.
export { ProviderRoot } from "./ProviderRoot";
export { IfCapable } from "./IfCapable";
export {
  useProviders,
  useInteractionProvider,
  useMediaProvider,
  useCustomerDataProvider,
  useAssistProvider,
  useActiveProfile,
  useActiveDatabase,
  useProviderKind,
  useCapability,
} from "./hooks";
export { readProviderKind, type ProviderKind } from "./provider-kind";
export type { ProviderFactory } from "./factories";
export type { ProviderContextValue } from "./context";
