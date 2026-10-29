// Settings → Assignments (P-HOME-1n grouping): auto-accept, sort, chips, list behaviour, close and dismiss, legs.
// All the `assignments` section, so the group carries its lock.
import { Select } from "@nicecxone/lyra-ui";
import { DisabledReason } from "@/contact-handling/DisabledReason";
import { t } from "@/i18n";
import {
  ASSIGNMENT_CHANNEL_CHIPS_FIELD,
  ASSIGNMENT_LEGS_FIELD,
  ASSIGNMENT_SORT_DIRECTION_FIELD,
  ASSIGNMENT_SORT_MODE_FIELD,
  AUTO_ACCEPT_CHANNELS,
  useSettings,
  type AssignmentChannelChips,
  type AssignmentLegs,
  type AssignmentSortDirectionSetting,
  type AssignmentSortMode,
  type AutoAcceptChannel,
} from "@/settings";
import { ADVANCED_ASSIGNMENT_SORT_OPTIONS } from "@/components/workspace/workspace-constants";
import { DEFAULT_SORT_DIRECTION } from "@/contact-handling/assignment-sort";
import { CheckboxRow, Section, SettingsGroup, SwitchRow } from "../settings-parts";

const AUTO_ACCEPT_LABELS: Record<AutoAcceptChannel, string> = {
  chat: "Chat",
  email: "Email",
  sms: "SMS",
  whatsapp: "WhatsApp",
};

const CHANNEL_CHIP_LABELS: Record<AssignmentChannelChips, string> = {
  auto: "Automatic",
  show: "Show",
  hide: "Hide",
};

// Neutral wording: the direction applies to every mode (dates, and Channel's A–Z).
const SORT_DIRECTION_LABELS: Record<AssignmentSortDirectionSetting, string> = {
  desc: "Descending",
  asc: "Ascending",
};

export function AssignmentsSection() {
  const [assignments, updateAssignments] = useSettings("assignments");
  const [ai] = useSettings("ai");
  return (
    <SettingsGroup id="assignments" title={t("Assignments")} lockKey="assignments">
      <Section title={t("Auto-accept")}>
        {/* Off: that channel's contacts arrive as offers with Accept / Decline, like a call. */}
        <CheckboxRow
          legend="Auto-accept"
          hideLegend
          items={AUTO_ACCEPT_CHANNELS.map((channel) => ({
            key: channel,
            label: AUTO_ACCEPT_LABELS[channel],
            checked: assignments.autoAccept[channel],
          }))}
          onChange={(channel, checked) => updateAssignments((prev) => ({ autoAccept: { ...prev.autoAccept, [channel]: checked } }))}
        />
      </Section>

      <Section title={t("Sort")}>
        <div className="flex flex-wrap gap-4">
          <div className="w-56">
            <Select
              label={t(ASSIGNMENT_SORT_MODE_FIELD.meta!.label)}
              labelHelpText={t(ASSIGNMENT_SORT_MODE_FIELD.meta!.description)}
              options={ADVANCED_ASSIGNMENT_SORT_OPTIONS.map((o) => ({ value: o.value, label: t(o.label) }))}
              value={assignments.sort.mode}
              // As the list's own sort menu does (`setAssignmentSort`): a new mode starts at its default direction.
              onValueChange={(mode) =>
                updateAssignments({ sort: { mode: mode as AssignmentSortMode, direction: DEFAULT_SORT_DIRECTION[mode as AssignmentSortMode] } })
              }
            />
          </div>
          <div className="w-56">
            <DisabledReason reason={assignments.sort.mode === "custom" ? t("Custom uses your dragged order") : undefined} className="flex w-full">
              <Select
                label={t(ASSIGNMENT_SORT_DIRECTION_FIELD.meta!.label)}
                labelHelpText={t(ASSIGNMENT_SORT_DIRECTION_FIELD.meta!.description)}
                options={ASSIGNMENT_SORT_DIRECTION_FIELD.values.map((value) => ({ value, label: t(SORT_DIRECTION_LABELS[value]) }))}
                value={assignments.sort.direction}
                disabled={assignments.sort.mode === "custom"}
                onValueChange={(direction) =>
                  updateAssignments((prev) => ({ sort: { ...prev.sort, direction: direction as AssignmentSortDirectionSetting } }))
                }
              />
            </DisabledReason>
          </div>
        </div>
      </Section>

      <Section title={t("Chips")}>
        <div className="max-w-xs">
          <Select
            label={t(ASSIGNMENT_CHANNEL_CHIPS_FIELD.meta!.label)}
            labelHelpText={t(ASSIGNMENT_CHANNEL_CHIPS_FIELD.meta!.description)}
            options={ASSIGNMENT_CHANNEL_CHIPS_FIELD.values.map((value) => ({ value, label: t(CHANNEL_CHIP_LABELS[value]) }))}
            value={assignments.channelChips}
            onValueChange={(value) => updateAssignments({ channelChips: value as AssignmentChannelChips })}
          />
        </div>
        <SwitchRow
          label="Show status chip in the session row"
          checked={assignments.showStatusChip}
          onCheckedChange={(showStatusChip) => updateAssignments({ showStatusChip })}
        />
      </Section>

      <Section title={t("List behaviour")}>
        <SwitchRow
          label="New Outbound at the bottom"
          checked={assignments.newOutboundAtBottom}
          onCheckedChange={(newOutboundAtBottom) => updateAssignments({ newOutboundAtBottom })}
        />
        <SwitchRow
          label="Home and Settings at the top"
          checked={assignments.navItemsAtTop}
          onCheckedChange={(navItemsAtTop) => updateAssignments({ navItemsAtTop })}
        />
        <SwitchRow
          label="Don't allow interactions to collapse"
          checked={assignments.noInteractionCollapse}
          onCheckedChange={(noInteractionCollapse) => updateAssignments({ noInteractionCollapse })}
        />
      </Section>

      <Section title={t("Close & dismiss")}>
        <SwitchRow
          label="Allow Unassign & Dismiss"
          checked={assignments.allowUnassignDismiss}
          onCheckedChange={(allowUnassignDismiss) => updateAssignments({ allowUnassignDismiss })}
        />
        <SwitchRow
          label="Confirm before closing a contact"
          checked={assignments.confirmClose}
          onCheckedChange={(confirmClose) => updateAssignments({ confirmClose })}
        />
      </Section>

      <Section title={t("Legs")}>
        <div className="max-w-xs">
          {/* `assignments.legs`, dependent on AI display (P-PROFILES). Only "Separate tabs" is offered until P-STREAM adds
              "One stream"; the schema already accepts it, so a profile file can carry it. */}
          <DisabledReason reason={ai.displayLocation === "panel" ? t("Contact Details panel uses tabs") : undefined} className="flex w-full">
            <Select
              label={t(ASSIGNMENT_LEGS_FIELD.meta!.label)}
              labelHelpText={t(ASSIGNMENT_LEGS_FIELD.meta!.description)}
              options={[{ value: "tabs", label: t("Separate tabs — one thread per channel") }]}
              value={assignments.legs}
              disabled={ai.displayLocation === "panel"}
              onValueChange={(value) => updateAssignments({ legs: value as AssignmentLegs })}
            />
          </DisabledReason>
        </div>
      </Section>
    </SettingsGroup>
  );
}
