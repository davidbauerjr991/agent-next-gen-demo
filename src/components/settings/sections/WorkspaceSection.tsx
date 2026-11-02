// Settings → Workspace (P-HOME-1n grouping): the profile, the persona, the header and its apps, and AI assist. The
// layout controls moved to Settings → Layout (P-LAYOUT). Presentation only: each control writes the store section it
// always did, and that section's lock disables it. The apps are enabled here, each with its display beside it
// (P-LAYOUT-F3 9; placed in Layout from P-LAYOUT-F1 E until then).
import * as React from "react";
import { Checkbox, RadioGroup, RadioGroupItem, Select } from "@nicecxone/lyra-ui";
import { t } from "@/i18n";
import {
  AI_CHIP_BEHAVIOR_FIELD,
  AI_NBA_PAUSE_CHAT_FIELD,
  AI_NBA_PAUSE_VOICE_FIELD,
  AI_NBA_SCRIPTED_DELAY_FIELD,
  EXTRA_HEADER_APPS,
  PERSONAS,
  PERSONA_FIELD,
  SHOW_CONTACT_DETAILS_BUTTON_FIELD,
  useSetPersona,
  useSettings,
  type AiChipBehavior,
  type Persona,
} from "@/settings";
import { ProfileSettings } from "../ProfileSettings";
import { IntSettingInput } from "../IntSettingInput";
import { Pending, Section, SettingsGroup, SwitchRow } from "../settings-parts";
import { AGENT_CHAT_DISPLAY_OPTIONS, APP_DISPLAY_OPTIONS, EXTRA_APP_LABELS } from "../header-app-options";
import { LayoutPresetRow, type PresetRow } from "./LayoutPresetRow";

/** An enabled app's display, indented under its checkbox. It moves a part, so the layout lock holds it too, as it
 *  did inside Settings → Layout (the store refuses a derived layout write to a locked section). */
function AppDisplayRow({ row }: { row: PresetRow }) {
  return (
    <div className="ms-7">
      <LayoutPresetRow row={row} lockKey="layout" />
    </div>
  );
}

const PERSONA_LABELS: Record<Persona, string> = {
  agent: "Agent",
  supervisor: "Supervisor",
  sales: "Sales",
};

export function WorkspaceSection({ first }: { first?: boolean }) {
  const [header, updateHeader] = useSettings("header");
  const [workspace, updateWorkspace] = useSettings("workspace");
  const setPersona = useSetPersona();
  const [ai, updateAi] = useSettings("ai");
  const personaLabelId = React.useId();
  return (
    <SettingsGroup id="workspace" title={t("Workspace")} first={first}>
      <Section title={t("Workspace profile")}>
        <ProfileSettings />
      </Section>

      <Section title={t(PERSONA_FIELD.meta!.label)} lockKey="workspace" labelId={personaLabelId} labelHelpText={t(PERSONA_FIELD.meta!.description)}>
        <RadioGroup
          aria-labelledby={personaLabelId}
          aria-describedby={`${personaLabelId}-help`}
          value={workspace.persona}
          onValueChange={(value) => setPersona(value as Persona)}
        >
          {PERSONAS.map((persona) => (
            <RadioGroupItem key={persona} value={persona} label={t(PERSONA_LABELS[persona])} />
          ))}
        </RadioGroup>
      </Section>

      <Section title={t("Record header")} lockKey="workspace">
        <SwitchRow
          label={t(SHOW_CONTACT_DETAILS_BUTTON_FIELD.meta.label)}
          help={t(SHOW_CONTACT_DETAILS_BUTTON_FIELD.meta.description)}
          checked={workspace.showContactDetailsButton}
          onCheckedChange={(showContactDetailsButton) => updateWorkspace({ showContactDetailsButton })}
        />
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
              <AppDisplayRow row={{ field: "header.agentChat.placement", label: "Agent chat display", options: AGENT_CHAT_DISPLAY_OPTIONS }} />
            )}
            <Checkbox label="Notifications" checked={header.notifications} onCheckedChange={(c) => updateHeader({ notifications: !!c })} />
            <div className="flex items-center gap-2">
              <Checkbox label="Apps grid" checked={header.appsGrid} onCheckedChange={(c) => updateHeader({ appsGrid: !!c })} />
              <Pending>Embedded apps arrive in P7.6</Pending>
            </div>
            {/* Where each enabled app shows, beside its checkbox: its one place (P-LAYOUT-F3 9; was Settings → Layout's
                presets, P-LAYOUT-F1 E). The same preset row, so the layout lock and Advanced layout still disable it. */}
            {EXTRA_HEADER_APPS.map((app) => (
              <React.Fragment key={app}>
                <Checkbox
                  label={t(EXTRA_APP_LABELS[app])}
                  checked={header.apps[app].enabled}
                  onCheckedChange={(c) => updateHeader((prev) => ({ apps: { ...prev.apps, [app]: { ...prev.apps[app], enabled: !!c } } }))}
                />
                {header.apps[app].enabled && (
                  <AppDisplayRow
                    row={{ field: `header.apps.${app}.placement`, label: "{app} display", labelValues: { app: t(EXTRA_APP_LABELS[app]) }, options: APP_DISPLAY_OPTIONS }}
                  />
                )}
              </React.Fragment>
            ))}
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
