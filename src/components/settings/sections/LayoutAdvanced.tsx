// Settings → Layout → Advanced (P-LAYOUT): a page's slots, each a list of the parts in it, in order. A part drags
// within its slot and to any other slot it allows (lyra `useListReorder`'s cross-list `group`); a slot it doesn't
// allow, or one a rule keeps it out of (a part that follows another), refuses the drop and announces why. The
// keyboard moves through the same lists (Ctrl+Shift+arrows), and each part's Slot picker moves it in one step (the
// single-pointer alternative to dragging). The reference cells' on/off is here too (the old Cards scope).
import * as React from "react";
import { GripVertical } from "lucide-react";
import { Select, Switch, useListReorder, type ListReorderItemProps } from "@nicecxone/lyra-ui";
import { t } from "@/i18n";
import { canPlace, lockedBy, movePatch, partsOnPage, reorderPatch, slotsOnPage } from "@/layout/layout-edit";
import { patchParts } from "@/layout/layout-section";
import { PARTS, REFERENCE_CELL_PARTS, type PartId } from "@/layout/parts";
import { REFERENCE_CELL_IDS, type PartPatch } from "@/layout/presets";
import { SLOTS, type Page, type SlotId } from "@/layout/slots";
import {
  useConstraint,
  useProfileLibrary,
  useSectionLocked,
  useSettings,
  useSettingsDerived,
  type SettingPath,
  type SettingsState,
} from "@/settings";
import { LockScope } from "../settings-parts";

const allValues = (values: SettingsState) => values;

/** Says why a move was refused: shown under the instructions and announced (a polite live region). */
type Notify = (message: string) => void;

/** Writes a patch onto the current map (the store validates it and projects the legacy fields) — unless a profile
 *  lock on a section the write reaches would drop it (the voice bar under a Voice lock, Home's order under a Home
 *  lock): then it says so instead, never a write that silently snaps back. */
function useWriteParts(notify: Notify) {
  const [{ parts }, updateLayout] = useSettings("layout");
  const values = useSettingsDerived(allValues);
  const locks = useProfileLibrary().applied?.locks ?? [];
  return (patch: PartPatch, part: PartId) => {
    const reason = lockedBy(values, patch, locks);
    if (reason) return notify(t("{part} can't move: {reason}", { part: t(PARTS[part].label), reason }));
    updateLayout({ parts: patchParts(parts, patch) });
  };
}

export function LayoutAdvanced({ page }: { page: Page }) {
  const [notice, setNotice] = React.useState("");
  const instructionsId = React.useId();
  return (
    <div className="flex min-w-[320px] flex-1 flex-col gap-4" data-layout-advanced={page}>
      <p id={instructionsId} className="lyra-body-sm text-lyra-fg-secondary">
        {t("Drag a part to another slot, or use its Slot menu. With the keyboard: Ctrl+Shift+Up or Down moves it within its slot, Ctrl+Shift+Left or Right to the previous or next slot.")}
      </p>
      {/* Always in the tree (a live region added with its text isn't reliably announced); empty, it takes no height. */}
      <p role="status" aria-live="polite" className="-mt-4 lyra-body-sm text-lyra-fg-default" data-layout-notice="">
        {notice}
      </p>
      {slotsOnPage(page).map((slot) => (
        <SlotList key={slot} slot={slot} page={page} notify={setNotice} instructionsId={instructionsId} />
      ))}
      {page === "interaction" && <ReferenceCellsOnOff />}
    </div>
  );
}

function SlotList({ slot, page, notify, instructionsId }: { slot: SlotId; page: Page; notify: Notify; instructionsId: string }) {
  const [{ parts }] = useSettings("layout");
  const values = useSettingsDerived(allValues);
  const locked = useSectionLocked("layout");
  const locks = useProfileLibrary().applied?.locks ?? [];
  const write = useWriteParts(notify);
  const order = partsOnPage(parts, slot, page);
  const headingId = React.useId();
  const { itemProps, listProps } = useListReorder({
    order,
    keyboardReorder: true,
    // One group per page: a part moves between the lists the page shows.
    group: `layout-${page}`,
    id: slot,
    label: t(SLOTS[slot].label),
    disabled: locked,
    getLabel: (key) => t(PARTS[key as PartId].label),
    onReorder: (next) => {
      const patch = reorderPatch(parts, slot, page, next);
      const moved = Object.keys(patch)[0] as PartId | undefined;
      if (moved) write(patch, moved);
    },
    onMove: (key, _from, _to, index) => write(movePatch(parts, key as PartId, slot, index, page), key as PartId),
    // Refused before the drop: a slot it doesn't allow, a rule, or a lock on a section the move would reach.
    canAccept: (key) => {
      const placed = canPlace(values, key as PartId, slot);
      return placed === true ? (lockedBy(values, movePatch(parts, key as PartId, slot, order.length, page), locks) ?? true) : placed;
    },
  });
  return (
    <div className="flex flex-col gap-1" data-layout-slot={slot}>
      <span id={headingId} className="lyra-label text-lyra-fg-default">
        {t(SLOTS[slot].label)}
      </span>
      <ul
        {...listProps()}
        aria-labelledby={headingId}
        className="flex min-h-10 flex-col gap-1 rounded-lyra-md border border-dashed border-lyra-border-subtle p-1 data-[drag-over]:bg-lyra-bg-active-moderate"
      >
        {order.length === 0 && <li className="px-2 py-1.5 lyra-body-sm text-lyra-fg-secondary">{t("Empty")}</li>}
        {order.map((part) => (
          <PartRow key={part} part={part} slot={slot} page={page} dragProps={itemProps(part)} notify={notify} instructionsId={instructionsId} />
        ))}
      </ul>
    </div>
  );
}

function PartRow({
  part,
  slot,
  page,
  dragProps,
  notify,
  instructionsId,
}: {
  part: PartId;
  slot: SlotId;
  page: Page;
  dragProps: ListReorderItemProps;
  notify: Notify;
  instructionsId: string;
}) {
  const def = PARTS[part];
  const [{ parts }] = useSettings("layout");
  const write = useWriteParts(notify);
  // A part that follows another (the incoming tile, the queue chip, Ask Copilot) is placed by its rule.
  const rule = useConstraint(`layout.parts.${part}.slot` as SettingPath);
  return (
    <li
      {...dragProps}
      tabIndex={0}
      aria-describedby={instructionsId}
      className="flex flex-wrap items-center gap-2 rounded-lyra-sm bg-lyra-bg-surface-base px-2 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lyra-border-focus data-[drag-over]:bg-lyra-bg-active-moderate data-[dragging]:opacity-50"
      data-layout-part={part}
    >
      <GripVertical className="h-4 w-4 shrink-0 text-lyra-fg-secondary" strokeWidth={1.5} aria-hidden />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="lyra-body-md text-lyra-fg-default">{t(def.label)}</span>
        {rule && <span className="lyra-body-sm text-lyra-fg-secondary">{t(rule.reason)}</span>}
      </span>
      {Object.entries(def.options ?? {}).map(([name, option]) => (
        <div key={name} className="w-28">
          <Select
            size="sm"
            aria-label={t("{part} {option}", { part: t(def.label), option: t(option.label) })}
            options={option.values.map((value) => ({ value, label: t(option.valueLabels[value]) }))}
            value={parts[part].options[name]}
            onValueChange={(value) => write({ [part]: { options: { [name]: value } } }, part)}
          />
        </div>
      ))}
      {/* Only where there's a choice: a part with one slot stays in its list, with no menu to disable. */}
      {def.allowedSlots.length > 1 && (
        <div className="w-40">
          <Select
            size="sm"
            aria-label={t("Slot for {part}", { part: t(def.label) })}
            options={def.allowedSlots.map((value) => ({ value, label: t(SLOTS[value].label) }))}
            value={slot}
            // Disabled with the reason beside it: the rule's text above.
            disabled={!!rule}
            onValueChange={(to) => write(movePatch(parts, part, to as SlotId, Infinity, page), part)}
          />
        </div>
      )}
    </li>
  );
}

type CanvasCells = SettingsState["canvas"]["cells"];

/** `cells` with `id` off (`enabled: false`) or back on: the override dropped, and the entry with it once empty, so
 *  turning a cell off and on again leaves the profile unmodified. */
function withCellEnabled(cells: CanvasCells, id: string, enabled: boolean): CanvasCells {
  const { enabled: _drop, ...rest } = cells[id] ?? {};
  const entry = enabled ? rest : { ...rest, enabled: false };
  const next = { ...cells };
  if (Object.keys(entry).length > 0) next[id] = entry;
  else delete next[id];
  return next;
}

/** Each reference cell on or off (`canvas.cells[id].enabled`; the canvas section's lock applies). */
function ReferenceCellsOnOff() {
  const [canvas, updateCanvas] = useSettings("canvas");
  return (
    <LockScope lockKey="canvas">
      <div className="flex flex-col gap-2" data-layout-reference-cells="">
        <span className="lyra-label text-lyra-fg-default">{t("Reference cells")}</span>
        {REFERENCE_CELL_PARTS.map((part) => {
          const id = REFERENCE_CELL_IDS[part].cell;
          return (
            <Switch
              key={part}
              size="sm"
              label={t(PARTS[part].label)}
              checked={canvas.cells[id]?.enabled !== false}
              onCheckedChange={(enabled) => updateCanvas((prev) => ({ cells: withCellEnabled(prev.cells, id, enabled) }))}
            />
          );
        })}
      </div>
    </LockScope>
  );
}
