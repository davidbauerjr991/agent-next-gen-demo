// Settings → Workspace (P-HOME-1n grouping): the profile, the persona, the layout (Home layout, assignments
// placement, AI display, canvas layout), the header and its apps, and AI assist. Presentation only: each control
// writes the store section it always did, and that section's lock disables it.
import * as React from "react";
import { Checkbox, RadioGroup, RadioGroupItem, Select } from "@nicecxone/lyra-ui";
import { DisabledReason } from "@/contact-handling/DisabledReason";
import { t } from "@/i18n";
import {
  AI_CANVAS_LAYOUT_FIELD,
  AI_CHIP_BEHAVIOR_FIELD,
  AI_NBA_PAUSE_CHAT_FIELD,
  AI_NBA_PAUSE_VOICE_FIELD,
  AI_NBA_SCRIPTED_DELAY_FIELD,
  ASSIGNMENTS_PLACEMENTS,
  ASSIGNMENTS_PLACEMENT_FIELD,
  ASSIGNMENTS_PLACEMENT_OPTIONS,
  EXTRA_HEADER_APPS,
  HOME_LAYOUTS,
  HOME_LAYOUT_FIELD,
  PERSONAS,
  PERSONA_FIELD,
  useSetPersona,
  useSettings,
  type AgentChatDisplay,
  type AiCanvasLayout,
  type AiChipBehavior,
  type AiDisplayLocation,
  type AppDisplay,
  type AppPlacement,
  type AssignmentsPlacement,
  type ExtraHeaderApp,
  type HomeLayout,
  type Persona,
} from "@/settings";
import { ProfileSettings } from "../ProfileSettings";
import { IntSettingInput } from "../IntSettingInput";
import { LockScope, Pending, Section, SettingsGroup, SwitchRow } from "../settings-parts";

const EXTRA_APP_LABELS: Record<ExtraHeaderApp, string> = {
  customers: "Customers",
  accounts: "Accounts",
  tickets: "Tickets",
  wem: "WEM",
  schedule: "Schedule",
  screenpop: "Screen Pop",
};

// v3's per-app display options; Agent chat is a drawer, so it has no tab.
const APP_DISPLAY_OPTIONS = [
  { value: "tab", label: "Display in tab" },
  { value: "leftnav", label: "Display in Left Nav" },
  { value: "header", label: "Display in App Header" },
];
const AGENT_CHAT_DISPLAY_OPTIONS = APP_DISPLAY_OPTIONS.filter((o) => o.value !== "tab");

const HOME_LAYOUT_LABELS: Record<HomeLayout, string> = {
  oneColumn: "One column",
  twoColumn: "Two columns",
};

const PERSONA_LABELS: Record<Persona, string> = {
  agent: "Agent",
  supervisor: "Supervisor",
  sales: "Sales",
};

export function WorkspaceSection({ first }: { first?: boolean }) {
  const [header, updateHeader] = useSettings("header");
  const [home, updateHome] = useSettings("home");
  const [workspace] = useSettings("workspace");
  const setPersona = useSetPersona();
  const [assignments, updateAssignments] = useSettings("assignments");
  const [ai, updateAi] = useSettings("ai");
  return (
    <SettingsGroup id="workspace" title={t("Workspace")} first={first}>
      <Section title={t("Workspace profile")}>
        <ProfileSettings />
      </Section>

      <Section title={t("Persona")} lockKey="workspace">
        <RadioGroup
          label={t(PERSONA_FIELD.meta!.label)}
          labelHelpText={t(PERSONA_FIELD.meta!.description)}
          value={workspace.persona}
          onValueChange={(value) => setPersona(value as Persona)}
        >
          {PERSONAS.map((persona) => (
            <RadioGroupItem key={persona} value={persona} label={t(PERSONA_LABELS[persona])} />
          ))}
        </RadioGroup>
      </Section>

      <Section title={t("Layout")}>
        <LockScope lockKey="home">
          <RadioGroup
            label={t(HOME_LAYOUT_FIELD.meta!.label)}
            labelHelpText={t(HOME_LAYOUT_FIELD.meta!.description)}
            value={home.layout}
            onValueChange={(value) => updateHome({ layout: value as HomeLayout })}
          >
            {HOME_LAYOUTS.map((layout) => (
              <RadioGroupItem key={layout} value={layout} label={t(HOME_LAYOUT_LABELS[layout])} />
            ))}
          </RadioGroup>
        </LockScope>
        <LockScope lockKey="assignments">
          <RadioGroup
            label={t(ASSIGNMENTS_PLACEMENT_FIELD.meta!.label)}
            labelHelpText={t(ASSIGNMENTS_PLACEMENT_FIELD.meta!.description)}
            value={assignments.placement}
            onValueChange={(value) => updateAssignments({ placement: value as AssignmentsPlacement })}
            data-setting="assignments.placement"
          >
            {ASSIGNMENTS_PLACEMENTS.map((placement) => (
              <RadioGroupItem
                key={placement}
                value={placement}
                // lyra's item takes a node label: the option and its declared description beneath.
                label={
                  <span className="flex flex-col">
                    <span>{t(ASSIGNMENTS_PLACEMENT_OPTIONS[placement].label)}</span>
                    <span className="lyra-body-sm text-lyra-fg-secondary">{t(ASSIGNMENTS_PLACEMENT_OPTIONS[placement].description)}</span>
                  </span>
                }
              />
            ))}
          </RadioGroup>
        </LockScope>
        <LockScope lockKey="ai">
          <div className="max-w-xs">
            <Select
              label="AI display"
              options={[
                { value: "inline", label: "Inline in the transcript" },
                { value: "panel", label: "In the Contact Details panel" },
                { value: "main", label: "Main column (conversations in panel)" },
              ]}
              value={ai.displayLocation}
              onValueChange={(value) => updateAi({ displayLocation: value as AiDisplayLocation })}
            />
          </div>
          <div className="max-w-xs">
            {/* Rendered from its declaration (label, description); unused under "panel", so disabled with the reason. */}
            <DisabledReason
              reason={ai.displayLocation === "panel" ? t("Not used when AI display is In the Contact Details panel") : undefined}
              className="flex w-full"
            >
              <Select
                label={t(AI_CANVAS_LAYOUT_FIELD.meta!.label)}
                labelHelpText={t(AI_CANVAS_LAYOUT_FIELD.meta!.description)}
                options={[
                  { value: "twoColumn", label: t("Two columns") },
                  { value: "stacked", label: t("Stacked") },
                ]}
                value={ai.canvasLayout}
                disabled={ai.displayLocation === "panel"}
                onValueChange={(value) => updateAi({ canvasLayout: value as AiCanvasLayout })}
              />
            </DisabledReason>
          </div>
        </LockScope>
      </Section>

      <Section title={t("Header & apps")} lockKey="header">
        <SwitchRow
          label="Show app icons"
          checked={header.showAppIcons}
          onCheckedChange={(showAppIcons) => updateHeader({ showAppIcons })}
        />
        {header.showAppIcons && (
          <div className="ms-7 flex flex-col gap-3">
            <Checkbox label="Search" checked={header.search} onCheckedChange={(c) => updateHeader({ search: !!c })} />
            <div className="flex items-center gap-2">
              <Checkbox
                label="Agent chat"
                checked={header.agentChat.enabled}
                onCheckedChange={(c) => updateHeader((prev) => ({ agentChat: { ...prev.agentChat, enabled: !!c } }))}
              />
              <Pending>Chat drawer arrives in P0.9.3</Pending>
            </div>
            {header.agentChat.enabled && (
              <div className="ms-7 max-w-xs">
                <Select
                  label="Agent chat display"
                  options={AGENT_CHAT_DISPLAY_OPTIONS}
                  value={header.agentChat.placement}
                  onValueChange={(value) =>
                    updateHeader((prev) => ({
                      agentChat: { ...prev.agentChat, placement: value as AgentChatDisplay["placement"] },
                    }))
                  }
                />
              </div>
            )}
            <Checkbox label="Notifications" checked={header.notifications} onCheckedChange={(c) => updateHeader({ notifications: !!c })} />
            <div className="flex items-center gap-2">
              <Checkbox label="Apps grid" checked={header.appsGrid} onCheckedChange={(c) => updateHeader({ appsGrid: !!c })} />
              <Pending>Embedded apps arrive in P7.6</Pending>
            </div>
            {EXTRA_HEADER_APPS.map((app) => {
              const display = header.apps[app];
              const setDisplay = (patch: Partial<AppDisplay>) =>
                updateHeader((prev) => ({ apps: { ...prev.apps, [app]: { ...prev.apps[app], ...patch } } }));
              return (
                <React.Fragment key={app}>
                  <Checkbox label={EXTRA_APP_LABELS[app]} checked={display.enabled} onCheckedChange={(c) => setDisplay({ enabled: !!c })} />
                  {display.enabled && (
                    <div className="ms-7 w-full max-w-xs">
                      <Select
                        label={`${EXTRA_APP_LABELS[app]} display`}
                        options={APP_DISPLAY_OPTIONS}
                        value={display.placement}
                        onValueChange={(value) => setDisplay({ placement: value as AppPlacement })}
                      />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}
      </Section>

      <Section title={t("AI assist")} lockKey="ai">
        {/* Rendered from their declarations (label, description, range); the Next Best Action is a conversation row under every AI display. */}
        {([
          ["nbaPauseChatMs", AI_NBA_PAUSE_CHAT_FIELD],
          ["nbaPauseVoiceMs", AI_NBA_PAUSE_VOICE_FIELD],
          ["nbaScriptedDelayMs", AI_NBA_SCRIPTED_DELAY_FIELD],
        ] as const).map(([key, field]) => (
          <div key={key} className="max-w-xs">
            <IntSettingInput field={field} value={ai[key]} onCommit={(value) => updateAi({ [key]: value })} />
          </div>
        ))}
        <div className="max-w-xs">
          <Select
            label={t(AI_CHIP_BEHAVIOR_FIELD.meta!.label)}
            labelHelpText={t(AI_CHIP_BEHAVIOR_FIELD.meta!.description)}
            options={[
              { value: "run", label: t("Run") },
              { value: "fill", label: t("Fill the input") },
            ]}
            value={ai.chipBehavior}
            onValueChange={(value) => updateAi({ chipBehavior: value as AiChipBehavior })}
          />
        </div>
      </Section>
    </SettingsGroup>
  );
}
