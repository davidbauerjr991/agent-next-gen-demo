import { useCallback } from "react";
import { useSettingsDerived, type SettingsState } from "@/settings";
import { slotFor, type PartId } from "./parts";
import type { SlotId } from "./slots";

/** The slot a part mounts in under the current settings (re-renders only when it moves). */
export function useSlotFor(part: PartId): SlotId {
  return useSettingsDerived(useCallback((values: SettingsState) => slotFor(part, values), [part]));
}

/** Whether a part mounts in a slot (`useSlotHas("home-top", "assignments")`). */
export function useSlotHas(slot: SlotId, part: PartId): boolean {
  return useSlotFor(part) === slot;
}
