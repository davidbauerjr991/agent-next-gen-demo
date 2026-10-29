// Layout slots (P-HOME-1n, P-LAYOUT's first consumer): the places a workspace part can mount. P-LAYOUT grows this
// into the full registry (main, main-trailing, overlay, dock-bottom, header, capacities, pages); a slot here declares
// only what this step reads.

export const SLOT_IDS = ["left-nav", "interior-panel", "home-top", "reference", "docked-panel"] as const;
export type SlotId = (typeof SLOT_IDS)[number];

export interface SlotDef {
  id: SlotId;
  /** How the slot holds a part: inline in another surface, a panel, a slide-over, or a stack in the page flow. */
  container: "inline" | "panel" | "slideOver" | "stack";
}

export const SLOTS: Record<SlotId, SlotDef> = {
  /** The left nav's header (lyra `LeftNav`; its top-level children take `expanded`). */
  "left-nav": { id: "left-nav", container: "inline" },
  /** A fixed panel between the left nav and the content: lyra `InteriorPanel`, resizable within its own min/max,
   *  an overlay only when it doesn't fit. */
  "interior-panel": { id: "interior-panel", container: "panel" },
  /** The top of Home, above the view switcher. */
  "home-top": { id: "home-top", container: "stack" },
  /** The reference slot's slide-over beside the action area (P-CANVAS). */
  reference: { id: "reference", container: "slideOver" },
  /** The docked right panel. */
  "docked-panel": { id: "docked-panel", container: "panel" },
};
