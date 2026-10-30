import { useCallback, useMemo } from "react";
import { useSettingsDerived, type SettingsState } from "@/settings";
import { PARTS, partsIn, slotFor, type PartId } from "./parts";
import type { SlotId } from "./slots";

/** The slot a part mounts in under the current settings (re-renders only when it moves). */
export function useSlotFor(part: PartId): SlotId {
  return useSettingsDerived(useCallback((values: SettingsState) => slotFor(part, values), [part]));
}

/** Whether a part mounts in a slot (`useSlotHas("home-top", "assignments")`). */
export function useSlotHas(slot: SlotId, part: PartId): boolean {
  return useSlotFor(part) === slot;
}

/** The parts in a slot, in order (re-renders only when that list changes). */
export function useSlotParts(slot: SlotId): PartId[] {
  const joined = useSettingsDerived(useCallback((values: SettingsState) => partsIn(slot, values).join(" "), [slot]));
  return useMemo(() => (joined ? (joined.split(" ") as PartId[]) : []), [joined]);
}

/** One of a part's options (`usePartOption("activityFeed", "view")`), or its default. */
export function usePartOption(part: PartId, name: string): string {
  return useSettingsDerived(
    useCallback((values: SettingsState) => values.layout.parts[part].options[name] ?? PARTS[part].options?.[name]?.default ?? "", [part, name]),
  );
}
