import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { INITIAL_QUEUE_SUB_ITEMS, type QueueSubItem } from "@/components/agent-next-gen-interaction-dashboard";

/* ── Live queue simulation ──
   The home tab's queue widgets should look "live": every few seconds one
   random sub-item's `inQueueCount` nudges by -1/0/+1 (clamped to [0, 20]).
   That list is the only thing randomized, so the widget's Contacts number
   (`sumInQueue`) and the drilldown's "In Queue" figures can't disagree.
   It used to be page state, so every nudge re-rendered the whole page. Now
   it's a small store, like the page clock (agent-next-gen-page-clock.ts):
   one interval per page mount, and only `<QueueSubItems>` subscribers
   re-render. The walk changes counts, never list lengths. */

export type QueueSubItemsById = Record<string, QueueSubItem[]>;

export interface QueueSim {
  get(): QueueSubItemsById;
  subscribe(onChange: () => void): () => void;
  /** Starts the 4s random walk; returns its cleanup. */
  start(): () => void;
}

function createQueueSim(): QueueSim {
  let state: QueueSubItemsById = INITIAL_QUEUE_SUB_ITEMS;
  const listeners = new Set<() => void>();
  const step = (prev: QueueSubItemsById): QueueSubItemsById => {
    const queueIds = Object.keys(prev);
    const queueId = queueIds[Math.floor(Math.random() * queueIds.length)];
    const items = prev[queueId];
    const itemIndex = Math.floor(Math.random() * items.length);
    const delta = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
    const nextCount = Math.max(0, Math.min(20, items[itemIndex].inQueueCount + delta));
    if (nextCount === items[itemIndex].inQueueCount) return prev;
    return {
      ...prev,
      [queueId]: items.map((item, i) => (i === itemIndex ? { ...item, inQueueCount: nextCount } : item)),
    };
  };
  return {
    get: () => state,
    subscribe(onChange) {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    start() {
      const id = setInterval(() => {
        const next = step(state);
        if (next === state) return;
        state = next;
        listeners.forEach((l) => l());
      }, 4000);
      return () => clearInterval(id);
    },
  };
}

/** Creates the page's queue simulation and runs it while the page is mounted. */
export function useQueueSimSource(): QueueSim {
  const [sim] = useState(createQueueSim);
  useEffect(() => sim.start(), [sim]);
  return sim;
}

export const QueueSimContext = createContext<QueueSim | null>(null);

export function useQueueSubItems(): QueueSubItemsById {
  const sim = useContext(QueueSimContext);
  if (!sim) throw new Error("useQueueSubItems: no QueueSimContext.Provider above this component");
  return useSyncExternalStore(sim.subscribe, sim.get);
}
