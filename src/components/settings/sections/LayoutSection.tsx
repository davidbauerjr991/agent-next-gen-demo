// Settings → Layout (P-LAYOUT): where the workspace's parts go, as one map (`layout.parts`). Presets first: a
// ToggleGroup per legacy placement field (Workspace's old Layout sub-group, labels unchanged, plus the voice
// controls' location, P-LAYOUT-F1 E; each header app's display sits beside its checkbox in Workspace → Header & apps
// since P-LAYOUT-F3 9), each writing its field, which moves its parts; "Custom" when the map matches no value. Then Advanced: every part of a page by slot, dragged between the slots it allows, beside a live
// preview. The applied profile's `layout` lock makes all of it read-only.
import * as React from "react";
import { Accordion, Button, Switch, ToggleGroup } from "@nicecxone/lyra-ui";
import { t } from "@/i18n";
import type { Page } from "@/layout/slots";
import { LAYOUT_ADVANCED_FIELD, resetLayoutToProfile, useSectionLocked, useSettingDisabledBy, useSettings, type HomeContentWidth } from "@/settings";
import { homeFeedOn } from "@/contact-handling/home/home-layout";
import { HOME_TWO_COLUMNS_NEED_FEED_REASON } from "@/settings";
import { Section, SettingsGroup } from "../settings-parts";
import { LayoutPresetRow, SettingPresetRow } from "./LayoutPresetRow";
import { HOME_CONTENT_WIDTH_ROW, PRESET_ROWS } from "./layout-preset-rows";
import { LayoutAdvanced } from "./LayoutAdvanced";
import { LayoutPreview } from "./LayoutPreview";

/** Home's content width (P-LAYOUT-F3 3): its own setting, after Home layout (which writes its default). */
function HomeContentWidthRow() {
  const [home, updateHome] = useSettings("home");
  return (
    <SettingPresetRow
      row={HOME_CONTENT_WIDTH_ROW}
      value={home.contentWidth}
      apply={(value) => updateHome({ contentWidth: value as HomeContentWidth })}
      lockKey="home"
    />
  );
}


export function LayoutSection() {
  const [page, setPage] = React.useState<Page>("interaction");
  const pageLabelId = React.useId();
  const locked = useSectionLocked("layout");
  const [{ advanced: advancedOn }, updateLayout] = useSettings("layout");
  const advancedOff = useSettingDisabledBy("layout.parts");
  // Two columns puts the Activity feed on the left (`homeIsTwoColumn`): with the feed off it would render one column,
  // so the option is disabled, with its reason, until the feed is on (P-LAYOUT-F4 6).
  const [home] = useSettings("home");
  const homeLayoutUnavailable = homeFeedOn(home) ? undefined : { twoColumn: HOME_TWO_COLUMNS_NEED_FEED_REASON };
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
      {/* P-LAYOUT-F1 E: one way to place the parts at a time — the presets, or Advanced by hand. Each side is disabled,
          with its reason, while the other is on (`advanced-layout-*` in SETTING_CONSTRAINTS). */}
      <Switch
        size="sm"
        label={t(LAYOUT_ADVANCED_FIELD.meta.label)}
        labelHelpText={t(LAYOUT_ADVANCED_FIELD.meta.description)}
        checked={advancedOn}
        onCheckedChange={(advanced) => updateLayout({ advanced })}
        data-setting="layout.advanced"
      />
      <Section title={t("Presets")}>
        {PRESET_ROWS.map((row) => (
          <React.Fragment key={row.field}>
            <LayoutPresetRow row={row} unavailable={row.field === "home.layout" ? homeLayoutUnavailable : undefined} />
            {row.field === "home.layout" && <HomeContentWidthRow />}
          </React.Fragment>
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
                // Off (P-LAYOUT-F1 E): disabled, its reason in place of the subhead.
                subhead: advancedOff ? t(advancedOff.reason) : t("Move each part to any slot it allows, and see the page change"),
                disabled: !!advancedOff,
                // `disabled` only locks the trigger; an item open as the switch turns off goes read-only (its menus
                // here, its drag in LayoutAdvanced).
                content: (
                  <fieldset disabled={!!advancedOff} className="m-0 min-w-0 border-0 p-0">
                    {advanced}
                  </fieldset>
                ),
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
