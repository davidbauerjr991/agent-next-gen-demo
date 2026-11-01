import type { ReactNode } from "react";
import { useClockValue, useElapsedSince, usePageClock } from "@/components/agent-next-gen-page-clock";
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

/** A live "mm:ss" since `since`: only this text re-renders each second, not the row or card holding it (lyra's timer
 *  props take it as a node, F2-L3). */
export function ElapsedSince({ since }: { since: number }) {
  return <>{useElapsedSince(since)}</>;
}

/** Re-renders `children` whenever the live queue simulation changes. */
export function QueueSubItems({ children }: { children: (subItems: QueueSubItemsById) => ReactNode }) {
  const subItems = useQueueSubItems();
  return <>{children(subItems)}</>;
}
