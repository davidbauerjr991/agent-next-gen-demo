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
// Interaction store hooks (P0.5.0): provider state for components. The store
// object itself is never exported.
export {
  useAgentState,
  useAgentLegTransitions,
  useInteractions,
  useInteraction,
  useEndReason,
  useTranscript,
  useTyping,
  useInteractionStoreStatus,
} from "./interaction-store-hooks";
export type { InteractionStoreStatus, TranscriptState, TypingState } from "./interaction-store-state";
export { readProviderKind, type ProviderKind } from "./provider-kind";
export type { ProviderFactory } from "./factories";
export type { ProviderContextValue } from "./context";
