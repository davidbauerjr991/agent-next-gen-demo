// Settings → Resolved settings (P-CONFIG-LAYERS): every agent-scope value as the layers resolve it, with the layer it
// comes from and whose lock holds it. Rows come from the schema (each section a profile carries, each top-level field
// a lock covers), so a new setting appears here without a change to this file. Values are summarised as text: a
// field's own label where it declares one, On/Off, the enabled keys of a set of switches, else compact JSON.
import { t } from "@/i18n";
import type { SectionSource } from "./layers";
import { profileFieldKeys, sectionInProfiles } from "./scope";
import { SECTIONS, type FieldMeta, type SectionKey, type SectionSchemas, type SettingsState } from "./settings-schema";
import { lockedByLabel, sourceLabel } from "./source-labels";

export interface ResolvedRow {
  section: SectionKey;
  field: string;
  /** The field's declared label, else its key in words. */
  label: string;
  value: string;
  /** "Set by: …", "Locked by: …", "Yours" or "Default". */
  source: string;
  locked: boolean;
}

const MAX_VALUE = 80;

/** Words a key can't spell (until P-ADMIN back-fills every field's declared label). */
const ACRONYMS: Record<string, string> = { sms: "SMS", whatsapp: "WhatsApp" };

/** `confirmClose` → "Confirm close"; `sms` → "SMS". */
const inWords = (key: string) => {
  if (ACRONYMS[key]) return ACRONYMS[key];
  const words = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const capped = (text: string) => (text.length > MAX_VALUE ? `${text.slice(0, MAX_VALUE - 1)}…` : text);

export function valueText(value: unknown): string {
  if (typeof value === "boolean") return value ? t("On") : t("Off");
  if (value === null || value === undefined || value === "") return t("None");
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.length === 0 ? t("None") : capped(value.map(valueText).join(", "));
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > 0 && entries.every(([, v]) => typeof v === "boolean")) {
    const on = entries.filter(([, v]) => v).map(([k]) => k);
    return on.length === 0 ? t("None") : capped(on.join(", "));
  }
  return capped(JSON.stringify(value));
}

function sourceText(source: SectionSource): string {
  return sourceLabel(source) ?? (source.from?.level === "agent" ? t("Yours") : t("Default"));
}

/** One row per agent-scope top-level field, in schema order. */
export function resolvedRows(
  values: SettingsState,
  sources: Record<SectionKey, SectionSource>,
  sections: SectionSchemas = SECTIONS,
): ResolvedRow[] {
  return (Object.keys(sections) as SectionKey[])
    .filter((key) => sectionInProfiles(key, sections))
    .flatMap((section) => {
      const fields = (sections[section].read as unknown as { fields: Record<string, { meta?: FieldMeta }> }).fields;
      const source = sources[section];
      return profileFieldKeys(section, sections).map((field) => ({
        section,
        field,
        label: t(fields[field]?.meta?.label ?? inWords(field)),
        value: valueText((values[section] as Record<string, unknown>)[field]),
        source: sourceText(source),
        locked: lockedByLabel(source) !== null,
      }));
    });
}
