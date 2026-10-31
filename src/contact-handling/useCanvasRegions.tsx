import { useMemo, type CSSProperties, type ReactNode } from "react";
import { REFERENCE_CELL_PARTS, type ReferenceCellPart } from "@/layout/parts";
import { REFERENCE_CELL_IDS, cellPlace } from "@/layout/presets";
import { useSettings } from "@/settings";
import { canvasCells, conversationOrder, type CanvasCell, type CanvasCellOverrides, type CanvasContent } from "./canvas-registry";
import { useActiveContactSummary, useActiveJourneySummary } from "./reference-cards";
import { copilotAsksOf } from "./useCopilotAsk";
import { useWorkspace } from "./workspace/WorkspaceContext";

/** The reference cards' entering stagger (P-HOME-1n, as the Home v2 wireframe's rise): each card in a region starts
 *  this much after the one before. */
const ENTER_STAGGER_MS = 60;

/** What the reference cards could show for the active card, read once (`CanvasContent`): the cells' `hasContent`
 *  rules decide from it. The same reads the cards themselves make (`useActiveContactSummary`,
 *  `useActiveJourneySummary`, `copilotAsksOf`). */
function useCanvasContent(): CanvasContent {
  const { activeInteraction } = useWorkspace();
  const summary = useActiveContactSummary();
  const journeyRows = useActiveJourneySummary()?.rows.length ?? 0;
  const asks = activeInteraction ? copilotAsksOf(activeInteraction).length : 0;
  return { summary: !!summary, asks, journeyRows };
}

export interface CanvasRegions {
  /** AI display inline or main, with a card selected: the canvas applies. */
  enabled: boolean;
  /** The reference column shows (`ai.canvasLayout` "twoColumn"; since P-LAYOUT, no reference cell is above the
   *  action area in `layout.parts`). */
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
  const [{ parts }] = useSettings("layout");
  const overrides = useCellOverrides();
  const content = useCanvasContent();
  // P-LAYOUT: the canvas applies while the AI feed isn't in the docked panel (AI display inline and main).
  const enabled = !!ws.activeInteraction && parts.aiFeed.slot !== "docked-panel";
  if (!enabled) return { enabled, twoColumn: false, pinned: undefined, top: undefined, bottom: undefined, reference: undefined };
  // The reference column shows when a reference-cell part is in it, or none sits above the action area
  // (`ai.canvasLayout` "stacked" puts them all there; a custom map can split them).
  const places = REFERENCE_CELL_PARTS.map((p) => cellPlace(parts, p));
  const twoColumn = places.includes("reference") || !places.includes("before");
  const anchor = conversationOrder(overrides);
  const action = canvasCells("action", ws, overrides).filter((cell) => cell.component);
  // P-HOME-1n: an empty reference card doesn't render (its `hasContent`).
  const reference = canvasCells("reference", ws, overrides, "conversation", content);
  // A reference cell goes to the column if its part is in the reference slot, above the action area if it's in the
  // main column; a cell with no part (a registry cell, e.g. from Flows) follows the column.
  const inColumn = (cell: CanvasCell) => {
    const part = CELL_PART[cell.id];
    return part ? parts[part].slot === "reference" : twoColumn;
  };
  const before = action.filter((cell) => cell.order < anchor && !cell.pinned);
  const column = reference.filter(inColumn);
  return {
    enabled,
    twoColumn,
    pinned: mount(action.filter((cell) => cell.order < anchor && cell.pinned)),
    top: mount([...reference.filter((cell) => !inColumn(cell)), ...before]),
    bottom: mount(action.filter((cell) => cell.order > anchor)),
    reference: twoColumn ? mount(column) : undefined,
  };
}

/** Each reference-cell part by its canvas cell id. */
const CELL_PART: Record<string, ReferenceCellPart> = Object.fromEntries(
  REFERENCE_CELL_PARTS.map((p) => [REFERENCE_CELL_IDS[p].cell, p]),
) as Record<string, ReferenceCellPart>;

/** `canvas.cells` (P-PROFILES; on/off and order) with each reference-cell part's region from `layout.parts`
 *  (P-LAYOUT): "action" when the map puts it after the conversation, the registry's own region otherwise. */
function useCellOverrides(): CanvasCellOverrides {
  const [{ cells }] = useSettings("canvas");
  const [{ parts }] = useSettings("layout");
  return useMemo(() => {
    const out: Record<string, CanvasCellOverrides[string]> = { ...cells };
    // After the conversation as the map says (Settings → Layout and its preview show it there), in the map's order:
    // the cell's own canvas order would put a low-ordered cell back above it.
    const anchor = conversationOrder(cells);
    for (const part of REFERENCE_CELL_PARTS) {
      const id = REFERENCE_CELL_IDS[part].cell;
      const { region: _legacy, ...rest } = cells[id] ?? {};
      const entry = cellPlace(parts, part) === "after" ? { ...rest, region: "action" as const, order: anchor + 1 + Math.max(0, parts[part].order) } : rest;
      if (Object.keys(entry).length > 0) out[id] = entry;
      else delete out[id];
    }
    return out;
  }, [cells, parts]);
}

/** The reference cells on their own, whatever the AI display: panel mode's Contact Details Overview mounts the same
 *  cards (one implementation each) that the reference column does under inline and main. */
export function useReferenceCells(): ReactNode {
  const ws = useWorkspace();
  const overrides = useCellOverrides();
  const content = useCanvasContent();
  return ws.activeInteraction ? mount(canvasCells("reference", ws, overrides, "conversation", content)) : undefined;
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

/** Each cell in a `display: contents` wrapper carrying its id and its place in the entering stagger (the cards' own
 *  enter animation reads `--canvas-enter-delay`; a card that appears later enters at its place). Leaving is a plain
 *  unmount. */
function mount(cells: CanvasCell[]): ReactNode {
  if (cells.length === 0) return undefined;
  return cells.map(({ id, component: Cell }, index) => (
    <div key={id} className="contents" data-canvas-cell={id} style={{ "--canvas-enter-delay": `${index * ENTER_STAGGER_MS}ms` } as CSSProperties}>
      {Cell && <Cell />}
    </div>
  ));
}
