import { useEffect, useState } from "react";
import { Input } from "@nicecxone/lyra-ui";
import type { FieldMeta } from "@/settings";
import { t } from "@/i18n";

/** A whole-number setting rendered from its declaration (label, description,
 *  range). The draft is local while typing; a value in range applies at once
 *  (settings have no save button), anything else reverts on blur. */
export function IntSettingInput({
  field,
  value,
  disabled,
  onCommit,
}: {
  field: { meta: FieldMeta & { min: number; max: number } };
  value: number;
  disabled?: boolean;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const { min, max } = field.meta;
  const parsed = Number(draft);
  const valid = draft.trim() !== "" && Number.isInteger(parsed) && parsed >= min && parsed <= max;
  return (
    <Input
      label={t(field.meta.label)}
      labelHelpText={t(field.meta.description)}
      type="number"
      min={min}
      max={max}
      step={500}
      value={draft}
      disabled={disabled}
      error={valid ? undefined : t("Between {min} and {max}", { min: new Intl.NumberFormat().format(min), max: new Intl.NumberFormat().format(max) })}
      onChange={(e) => {
        setDraft(e.target.value);
        const next = Number(e.target.value);
        if (e.target.value.trim() !== "" && Number.isInteger(next) && next >= min && next <= max) onCommit(next);
      }}
      onBlur={() => setDraft(String(value))}
    />
  );
}
