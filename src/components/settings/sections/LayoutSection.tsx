// Settings → Layout (P-LAYOUT): where the workspace's parts go, as one map (`layout.parts`). Presets first: a
// ToggleGroup per legacy placement field (Workspace's old Layout sub-group, labels unchanged, plus the voice
// controls' location and the Activity view), each writing its field, which moves its parts; "Custom" when the map
// matches no value. Then Advanced: every part of a page by slot, dragged between the slots it allows, beside a live
// preview. The applied profile's `layout` lock makes all of it read-only.
import * as React from "react";
import { Accordion, Button, Label, Tag, ToggleGroup } from "@nicecxone/lyra-ui";
import { DisabledReason } from "@/contact-handling/DisabledReason";
import { t } from "@/i18n";
import { PRESET_FIELDS, type LegacyField } from "@/layout/presets";
import type { Page } from "@/layout/slots";
import {
  AI_CANVAS_LAYOUT_FIELD,
  ASSIGNMENTS_PLACEMENT_FIELD,
  ASSIGNMENTS_PLACEMENT_OPTIONS,
  HOME_ACTIVITY_VIEW_FIELD,
  HOME_LAYOUT_FIELD,
  resetLayoutToProfile,
  useLayoutPreset,
  useSectionLocked,
  useSettingDisabledBy,
  type SettingPath,
} from "@/settings";
import { LockScope, Section, SettingsGroup } from "../settings-parts";
import { LayoutAdvanced } from "./LayoutAdvanced";
import { LayoutPreview } from "./LayoutPreview";

interface PresetRow {
  field: string;
  label: string;
  help?: string;
  options: { value: string; label: string; description?: string }[];
}

const PRESET_ROWS: readonly PresetRow[] = [
  {
    field: "home.layout",
    label: HOME_LAYOUT_FIELD.meta!.label,
    help: HOME_LAYOUT_FIELD.meta!.description,
    options: [
      { value: "oneColumn", label: "One column" },
      { value: "twoColumn", label: "Two columns" },
    ],
  },
  {
    field: "assignments.placement",
    label: ASSIGNMENTS_PLACEMENT_FIELD.meta!.label,
    help: ASSIGNMENTS_PLACEMENT_FIELD.meta!.description,
    options: (["leftNav", "interiorPanel", "none"] as const).map((value) => ({
      value,
      label: ASSIGNMENTS_PLACEMENT_OPTIONS[value].label,
      description: ASSIGNMENTS_PLACEMENT_OPTIONS[value].description,
    })),
  },
  {
    field: "ai.displayLocation",
    label: "AI display",
    options: [
      { value: "inline", label: "Inline in the transcript" },
      { value: "panel", label: "In the Contact Details panel" },
      { value: "main", label: "Main column (conversations in panel)" },
    ],
  },
  {
    field: "ai.canvasLayout",
    label: AI_CANVAS_LAYOUT_FIELD.meta!.label,
    help: AI_CANVAS_LAYOUT_FIELD.meta!.description,
    options: [
      { value: "twoColumn", label: "Two columns" },
      { value: "stacked", label: "Stacked" },
    ],
  },
  {
    field: "voice.controlsLocation",
    label: "Voice controls location",
    options: [
      { value: "bottom", label: "Bottom" },
      { value: "top", label: "Top of left nav" },
    ],
  },
  {
    field: "home.activityView",
    label: HOME_ACTIVITY_VIEW_FIELD.meta!.label,
    help: HOME_ACTIVITY_VIEW_FIELD.meta!.description,
    options: [
      { value: "list", label: "List" },
      { value: "table", label: "Table" },
    ],
  },
];

const fieldFor = (id: string): LegacyField => PRESET_FIELDS.find((f) => f.id === id)!;

function LayoutPresetRow({ row }: { row: PresetRow }) {
  const field = fieldFor(row.field);
  const [value, apply] = useLayoutPreset(field);
  const unused = useSettingDisabledBy(row.field as SettingPath);
  const labelId = React.useId();
  const description = row.options.find((o) => o.value === value)?.description;
  return (
    // The field's own section lock as well as the group's: the store refuses a write to either.
    <LockScope lockKey={field.section}>
      <div className="flex flex-col gap-1.5" data-layout-preset={row.field}>
        <span className="flex items-center gap-2">
          <Label id={labelId} label={t(row.label)} labelHelpText={row.help && t(row.help)} />
          {value === undefined && <Tag variant="neutral" label={t("Custom")} />}
        </span>
        <DisabledReason reason={unused ? t(unused.reason) : undefined} className="flex w-fit">
          <ToggleGroup
            ariaLabelledBy={labelId}
            items={row.options.map((o) => ({ value: o.value, label: t(o.label) }))}
            value={value ?? ""}
            disabled={!!unused}
            onValueChange={apply}
          />
        </DisabledReason>
        {/* The reason as text too: a disabled control takes no focus, so its tooltip alone never reaches the keyboard. */}
        {unused ? (
          <p className="lyra-body-sm text-lyra-fg-secondary">{t(unused.reason)}</p>
        ) : (
          description && <p className="lyra-body-sm text-lyra-fg-secondary">{t(description)}</p>
        )}
      </div>
    </LockScope>
  );
}

export function LayoutSection() {
  const [page, setPage] = React.useState<Page>("interaction");
  const pageLabelId = React.useId();
  const locked = useSectionLocked("layout");
  const advanced = (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span id={pageLabelId} className="lyra-label text-lyra-fg-default">
          {t("Page")}
        </span>
        <ToggleGroup
          ariaLabelledBy={pageLabelId}
          items={[
            { value: "interaction", label: t("Interaction") },
            { value: "home", label: t("Home") },
          ]}
          value={page}
          onValueChange={(value) => setPage(value as Page)}
        />
      </div>
      <div className="flex flex-wrap items-start gap-6">
        <LayoutAdvanced page={page} />
        <LayoutPreview page={page} />
      </div>
    </div>
  );
  return (
    <SettingsGroup id="layout" title={t("Layout")} lockKey="layout">
      <Section title={t("Presets")}>
        {PRESET_ROWS.map((row) => (
          <LayoutPresetRow key={row.field} row={row} />
        ))}
      </Section>

      <Section title={t("Parts and slots")}>
        {locked ? (
          // Locked, the fieldset disables the accordion's own trigger too: shown open, read-only, so the profile's
          // arrangement can still be seen.
          advanced
        ) : (
          <Accordion
            type="multiple"
            variant="contained"
            items={[
              {
                id: "advanced",
                title: t("Advanced"),
                subhead: t("Move each part to any slot it allows, and see the page change"),
                content: advanced,
              },
            ]}
          />
        )}
      </Section>

      <div>
        <Button variant="outline" onClick={resetLayoutToProfile}>
          {t("Reset to profile default")}
        </Button>
      </div>
    </SettingsGroup>
  );
}
