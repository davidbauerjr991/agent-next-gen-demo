// Shared contact handling (P0.5b.2): the logic both workspace pages use to
// show and launch contacts. Pages keep only layout (PLAN.md "Parity").
// Everything here reaches providers only through `src/provider-context`.
export { useNavCards, visibleContacts, type NavCards, type UseNavCardsOptions } from "./useNavCards";
export type { CardOverlay } from "./nav-card-overlay";
export { useContactActivation, type Activation, type ActivationMode } from "./useContactActivation";
export { useOutboundSkills, type SkillOption } from "./useOutboundSkills";
export {
  useOutboundDial,
  isOnCallWith,
  findCallWith,
  alreadyOnCallMessage,
  ALREADY_ON_CALL_TOOLTIP,
  type CallTarget,
  type DialpadRequest,
} from "./useOutboundDial";
export { useContactReopen } from "./useContactReopen";
export { useContactCommands } from "./useContactCommands";
export { useNewAssignments } from "./useNewAssignments";
export { buildOpenChannelTagger, isAddressOnlyCard } from "./open-channel-tagger";
export {
  directoryDisplayName,
  historyEntityId,
  knownOrSynthesizedAddress,
  normalizePhone,
  callerOfCard,
  callerOfInteraction,
  declinedCallMessage,
  type CallerLabel,
} from "./contact-identity";
export { NewOutboundLauncher, type NewOutboundLauncherProps } from "./NewOutboundLauncher";
// P0.5d.1: voice bar, wrap-up prompt and incoming offers.
export { useVoiceCallControls, type VoiceCallControlProps } from "./useVoiceCallControls";
export { voiceWrapUpThread } from "./wrap-up";
export { preContactSummaryOf, withPreContactSummary } from "./pre-contact";
export { useVoiceBarCall, pickVoiceBarCall, type VoiceBarCall } from "./useVoiceBarCall";
export { VoiceHoldChip, type VoiceHoldChipProps } from "./VoiceHoldChip";
export { VoiceWrapUpCard } from "./VoiceWrapUpCard";
export { useChannelOutcomeDrafts, outcomeDraftKey, toOutcome, type OutcomeDraft } from "./useChannelOutcomeDrafts";
export { useIncomingOffer } from "./useIncomingOffer";
export { IncomingOfferActions, type IncomingOfferActionsProps } from "./IncomingOfferActions";
export { navCardAddChannelAction } from "./nav-card-add-channel";
export { showsSessionControls } from "./session-controls";
export { dockedPreviewKey } from "./docked-preview";
export { ChannelThreadBody, ChannelThreadComposer, type CopilotComposerProps } from "./ChannelThreadPane";
export { threadAcceptsReplies, threadKeyOf } from "./channel-thread";
export { channelTempo, routeChannel, mainThreadKey, omnichannelMainKey, type ChannelRoute } from "./omnichannel";
export { useOmnichannelLayout, type OmnichannelLayout } from "./useOmnichannelLayout";
export { AsyncChannelSlideOut } from "./AsyncChannelSlideOut";
export { VoiceBar, type VoiceBarProps } from "./VoiceBar";
export { useAnswerSla, answerSeverity, offerRowAnswerSeverity } from "./answer-sla";
