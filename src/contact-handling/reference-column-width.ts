// The right column's width (P-LAYOUT-F4 19, 20), one rule for every AI display: the reference column (inline, main) and
// the Copilot panel that takes its place (panel) are both lyra `SidePanel`s resizable by the drag edge, from the card
// width (the minimum, and the default) up to what leaves the action area its minimum. The dragged width is kept per
// browser (`referenceWidth` in the working state, like the assignments panel's). A detail slide-over opens over the
// column at the column's current width, the column's own content (`ReferenceSlotFrame`).
import { useRef } from "react";
import { LYRA_CARD_MAX_WIDTH } from "@nicecxone/lyra-ui";
import { ACTION_AREA_MIN_WIDTH } from "./canvas-registry";
import { setAssignmentsWorkingState, useAssignmentsWorkingState } from "./assignments-working-state";
import { useWorkspaceUiField } from "./workspace-ui-store";

/** The widest the column gets before its row is measured (jsdom; not laid out). */
const UNMEASURED_MAX_WIDTH = 600;

export interface ReferenceColumnWidth {
  /** The column's width now: the dragged one, clamped, else the card width. */
  width: number;
  minWidth: number;
  maxWidth: number;
  /** A width change from outside a drag (the keyboard): writes the working state at once. */
  onWidthChange: (width: number) => void;
  /** A drag's pointer move: kept in a ref only, no state write. The panel's own element follows the pointer (lyra's
   *  drag state), so the app re-renders nothing per move (P-LAYOUT-F4 22b). */
  preview: (width: number) => void;
  /** The drag ended: the last previewed width is written to the working state, once. */
  commit: () => void;
}

/** `rowWidth`: the row's measured width (0: not measured). The widest column leaves the action area its minimum. */
export function referenceColumnBounds(rowWidth: number): { min: number; max: number } {
  return { min: LYRA_CARD_MAX_WIDTH, max: rowWidth > 0 ? Math.max(LYRA_CARD_MAX_WIDTH, rowWidth - ACTION_AREA_MIN_WIDTH) : UNMEASURED_MAX_WIDTH };
}

export const clampReferenceWidth = (width: number | null, bounds: { min: number; max: number }): number =>
  Math.min(bounds.max, Math.max(bounds.min, width ?? bounds.min));

export function useReferenceColumnWidth(): ReferenceColumnWidth {
  const { referenceWidth } = useAssignmentsWorkingState();
  const [rowWidth] = useWorkspaceUiField("regionsRowWidth");
  const bounds = referenceColumnBounds(rowWidth);
  const pending = useRef<number | null>(null);
  return {
    width: clampReferenceWidth(referenceWidth, bounds),
    minWidth: bounds.min,
    maxWidth: bounds.max,
    onWidthChange: (width) => setAssignmentsWorkingState({ referenceWidth: clampReferenceWidth(width, bounds) }),
    preview: (width) => {
      pending.current = clampReferenceWidth(width, bounds);
    },
    commit: () => {
      if (pending.current === null) return;
      setAssignmentsWorkingState({ referenceWidth: pending.current });
      pending.current = null;
    },
  };
}
