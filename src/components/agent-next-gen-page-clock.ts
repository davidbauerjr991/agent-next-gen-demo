import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";

/* ── Page clock ──
   The workspace pages' shared 1-per-second counter (the `clockTick` scale
   every `Thread.startTick`/`heldSinceTick`/`lastCustomerMessageTick` is
   measured on). It used to be page state, so every tick re-rendered the
   whole page. Now it's a small store: one interval per page mount, and
   only the components that subscribe re-render.

   - Display: `<ClockTick>`/`<ClockValue>` (agent-next-gen-clock-tick.tsx),
     which read `PageClockContext`.
   - Logic that only needs the current tick (handlers, timeouts):
     `clock.now()`. It never causes a render.
   - Page-level values that change only at thresholds (SLA severity):
     `useClockValue(clock, select)`, which re-renders only when the
     selected primitive changes.

   Created per page mount, so tick 0 is still "page mounted", as before.
   Ticks are computed from wall-clock time since `anchorMs` (P0.5b.2), not
   counted, so a throttled background tab can't drift from the store's
   wall-clock timestamps (`tickClock(anchorMs)` in nav-card-view-model.ts
   uses the same scale). The interval only notifies subscribers. */

export interface PageClock {
  /** Seconds since this clock started (the page's `clockTick`). */
  now(): number;
  /** `Date.now()` at tick 0. */
  readonly anchorMs: number;
  subscribe(onTick: () => void): () => void;
  /** Starts the 1s interval; returns its cleanup. */
  start(): () => void;
}

function createPageClock(anchorMs: number = Date.now()): PageClock {
  const listeners = new Set<() => void>();
  return {
    now: () => Math.floor((Date.now() - anchorMs) / 1000),
    anchorMs,
    subscribe(onTick) {
      listeners.add(onTick);
      return () => listeners.delete(onTick);
    },
    start() {
      const id = setInterval(() => {
        listeners.forEach((l) => l());
      }, 1000);
      return () => clearInterval(id);
    },
  };
}

/** Creates the page's clock and runs it while the page is mounted.
 *  StrictMode's effect replay restarts the interval; the tick count is kept. */
export function usePageClockSource(): PageClock {
  const [clock] = useState(createPageClock);
  useEffect(() => clock.start(), [clock]);
  return clock;
}

export const PageClockContext = createContext<PageClock | null>(null);

export function usePageClock(): PageClock {
  const clock = useContext(PageClockContext);
  if (!clock) throw new Error("usePageClock: no PageClockContext.Provider above this component");
  return clock;
}

/** Re-renders the caller only when `select(tick)` changes. `select` must
 *  return a primitive (or a stable reference). */
export function useClockValue<T>(clock: PageClock, select: (tick: number) => T): T {
  return useSyncExternalStore(clock.subscribe, () => select(clock.now()));
}
