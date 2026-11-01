// Settings → Resolved settings (P-CONFIG-LAYERS): every agent-scope value as the org layers and the agent's own
// resolve it, with where it comes from. Read-only; the rows come from the schema (`resolvedRows`). The table is lyra's
// plain Table, built as the Marcus Webb transactions table is (`agent-next-gen-marcus-webb-panels.tsx`).
import * as React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@nicecxone/lyra-ui";
import { t } from "@/i18n";
import { resolvedRows, useSettingSources, useSettingsDerived, type SettingsState } from "@/settings";
import { SECTION_TITLES } from "../section-titles";
import { SettingsGroup } from "../settings-parts";

const allValues = (values: SettingsState) => values;

export function ResolvedSection() {
  const values = useSettingsDerived(allValues);
  const sources = useSettingSources();
  const rows = React.useMemo(() => resolvedRows(values, sources), [values, sources]);
  return (
    <SettingsGroup id="resolved" title={t("Resolved settings")}>
      <p className="lyra-body-sm text-lyra-fg-secondary">
        {t(
          "Every setting a profile can carry, as it applies to you: from your organization's profiles (tenant, enterprise, contact center, your primary team), then your own. The source is per section: a profile that sets a section sets all of it. A locked one applies whatever you set.",
        )}
      </p>
      <Table aria-label={t("Resolved settings")} data-resolved-settings="">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="flex-1">{t("Section")}</TableHead>
            <TableHead className="flex-[1.5]">{t("Setting")}</TableHead>
            <TableHead className="flex-[2]">{t("Value")}</TableHead>
            <TableHead className="flex-[2]">{t("Source")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={`${row.section}.${row.field}`} data-resolved-row={`${row.section}.${row.field}`} data-resolved-locked={row.locked || undefined}>
              <TableCell className="flex-1 text-lyra-fg-secondary">{t(SECTION_TITLES[row.section])}</TableCell>
              {/* The row's header: a screen reader names each value's row by its setting (a11y-review). */}
              <TableCell role="rowheader" className="flex-[1.5]">{row.label}</TableCell>
              <TableCell className="flex-[2] break-words">{row.value}</TableCell>
              <TableCell className="flex-[2] text-lyra-fg-secondary">{row.source}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SettingsGroup>
  );
}
