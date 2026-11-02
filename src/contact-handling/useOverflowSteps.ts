// Measured overflow, one step at a time (P-LAYOUT-F3 6; extracted from the app header's icon row, useWsHeaderApps).
// Not a breakpoint: after every layout it measures the gap between what must stay visible and what can fold away
// (`gap()`), and folds one more step while the gap is below `hideGap` and unfolds one while it's above `showGap`. The
// gap between the two thresholds is the hysteresis: folding a step frees roughly its width, which would otherwise
// clear the unfold threshold at once and flap. The app header folds its icons into "View All Apps"; the assignments
// panel's header folds Sort and Collapse all into its kebab.
import { useLayoutEffect, useRef, useState, type RefObject } from "react";

export function useOverflowSteps({
  max,
  gap,
  hideGap,
  showGap,
  observe,
  active = true,
}: {
  /** False while what it measures isn't rendered (e.g. the panel's actions with under two assignments); turning
   *  true measures again and attaches the observers to the now-mounted boxes. */
  active?: boolean;
  /** How many steps can fold (the header's pinned icons; 1 for an all-or-nothing group). */
  max: number;
  /** The measured gap in px, or null while what it measures isn't mounted. */
  gap: () => number | null;
  hideGap: number;
  showGap: number;
  /** Boxes whose size changes should re-measure (the window's resize always does). Observe the container too: when
   *  it widens, the measured boxes can sit still while the space between them grows. */
  observe: readonly RefObject<Element | null>[];
}): number {
  const [folded, setFolded] = useState(0);
  const gapRef = useRef(gap);
  gapRef.current = gap;
  const observeRef = useRef(observe);
  observeRef.current = observe;
  useLayoutEffect(() => {
    if (!active) return;
    const measure = () => {
      const g = gapRef.current();
      if (g === null) return;
      setFolded((prev) => {
        if (g < hideGap && prev < max) return prev + 1;
        if (g > showGap && prev > 0) return prev - 1;
        return prev;
      });
    };
    measure();
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    for (const ref of observeRef.current) if (ref.current) ro?.observe(ref.current);
    window.addEventListener("resize", measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
    // Re-measured on every step (each change moves the count by one and runs this again, converging), and when the
    // number of foldable steps changes.
  }, [max, folded, hideGap, showGap, active]);
  return Math.min(folded, max);
}
