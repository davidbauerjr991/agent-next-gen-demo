import type { ReactNode } from "react";
import { useClockValue, usePageClock } from "@/components/agent-next-gen-page-clock";
import { useQueueSubItems, type QueueSubItemsById } from "@/components/agent-next-gen-queue-sim";

/* Self-ticking render props. Wrap only the element that shows a live value,
   so a tick re-renders that element and nothing above it. The page clock and
   the queue simulation come from context (agent-next-gen-page-clock.ts,
   agent-next-gen-queue-sim.ts). */

/** Re-renders `children` every page-clock tick. */
export function ClockTick({ children }: { children: (clockTick: number) => ReactNode }) {
  const clock = usePageClock();
  const tick = useClockValue(clock, (t) => t);
  return <>{children(tick)}</>;
}

/** Re-renders `children` only when `select(tick)` changes. `select` must
 *  return a primitive. */
export function ClockValue<T>({ select, children }: { select: (clockTick: number) => T; children: (value: T) => ReactNode }) {
  const clock = usePageClock();
  const value = useClockValue(clock, select);
  return <>{children(value)}</>;
}

/** Re-renders `children` whenever the live queue simulation changes. */
export function QueueSubItems({ children }: { children: (subItems: QueueSubItemsById) => ReactNode }) {
  const subItems = useQueueSubItems();
  return <>{children(subItems)}</>;
}
