// The Settings page's building blocks (P-SETTINGS; split out in P-HOME-1n): a top-level group (a larger lyra heading,
// a Separator before it), a sub-group, a lock scope for one control, and the switch / checkbox rows.
import * as React from "react";
import { Checkbox, Label, Separator, Switch, Tag } from "@nicecxone/lyra-ui";
import { lockedByLabel, sourceLabel, useSectionSource, type SectionKey } from "@/settings";

/** A store section's lock (any layer's, P-CONFIG-LAYERS) and its marker: "Locked by: …" while a lock holds it, "Set
 *  by: …" while an org layer sets it (`all`), nothing for the agent's own values. */
function useSourceMarker(lockKey: SectionKey | undefined, all = true): { locked: boolean; marker: string | null } {
  const source = useSectionSource(lockKey);
  return { locked: !!source?.lockedBy, marker: all ? sourceLabel(source) : lockedByLabel(source) };
}

/** A top-level group: a `lyra-heading-md` legend (16px, one step above the sub-groups' 14px `lyra-heading-sm`;
 *  lyra-tokens.css), a Separator before every group but the first, with the group's own top margin above it. With
 *  `lockKey` (a group that is one store section), the applied profile's lock makes it read-only, as `Section` does. */
export function SettingsGroup({
  id,
  title,
  lockKey,
  first,
  children,
}: {
  id: string;
  title: string;
  lockKey?: SectionKey;
  first?: boolean;
  children: React.ReactNode;
}) {
  const { locked, marker } = useSourceMarker(lockKey);
  return (
    <>
      {!first && <Separator className="mb-8 mt-12" />}
      {/* The first sub-group sits under the heading without its own top margin; a wrapped one (Social) keeps it. */}
      <fieldset className="flex min-w-0 flex-col gap-6 [&>legend+fieldset]:mt-0" disabled={locked} data-settings-group={id} data-section-locked={locked || undefined}>
        <legend className="mb-4 flex items-center gap-2 lyra-heading-md text-lyra-fg-default">
          {title}
          {marker && <Tag variant="neutral" label={marker} fullLabel data-section-source />}
        </legend>
        {children}
      </fieldset>
    </>
  );
}

/** A sub-group: a `lyra-heading-sm` legend with its own top margin (none under the group heading), so it reads
 *  between the group and its fields' `lyra-label`s. With `lockKey`, a section the applied profile locks renders read-only (P-PROFILES): the native
 *  `fieldset disabled` disables every control in it, lyra's own disabled look included. The one place a setting
 *  greys rather than hides. `tag`: a label after the title (Admin, for a tenant-wide setting).
 *  A sub-group of one control named as itself (Persona, Workspace profile) shows the title only: the control drops
 *  its label and is named by the title (`labelId`), and its description moves to the legend (`labelHelpText`,
 *  lyra's legend + `Label` pattern from CheckboxGroup; `lyra-label` has `lyra-heading-sm`'s 14px/500 metrics). */
export function Section({
  title,
  lockKey,
  tag,
  labelId,
  labelHelpText,
  children,
}: {
  title: string;
  lockKey?: SectionKey;
  tag?: string;
  labelId?: string;
  labelHelpText?: string;
  children: React.ReactNode;
}) {
  const { locked, marker } = useSourceMarker(lockKey);
  return (
    <fieldset className="mt-6 flex min-w-0 flex-col gap-3" data-settings-subgroup disabled={locked} data-section-locked={locked || undefined}>
      <legend className="mb-1 flex items-center gap-2 lyra-heading-sm text-lyra-fg-default">
        {/* `labelId` on the title alone, so the control's name leaves out the tags; the help text is `${labelId}-help`. */}
        {labelHelpText ? (
          <Label id={labelId} label={title} labelHelpText={labelHelpText} helpTextId={labelId && `${labelId}-help`} />
        ) : labelId ? (
          <span id={labelId}>{title}</span>
        ) : (
          title
        )}
        {tag && <Tag variant="info" label={tag} />}
        {marker && <Tag variant="neutral" label={marker} fullLabel data-section-source />}
      </legend>
      {children}
    </fieldset>
  );
}

/** One control from a store section other than its group's (the Layout group mixes Home, Assignments and AI): that
 *  section's lock disables it alone. */
export function LockScope({ lockKey, children }: { lockKey: SectionKey; children: React.ReactNode }) {
  const { locked, marker } = useSourceMarker(lockKey, false);
  return (
    <fieldset className="contents" disabled={locked} data-section-locked={locked || undefined}>
      {children}
      {marker && <Tag variant="neutral" label={marker} fullLabel data-section-source />}
    </fieldset>
  );
}

/** A setting the workspace doesn't use yet: still toggleable, labeled. */
export function Pending({ children }: { children: string }) {
  return <Tag variant="neutral" label={children} />;
}

export function SwitchRow({
  label,
  checked,
  onCheckedChange,
  pending,
  help,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  pending?: string;
  /** The setting's one-sentence description, as the label's (?) help. */
  help?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Switch size="sm" label={label} labelHelpText={help} checked={checked} onCheckedChange={onCheckedChange} />
      {pending && <Pending>{pending}</Pending>}
    </div>
  );
}

/** A row of checkboxes under a label, as CXone lays out its agent settings. `hideLegend`: the sub-group's title
 *  already says it. */
export function CheckboxRow<K extends string>({
  legend,
  hideLegend,
  items,
  onChange,
}: {
  legend: string;
  hideLegend?: boolean;
  items: { key: K; label: string; checked: boolean; pending?: string }[];
  onChange: (key: K, checked: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-2" data-checkbox-row={legend}>
      {!hideLegend && <span className="lyra-body-md text-lyra-fg-default">{legend}</span>}
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {items.map((item) => (
          <div key={item.key} className="flex items-center gap-2">
            <Checkbox label={item.label} checked={item.checked} onCheckedChange={(c) => onChange(item.key, c === true)} />
            {item.pending && <Pending>{item.pending}</Pending>}
          </div>
        ))}
      </div>
    </div>
  );
}

