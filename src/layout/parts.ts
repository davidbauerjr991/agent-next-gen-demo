// Workspace parts (P-HOME-1n, P-LAYOUT's first consumer): each surface declares the slots it may mount in and where
// it goes by default. Until P-LAYOUT's `layout.parts` setting, a part's slot comes from today's placement setting
// through a preset map; components ask `slotFor` / `useSlotFor`, never the setting's value.
import type { AssignmentsPlacement, SettingConstraint, SettingsState } from "@/settings";
import type { SlotId } from "./slots";

export const PART_IDS = ["assignments", "contactDetails", "experienceMemory", "sessionDetails"] as const;
export type PartId = (typeof PART_IDS)[number];

export interface PartDef {
  id: PartId;
  allowedSlots: readonly SlotId[];
  defaultSlot: SlotId;
  /** The slot today's settings put it in (the preset map); absent → `defaultSlot`. */
  slotFrom?: (settings: SettingsState) => SlotId;
  /** The `SETTING_CONSTRAINTS` that apply when a preset puts this part in a non-default slot (each rule's `when`
   *  says which; declared there today). */
  constraints?: readonly SettingConstraint["id"][];
}

const ASSIGNMENTS_SLOT: Record<AssignmentsPlacement, SlotId> = {
  leftNav: "left-nav",
  interiorPanel: "interior-panel",
  none: "home-top",
};

export const PARTS: Record<PartId, PartDef> = {
  assignments: {
    id: "assignments",
    allowedSlots: ["left-nav", "interior-panel", "home-top"],
    defaultSlot: "left-nav",
    slotFrom: (s) => ASSIGNMENTS_SLOT[s.assignments.placement],
    constraints: ["placement-none-toasts", "placement-none-incoming"],
  },
  // Contact Details, Experience Memory and Session Details: the reference slide-over; the docked panel is declared
  // so P-LAYOUT can offer it.
  contactDetails: { id: "contactDetails", allowedSlots: ["reference", "docked-panel"], defaultSlot: "reference" },
  experienceMemory: { id: "experienceMemory", allowedSlots: ["reference", "docked-panel"], defaultSlot: "reference" },
  sessionDetails: { id: "sessionDetails", allowedSlots: ["reference", "docked-panel"], defaultSlot: "reference" },
};

export function slotFor(part: PartId, settings: SettingsState): SlotId {
  const def = PARTS[part];
  return def.slotFrom?.(settings) ?? def.defaultSlot;
}

/** The parts the settings put in a slot. */
export function partsIn(slot: SlotId, settings: SettingsState): PartId[] {
  return PART_IDS.filter((part) => slotFor(part, settings) === slot);
}
