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
  useTranscriptExportProvider,
  useScheduleProvider,
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
// Assist card store hook (P-CANVAS): a contact's Next Best Action and Real-Time Summary cards.
export { getAssistCardStore, useAssistCardsByContact, useContactAssistCards } from "./assist-card-store";
export type { ContactAssistCards, NextBestActionCard, RealTimeSummaryCard, RealTimeSummaryState } from "./assist-card-store";
// Schedule store hooks (P-HOME-1): the persona's listed day.
export { useListScheduleDay, useScheduleSnapshot } from "./schedule-store";
export { readProviderKind, readSimLatency, type ProviderKind, type SimLatencyPreset } from "./provider-kind";
export type { ProviderFactory } from "./factories";
export type { ProviderContextValue } from "./context";
