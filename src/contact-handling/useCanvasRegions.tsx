import type { ReactNode } from "react";
import { useSettings } from "@/settings";
import { canvasCells, conversationOrder, type CanvasCell } from "./canvas-registry";
import { useWorkspace } from "./workspace/WorkspaceContext";

export interface CanvasRegions {
  /** AI display inline or main, with a card selected: the canvas applies. */
  enabled: boolean;
  /** `ai.canvasLayout` "twoColumn": the reference cells sit in the reference column. */
  twoColumn: boolean;
  /** Mounted at the top of the action area, above the conversation and
   *  outside its scroll: the pinned action cells (the Next Best Action). */
  pinned: ReactNode;
  /** Mounted at the top of the conversation (the transcript's / AI feed's
   *  overview slot): the action cells before the anchor, preceded under
   *  "stacked" by the reference cells. */
  top: ReactNode;
  /** Mounted after the conversation (its trailing slot). */
  bottom: ReactNode;
  /** The reference column's cells under "twoColumn"; nothing otherwise. */
  reference: ReactNode;
}

/** The two regions of the main column, built from the canvas registry
 *  (P-CANVAS). Each cell mounts in a `display: contents` wrapper carrying its
 *  id, so the host's own spacing (its `gap-3` stack) applies unchanged. */
export function useCanvasRegions(): CanvasRegions {
  const ws = useWorkspace();
  const [ai] = useSettings("ai");
  // `canvas.cells` (P-PROFILES): the agent's or profile's overrides on the registry.
  const [{ cells: overrides }] = useSettings("canvas");
  const enabled = !!ws.activeInteraction && ai.displayLocation !== "panel";
  if (!enabled) return { enabled, twoColumn: false, pinned: undefined, top: undefined, bottom: undefined, reference: undefined };
  const twoColumn = ai.canvasLayout === "twoColumn";
  const anchor = conversationOrder(overrides);
  const action = canvasCells("action", ws, overrides).filter((cell) => cell.component);
  const reference = canvasCells("reference", ws, overrides);
  const before = action.filter((cell) => cell.order < anchor && !cell.pinned);
  return {
    enabled,
    twoColumn,
    pinned: mount(action.filter((cell) => cell.order < anchor && cell.pinned)),
    top: mount(twoColumn ? before : [...reference, ...before]),
    bottom: mount(action.filter((cell) => cell.order > anchor)),
    reference: twoColumn ? mount(reference) : undefined,
  };
}

/** The reference cells on their own, whatever the AI display: panel mode's Contact Details Overview mounts the same
 *  cards (one implementation each) that the reference column does under inline and main. */
export function useReferenceCells(): ReactNode {
  const ws = useWorkspace();
  const [{ cells: overrides }] = useSettings("canvas");
  return ws.activeInteraction ? mount(canvasCells("reference", ws, overrides)) : undefined;
}

/** A kind cell's regions (P-HOME-1f): its reference cells (with `canvas.cells`
 *  overrides) and any action cells, from the same registry. */
export function useKindCanvasRegions(): { action: ReactNode; reference: ReactNode } {
  const ws = useWorkspace();
  const [{ cells: overrides }] = useSettings("canvas");
  return {
    action: mount(canvasCells("action", ws, overrides, "kind").filter((cell) => cell.component)),
    reference: mount(canvasCells("reference", ws, overrides, "kind")),
  };
}

function mount(cells: CanvasCell[]): ReactNode {
  if (cells.length === 0) return undefined;
  return cells.map(({ id, component: Cell }) => (
    <div key={id} className="contents" data-canvas-cell={id}>
      {Cell && <Cell />}
    </div>
  ));
}
