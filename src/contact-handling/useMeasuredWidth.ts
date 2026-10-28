// An element's measured width as React state, without a render per animation
// frame (P-HOME-1m, the left-nav / Contact Details judder): lyra animates the
// rail's and the panel's widths in CSS, and a ResizeObserver feeding raw
// pixels into the workspace controller re-rendered the whole workspace on
// every frame of it (every rail card, the transcript, ~1,100 tooltips). The
// width commits at once when it crosses one of the caller's `bands` (the
// breakpoints the layout reads), and otherwise once the size settles.
import { useEffect, useRef, useState, type RefObject } from "react";

/** How long a size must hold before an in-band change commits. */
const SETTLE_MS = 150;

/** `target`'s width (9999 until measured). `bands`: the thresholds its readers branch on, e.g. `(w) => w < 768`.
 *  `live`: while it returns true, every change commits (a reader sizes itself to the exact width, e.g. a full-screen
 *  panel that must follow the rail's animation). */
export function useMeasuredWidth(
  target: RefObject<HTMLElement | null> | HTMLElement | null,
  bands: readonly ((width: number) => boolean)[],
  live?: () => boolean,
): number {
  const [width, setWidth] = useState(9999);
  // The readers' thresholds and the live test, read fresh (callers pass inline arrows).
  const bandsRef = useRef(bands);
  bandsRef.current = bands;
  const liveRef = useRef(live);
  liveRef.current = live;
  useEffect(() => {
    const el = target && "current" in target ? target.current : target;
    if (!el) return;
    const band = (w: number) => bandsRef.current.map((inBand) => inBand(w)).join();
    let committed = el.getBoundingClientRect().width;
    setWidth(committed);
    let timer: number | undefined;
    const commit = (w: number) => {
      committed = w;
      setWidth(w);
    };
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      window.clearTimeout(timer);
      if (liveRef.current?.() || band(w) !== band(committed)) commit(w);
      else if (w !== committed) timer = window.setTimeout(() => commit(w), SETTLE_MS);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      window.clearTimeout(timer);
    };
  }, [target]);
  return width;
}
