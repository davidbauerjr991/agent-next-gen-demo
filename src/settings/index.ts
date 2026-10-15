// Settings (P-SETTINGS): the app's configuration, read through hooks. The
// store object itself is never exported; pages hold no setting state of their
// own.
export {
  useSettings,
  useSetting,
  useSectionStored,
  useWorkspaceProfile,
  applyProfile,
  useResetSettings,
  useApplyTheme,
  applyStoredTheme,
} from "./hooks";
export { PROFILE_LABELS, type ProfileId, type WorkspaceProfile } from "./profiles";
export { pinnedKeysFromHeader, leftNavKeysFromHeader, headerPatchForPin, type HeaderPanelKey } from "./header-pins";
export {
  EXTRA_HEADER_APPS,
  type AppDisplay,
  type AppPlacement,
  type AgentChatDisplay,
  SEAMS,
  PHONE_SETUPS,
  type ExtraHeaderApp,
  type SeamId,
  type PhoneSetup,
  type SettingsState,
  type SectionKey,
  type HeaderSettings,
  type HomeSettings,
  HOME_SECTIONS,
  HOME_QUEUE_CHANNELS,
  type HomeSection,
  type HomeSectionKey,
  type HomeQueueChannel,
  type AssignmentsSettings,
  type VoiceSettings,
  type AiSettings,
  type PhoneSettings,
  type AppearanceSettings,
  type ConnectionsSettings,
} from "./settings-schema";
