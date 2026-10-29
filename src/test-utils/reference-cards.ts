// Tests about where the reference cards go and how they open (regions, overrides, the slide-over over the column,
// the AI's focus, panel mode's Overview) rather than when an empty card hides: those re-register the Real-Time
// Summary and the Journey Summary without their `hasContent` rule (P-HOME-1n), so every card renders as before.
// The emptiness rule itself is `canvas-hascontent.test.tsx`'s. Call in `beforeEach`; `resetCanvasRegistry()` undoes it.
import { canvasCellDefinition, registerCanvasCell } from "@/contact-handling/canvas-registry";

export function showEmptyReferenceCards(): void {
  for (const id of ["real-time-summary", "journey-summary"]) {
    const cell = canvasCellDefinition(id);
    if (cell) registerCanvasCell({ ...cell, hasContent: undefined });
  }
}
