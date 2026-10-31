// Settings → Layout's edits on `layout.parts` (P-LAYOUT): which slots a page lists, which parts each lists, whether
// a part may go in a slot, and the patch a move or a reorder writes. Pure; the Layout tab writes the patch through
// the store, which validates it and projects it onto the legacy fields (`settleLayout`).
import { t } from "@/i18n";
import { activeConstraint } from "@/settings/constraints";
import type { SectionKey, SettingPath, SettingsState } from "@/settings/settings-schema";
import { settle } from "@/settings/settle";
import { partsInSlot, patchParts, type LayoutParts } from "./layout-section";
import { PARTS, type PartId } from "./parts";
import type { PartPatch } from "./presets";
import { SLOTS, SLOT_IDS, type Page, type SlotId } from "./slots";

/** The slots a page lists, in registry order (the overlay is where a slot goes when it doesn't fit, not a place). */
export function slotsOnPage(page: Page): SlotId[] {
  return SLOT_IDS.filter((slot) => slot !== "overlay" && SLOTS[slot].pages.includes(page));
}

/** The parts of `page` in `slot`, in order. */
export function partsOnPage(parts: LayoutParts, slot: SlotId, page: Page): PartId[] {
  return partsInSlot(parts, slot).filter((part) => PARTS[part].pages.includes(page));
}

/** Whether `part` may go in `slot`: true, or why not — a slot it doesn't allow, or a rule placing it elsewhere (a
 *  part that follows another). */
export function canPlace(values: SettingsState, part: PartId, slot: SlotId): true | string {
  const def = PARTS[part];
  if (!def.allowedSlots.includes(slot)) return t("{part} can't go in the {slot}", { part: t(def.label), slot: t(SLOTS[slot].label) });
  const rule = activeConstraint(values, `layout.parts.${part}.slot` as SettingPath);
  if (rule && rule.forces!.value !== slot) return t(rule.reason);
  return true;
}

/** Why a map write would be refused by a profile lock on a section it reaches (a legacy field it projects onto, as
 *  the store checks: `settle`'s `derived`), or null. */
export function lockedBy(values: SettingsState, patch: PartPatch, locks: readonly SectionKey[]): string | null {
  if (locks.length === 0) return null;
  const next = { ...values, layout: { ...values.layout, parts: patchParts(values.layout.parts, patch) } };
  const reached = settle(values, next).derived.filter((key) => key !== "layout" && locks.includes(key));
  return reached.length > 0 ? t("Set by your team profile") : null;
}

/** `part` at `index` among `list` (the slot's listed parts without it): an order key between its new neighbours,
 *  every other key kept; when the neighbours share a key, the list renumbered from its first key. */
function placeAt(parts: LayoutParts, list: readonly PartId[], index: number, part: PartId, slot: SlotId): PartPatch {
  const at = Math.max(0, Math.min(index, list.length));
  const keys = list.map((p) => parts[p].order);
  if (keys.length === 0) return { [part]: { slot, order: parts[part].order } };
  if (at === 0) return { [part]: { slot, order: keys[0] - 1 } };
  if (at === keys.length) return { [part]: { slot, order: keys[keys.length - 1] + 1 } };
  if (keys[at - 1] < keys[at]) return { [part]: { slot, order: (keys[at - 1] + keys[at]) / 2 } };
  const next = [...list];
  next.splice(at, 0, part);
  return Object.fromEntries(next.map((p, i) => [p, p === part ? { slot, order: keys[0] + i } : { order: keys[0] + i }]));
}

/** The patch that moves `part` into `slot` at `index` of the page's list there. */
export function movePatch(parts: LayoutParts, part: PartId, slot: SlotId, index: number, page: Page): PartPatch {
  return placeAt(parts, partsOnPage(parts, slot, page).filter((p) => p !== part), index, part, slot);
}

/** The patch that reorders the page's list in `slot` to `next` (one part moved). */
export function reorderPatch(parts: LayoutParts, slot: SlotId, page: Page, next: readonly string[]): PartPatch {
  const prev = partsOnPage(parts, slot, page);
  const without = (list: readonly string[], key: string) => list.filter((k) => k !== key).join("\n");
  const moved = prev.find((key) => next.indexOf(key) !== prev.indexOf(key) && without(prev, key) === without(next, key));
  if (!moved) return {};
  return placeAt(parts, prev.filter((p) => p !== moved), next.indexOf(moved), moved, slot);
}
