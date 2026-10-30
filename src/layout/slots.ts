// Layout slots (P-LAYOUT; first slice in P-HOME-1n): the places a workspace part can mount. Data only — no
// components and no lyra import — so the matrix script and node tests can read it. Each slot names the lyra container
// that renders it, its width bounds (as tokens the container resolves: lyra exports no width constants beyond the
// card width), how many parts it holds, and which pages it exists on.

export const SLOT_IDS = [
  "left-nav",
  "interior-panel",
  "home-top",
  "main",
  "main-trailing",
  "reference",
  "docked-panel",
  "overlay",
  "dock-bottom",
  "header",
] as const;
export type SlotId = (typeof SLOT_IDS)[number];

export const PAGES = ["home", "interaction"] as const;
export type Page = (typeof PAGES)[number];

/** The lyra (or app) container a slot renders in. */
export const SLOT_CONTAINERS = [
  "LeftNav",
  "SidePanel-left",
  "SidePanel-right",
  "stack",
  "column",
  "slide-over-frame",
  "overlay",
  "dock",
  "AppHeader",
] as const;
export type SlotContainer = (typeof SLOT_CONTAINERS)[number];

/** A width bound: lyra's card width (`LYRA_CARD_MAX_WIDTH`), the container's own default, the action area's minimum
 *  (`ACTION_AREA_MIN_WIDTH`), or the reference slot's clamp (the body row less the action area's minimum). */
export type SlotWidth = "card" | "container" | "action-area" | "row-less-action";

export interface SlotDef {
  id: SlotId;
  container: SlotContainer;
  /** What the container is, for the docs. */
  description: string;
  minWidth?: SlotWidth;
  maxWidth?: SlotWidth;
  /** How many parts it shows at once. */
  capacity: number | "many";
  pages: readonly Page[];
  /** Where it goes when it doesn't fit beside the main column's minimum. */
  fitFallback?: "overlay";
}

const BOTH: readonly Page[] = PAGES;

export const SLOTS: Record<SlotId, SlotDef> = {
  "left-nav": {
    id: "left-nav",
    container: "LeftNav",
    description: "lyra LeftNav: its header, sticky caption and LeftNavSlot rows",
    capacity: "many",
    pages: BOTH,
  },
  "interior-panel": {
    id: "interior-panel",
    container: "SidePanel-left",
    description: "lyra SidePanel side=\"left\" inside the content container: pinned pushes the content, unpinned overlays; a toggle button",
    minWidth: "card",
    maxWidth: "container",
    capacity: 1,
    pages: BOTH,
    fitFallback: "overlay",
  },
  "home-top": {
    id: "home-top",
    container: "stack",
    description: "a stack in Home's flow, above the view switcher",
    capacity: "many",
    pages: ["home"],
  },
  main: {
    id: "main",
    container: "column",
    description: "the main column: the action area on an interaction, the feed column on Home",
    minWidth: "action-area",
    capacity: "many",
    pages: BOTH,
  },
  "main-trailing": {
    id: "main-trailing",
    container: "column",
    description: "Home's Cards column beside the feed (ReferenceSlotFrame referenceTitle=\"Cards\")",
    minWidth: "card",
    maxWidth: "card",
    capacity: "many",
    pages: ["home"],
    fitFallback: "overlay",
  },
  reference: {
    id: "reference",
    container: "slide-over-frame",
    description: "ReferenceSlotFrame: the reference column for cells, InteriorPanel overlayHeader for the detail slide-over",
    minWidth: "card",
    maxWidth: "row-less-action",
    capacity: "many",
    pages: ["interaction"],
    fitFallback: "overlay",
  },
  "docked-panel": {
    id: "docked-panel",
    container: "SidePanel-right",
    description: "lyra SidePanel side=\"right\": the docked panel (WorkspaceRightPanel; Home's detail panel)",
    minWidth: "container",
    maxWidth: "container",
    capacity: 1,
    pages: BOTH,
  },
  overlay: {
    id: "overlay",
    container: "overlay",
    description: "where a slot that doesn't fit goes: an unpinned SidePanel, an InteriorPanel overlay, the Summaries overlay",
    capacity: "many",
    pages: BOTH,
  },
  "dock-bottom": {
    id: "dock-bottom",
    container: "dock",
    description: "the bottom dock under the content (the voice bar's host)",
    capacity: 1,
    pages: BOTH,
  },
  header: {
    id: "header",
    container: "AppHeader",
    description: "lyra AppHeader's actions row",
    capacity: "many",
    pages: BOTH,
  },
};
