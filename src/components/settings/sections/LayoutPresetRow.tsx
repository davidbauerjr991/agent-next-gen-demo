// One preset row (P-LAYOUT, Settings → Layout): a legacy placement field as a ToggleGroup, writing the field (which
// moves its parts), with the selected value's description or the disabled reason under it. Shared by Layout's
// presets and, for each header app's display, Workspace → Header & apps beside the app's checkbox (P-LAYOUT-F3 9).
import * as React from "react";
import { Label, Tag, ToggleGroup } from "@nicecxone/lyra-ui";
import { DisabledReason } from "@/contact-handling/DisabledReason";
import { t } from "@/i18n";
import { PRESET_FIELDS, type LegacyField } from "@/layout/presets";
import { useLayoutPreset, useSettingDisabledBy, type SectionKey, type SettingPath } from "@/settings";
import { LockScope } from "../settings-parts";

export interface PresetRow {
  field: string;
  label: string;
  /** ICU values for `label`. */
  labelValues?: Record<string, string>;
  help?: string;
  options: { value: string; label: string; description?: string }[];
}

const fieldFor = (id: string): LegacyField => PRESET_FIELDS.find((f) => f.id === id)!;

/** `lockKey`: the section whose lock scopes the row (default its field's own section). Workspace's header-app rows
 *  pass "layout": their group already holds the header lock, so one scope and one "Locked by" tag per row. */
export function LayoutPresetRow({ row, lockKey, unavailable }: { row: PresetRow; lockKey?: SectionKey; unavailable?: Record<string, string> }) {
  const field = fieldFor(row.field);
  const [value, apply] = useLayoutPreset(field);
  return <SettingPresetRow row={row} value={value} apply={apply} lockKey={lockKey ?? field.section} unavailable={unavailable} />;
}

/** The row itself, for any value and writer: label (and "Custom" when no value matches), the ToggleGroup, and under
 *  it the disabled reason or the selected value's one-sentence description. A layout setting that moves no parts
 *  (`LAYOUT_SETTINGS`, P-LAYOUT-F3 3: Home's content width) uses it directly. */
export function SettingPresetRow({
  row,
  value,
  apply,
  lockKey,
  unavailable,
}: {
  row: PresetRow;
  value: string | undefined;
  apply: (value: string) => void;
  lockKey: SectionKey;
  /** Options that can't be picked right now, value → the reason (English source): the option is disabled and the
   *  reason shown as text under the row (an option that needs another setting on, P-LAYOUT-F4 6). */
  unavailable?: Record<string, string>;
}) {
  const unused = useSettingDisabledBy(row.field as SettingPath);
  const labelId = React.useId();
  const noteId = React.useId();
  const description = row.options.find((o) => o.value === value)?.description;
  const unavailableReasons = Object.values(unavailable ?? {});
  return (
    // The field's own section lock as well as the group's: the store refuses a write to either.
    <LockScope lockKey={lockKey}>
      <div className="flex flex-col gap-1.5" data-layout-preset={row.field}>
        <span className="flex items-center gap-2">
          <Label id={labelId} label={t(row.label, row.labelValues)} labelHelpText={row.help && t(row.help)} />
          {value === undefined && <Tag variant="neutral" label={t("Custom")} />}
        </span>
        <DisabledReason reason={unused ? t(unused.reason) : undefined} className="flex w-fit">
          <ToggleGroup
            ariaLabelledBy={labelId}
            // The reason (or the value's description) under it, read on entering the group (lyra F1-L2).
            ariaDescribedBy={unused || description || unavailableReasons.length ? noteId : undefined}
            items={row.options.map((o) => ({ value: o.value, label: t(o.label), disabled: !!unavailable?.[o.value] }))}
            value={value ?? ""}
            disabled={!!unused}
            onValueChange={apply}
          />
        </DisabledReason>
        {/* The reason as text too: a disabled control takes no focus, so its tooltip alone never reaches the keyboard. */}
        {unused ? (
          <p id={noteId} className="lyra-body-sm text-lyra-fg-secondary">{t(unused.reason)}</p>
        ) : (
          (description || unavailableReasons.length > 0) && (
            <p id={noteId} className="lyra-body-sm text-lyra-fg-secondary">
              {[description, ...unavailableReasons].filter(Boolean).map((text) => t(text!)).join(" ")}
            </p>
          )
        )}
      </div>
    </LockScope>
  );
}
