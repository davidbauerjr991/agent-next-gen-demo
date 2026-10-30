// The assignments interior panel's dock rule (P-PROFILES 0c; P-HOME-1n; P-LAYOUT fix (a)). In the
// interior-panel slot the assignments list is lyra's left SidePanel, first in the content card, beside
// the action area and the reference column: three columns at wide widths. Pinned, it pushes only while
// all three fit; otherwise it's SidePanel's overlay, opened from its toggle or the rail's Assignments item.
import { ACTION_AREA_MIN_WIDTH } from "./canvas-registry";

export interface AssignmentsPanelFit {
  /** The width the panel and the main column share: the main column's row
   *  (action area + reference slot) plus the panel itself while it's docked;
   *  or, with no canvas, the panel-and-content row (the content card's chrome
   *  included: a few px generous). */
  available: number;
  /** The panel's width (lyra's card width unless dragged wider). */
  panelWidth: number;
  /** The reference slot's width (the card width, or the open slide-over's
   *  slot width), or 0 when there's no reference column. */
  referenceSlotWidth: number;
}

/** The panel docks iff it, the action area's minimum and the reference slot fit. */
export function assignmentsPanelDocks({ available, panelWidth, referenceSlotWidth }: AssignmentsPanelFit): boolean {
  return available >= panelWidth + ACTION_AREA_MIN_WIDTH + referenceSlotWidth;
}

/** The width available to the panel, from what's measured: with the canvas
 *  mounted, its row (which already excludes a docked panel, so the panel's
 *  own width is added back); without it, the panel-and-content row. A zero
 *  measurement (not laid out; jsdom) reads as wide enough. */
export function availableForAssignmentsPanel({
  regionsRowWidth,
  referenceSlotMounted,
  contentRowWidth,
  panelDocked,
  panelWidth,
}: {
  regionsRowWidth: number;
  referenceSlotMounted: boolean;
  contentRowWidth: number;
  panelDocked: boolean;
  panelWidth: number;
}): number {
  const measured = referenceSlotMounted && regionsRowWidth > 0 ? regionsRowWidth + (panelDocked ? panelWidth : 0) : contentRowWidth;
  return measured > 0 ? measured : Number.POSITIVE_INFINITY;
}
