// The canvas cell registry (P-CANVAS; PLAN "The main column as a work
// surface"). Under AI display inline and main the main column is two regions:
// the action area (what the agent must do now) and the reference column (the
// reference cards). Every AI card and action item is a cell here, not JSX in
// a page: `{ id, region, order, component }`. The regions render from it, so
// moving a card between regions is a registry change (Flows / P-STUDIO
// arrange cells later; Phase 4 §12 / Flows add script-driven action items).
import type { ComponentType } from "react";
import { DEFAULT_CANVAS_CELLS } from "@/components/workspace/canvas-cells";
import type { Workspace } from "./workspace/controller/useWorkspaceController";

export type CanvasRegion = "action" | "reference";

export interface CanvasCell {
  id: string;
  region: CanvasRegion;
  /** Position within its region, ascending. */
  order: number;
  /** Reads what it needs from `useWorkspace()`; takes no props. Only the
   *  action area's anchor (`conversation`) has none: see below. */
  component?: ComponentType;
  /** Whether this card has the cell (default yes): the cell set varies by
   *  card, e.g. an unknown customer has no Customer Info record. */
  applies?: (ws: Workspace) => boolean;
  /** An action cell before the anchor that stays at the top of the action
   *  area, outside the conversation's scroll (the Next Best Action), rather
   *  than scrolling with the conversation's top. */
  pinned?: boolean;
  /** Which main column the cell is for: a conversation's (default) or a
   *  non-conversation assignment's kind cell (P-HOME-1f). */
  context?: CanvasContext;
}

export type CanvasContext = "conversation" | "kind";

/** The action area's anchor: the conversation itself under inline (the
 *  transcript and composer), the AI feed under main. It is the action area's
 *  scroll container, so it isn't mounted as a cell: the action cells ordered
 *  before it render at its top (the transcript's / feed's overview slot) and
 *  those after it below it (the trailing slot). It can't leave the action area. */
export const CONVERSATION_CELL_ID = "conversation";

/** The narrowest the action area gets beside a docked reference column; below
 *  it plus the column's width, the column becomes the "Summaries" overlay.
 *  Provisional, tuned in the browser (as is the column's width token). */
export const ACTION_AREA_MIN_WIDTH = 480;

let cells = new Map<string, CanvasCell>();

/** Adds a cell, or replaces the one with its id (e.g. moves it to the other region). */
export function registerCanvasCell(cell: CanvasCell): void {
  if (cell.id === CONVERSATION_CELL_ID && cell.region !== "action") {
    throw new Error("canvas-registry: the conversation is the action area's anchor and stays in it");
  }
  cells.set(cell.id, cell);
}

/** A cell's current definition (to re-register it elsewhere). */
export function canvasCellDefinition(id: string): CanvasCell | undefined {
  return cells.get(id);
}

/** Back to the built-in cells (tests; a later "reset arrangement"). */
export function resetCanvasRegistry(): void {
  cells = new Map(DEFAULT_CANVAS_CELLS.map((cell) => [cell.id, cell]));
}
resetCanvasRegistry();

/** Per-cell overrides on the registry's defaults (`canvas.cells`, P-PROFILES;
 *  P-CARDS edits them): on/off, region, order. Unknown ids are ignored. */
export type CanvasCellOverrides = Readonly<Record<string, { enabled?: boolean; region?: CanvasRegion; order?: number }>>;

/** A cell with its override applied, or null when the override turns it off.
 *  The conversation anchor takes an order only: it can't be turned off or
 *  leave the action area. */
function withOverride(cell: CanvasCell, overrides: CanvasCellOverrides): CanvasCell | null {
  const o = overrides[cell.id];
  if (!o) return cell;
  if (cell.id === CONVERSATION_CELL_ID) return o.order === undefined ? cell : { ...cell, order: o.order };
  if (o.enabled === false) return null;
  return { ...cell, region: o.region ?? cell.region, order: o.order ?? cell.order };
}

/** One region's cells, in order, that apply to this card, with `overrides` applied; a conversation's unless `context` says otherwise. */
export function canvasCells(region: CanvasRegion, ws: Workspace, overrides: CanvasCellOverrides = {}, context: CanvasContext = "conversation"): CanvasCell[] {
  return [...cells.values()]
    .map((cell) => withOverride(cell, overrides))
    .filter(
      (cell): cell is CanvasCell =>
        !!cell && cell.region === region && (cell.context ?? "conversation") === context && (cell.applies?.(ws) ?? true),
    )
    .sort((a, b) => a.order - b.order);
}

/** The anchor's order (the split between the action area's top and bottom cells). */
export function conversationOrder(overrides: CanvasCellOverrides = {}): number {
  const anchor = cells.get(CONVERSATION_CELL_ID);
  return (anchor && withOverride(anchor, overrides)?.order) ?? 0;
}
