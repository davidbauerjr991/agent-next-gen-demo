// Shared contact handling (P0.5b.2): the logic both workspace pages use to
// show and launch contacts. Pages keep only layout (PLAN.md "Parity").
// Everything here reaches providers only through `src/provider-context`.
export { useNavCards, visibleContacts, type NavCards, type UseNavCardsOptions } from "./useNavCards";
export type { CardOverlay } from "./nav-card-overlay";
export { useContactActivation, type Activation, type ActivationMode } from "./useContactActivation";
export { useOutboundSkills, type SkillOption } from "./useOutboundSkills";
export { useOutboundDial, type DialpadRequest } from "./useOutboundDial";
export { useContactReopen } from "./useContactReopen";
export { useContactCommands } from "./useContactCommands";
export { useNewAssignments } from "./useNewAssignments";
export { buildOpenChannelTagger, isAddressOnlyCard } from "./open-channel-tagger";
export { directoryDisplayName, historyEntityId, knownOrSynthesizedAddress, normalizePhone } from "./contact-identity";
export { NewOutboundLauncher, type NewOutboundLauncherProps } from "./NewOutboundLauncher";
