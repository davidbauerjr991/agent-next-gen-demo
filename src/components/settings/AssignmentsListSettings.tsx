// Settings → Assignments: where and how the assignments list shows
// (P-PROFILES). Each control renders from its declaration (label, description).
import { Select, Switch } from "@nicecxone/lyra-ui";
import { t } from "@/i18n";
import {
  ASSIGNMENT_CHANNEL_CHIPS_FIELD,
  ASSIGNMENTS_PLACEMENT_FIELD,
  useSettings,
  type AssignmentChannelChips,
} from "@/settings";

const CHANNEL_CHIP_LABELS: Record<AssignmentChannelChips, string> = {
  auto: "Automatic",
  show: "Show",
  hide: "Hide",
};

export function AssignmentsListSettings() {
  const [assignments, updateAssignments] = useSettings("assignments");
  return (
    <>
      <div className="flex flex-col gap-1">
        <Switch
          size="sm"
          label={t(ASSIGNMENTS_PLACEMENT_FIELD.meta!.label)}
          checked={assignments.placement === "interiorPanel"}
          onCheckedChange={(on) => updateAssignments({ placement: on ? "interiorPanel" : "leftNav" })}
        />
        <p className="lyra-body-sm text-lyra-fg-secondary">{t(ASSIGNMENTS_PLACEMENT_FIELD.meta!.description)}</p>
      </div>
      <div className="max-w-xs">
        <Select
          label={t(ASSIGNMENT_CHANNEL_CHIPS_FIELD.meta!.label)}
          labelHelpText={t(ASSIGNMENT_CHANNEL_CHIPS_FIELD.meta!.description)}
          options={ASSIGNMENT_CHANNEL_CHIPS_FIELD.values.map((value) => ({ value, label: t(CHANNEL_CHIP_LABELS[value]) }))}
          value={assignments.channelChips}
          onValueChange={(value) => updateAssignments({ channelChips: value as AssignmentChannelChips })}
        />
      </div>
    </>
  );
}
