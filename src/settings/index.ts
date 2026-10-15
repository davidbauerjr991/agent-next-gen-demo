// Settings (P-SETTINGS): the app's configuration, read through hooks. The
// store object itself is never exported; pages hold no setting state of their
// own.
export {
  useSettings,
  useSetting,
  useSectionStored,
  useWorkspacePreset,
  pickPreset,
  useResetSettings,
  useApplyTheme,
  applyStoredTheme,
} from "./hooks";
export { PRESET_LABELS, type PresetId, type WorkspacePreset } from "./presets";
export { pinnedKeysFromHeader, headerPatchForPin, type HeaderPanelKey } from "./header-pins";
export {
  EXTRA_HEADER_APPS,
  SEAMS,
  PHONE_SETUPS,
  type ExtraHeaderApp,
  type SeamId,
  type PhoneSetup,
  type SettingsState,
  type SectionKey,
  type HeaderSettings,
  type HomeSettings,
  type AssignmentsSettings,
  type VoiceSettings,
  type AiSettings,
  type PhoneSettings,
  type AppearanceSettings,
  type ConnectionsSettings,
} from "./settings-schema";
