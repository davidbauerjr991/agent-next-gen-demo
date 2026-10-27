import type { EpochMs } from "../../domain";
import type { ScheduleEvents, ScheduleItem, ScheduleProvider, ScheduleRole, ScheduleSnapshot } from "../../providers";
import { providerError } from "../provider-error";
import { SIM_SCHEDULE_CARDS, seedScheduleDay } from "./sim-schedule-seeds";
import { DEFAULT_LATENCY, type LatencyRange } from "./sim-transport";
import { sampleMs } from "./sim-util";

type AnyHandler = (payload: never) => void;

/** The stub schedule source (P-HOME-1): one seeded day per role, held in
 *  memory. Listing a different role replaces the day; opening and completing
 *  items, and items coming due, arrive as events after the sim's latency. */
export function createSimScheduleProvider(options?: { latency?: LatencyRange; now?: () => EpochMs }): ScheduleProvider {
  const latency = options?.latency ?? DEFAULT_LATENCY;
  const now = options?.now ?? (() => Date.now());
  const listeners = new Map<keyof ScheduleEvents, Set<AnyHandler>>();
  const dueTimers = new Map<string, ReturnType<typeof setTimeout>>();
  let items = new Map<string, ScheduleItem>();
  let role: ScheduleRole | null = null;
  let disposed = false;

  const delay = () => new Promise<void>((resolve) => setTimeout(resolve, sampleMs(latency)));

  function emit<K extends keyof ScheduleEvents>(type: K, payload: ScheduleEvents[K]): void {
    for (const handler of [...(listeners.get(type) ?? [])]) {
      try {
        (handler as (event: ScheduleEvents[K]) => void)(payload);
      } catch (err) {
        if (import.meta.env.DEV) console.error(`[sim] schedule ${String(type)} listener threw`, err);
      }
    }
  }

  const snapshot = (): ScheduleSnapshot => ({
    role: role ?? "agent",
    items: [...items.values()],
    cards: SIM_SCHEDULE_CARDS[role ?? "agent"],
  });

  function clearDueTimers(): void {
    for (const timer of dueTimers.values()) clearTimeout(timer);
    dueTimers.clear();
  }

  function armDue(item: ScheduleItem): void {
    if (item.state !== "scheduled") return;
    const wait = item.dueAt - now();
    if (wait <= 0) return;
    dueTimers.set(
      item.id,
      setTimeout(() => {
        dueTimers.delete(item.id);
        const current = items.get(item.id);
        if (current?.state === "scheduled") emit("itemDue", { item: current });
      }, wait),
    );
  }

  function guard(method: string): void {
    if (disposed) throw providerError("invalid-state", `ScheduleProvider.${method}: provider is disposed`);
  }

  function update(id: string, method: string, from: readonly ScheduleItem["state"][], change: Partial<ScheduleItem>): void {
    const item = items.get(id);
    if (!item) throw providerError("not-found", `ScheduleProvider.${method}: no item ${id}`);
    if (!from.includes(item.state)) throw providerError("invalid-state", `ScheduleProvider.${method}: item ${id} is ${item.state}`);
    const next = { ...item, ...change };
    items.set(id, next);
    // Leaving `scheduled` (opened, completed) cancels the due timer; a note doesn't.
    if (next.state !== item.state) {
      const timer = dueTimers.get(id);
      if (timer) clearTimeout(timer);
      dueTimers.delete(id);
    }
    emit("itemChanged", { item: next });
  }

  return {
    on(type, handler) {
      let set = listeners.get(type);
      if (!set) {
        set = new Set();
        listeners.set(type, set);
      }
      set.add(handler as AnyHandler);
      return () => {
        set.delete(handler as AnyHandler);
      };
    },
    async listItems(query) {
      guard("listItems");
      await delay();
      guard("listItems");
      if (role !== query.role) {
        clearDueTimers();
        role = query.role;
        items = new Map(seedScheduleDay(query.role, now()).map((item) => [item.id, item]));
        for (const item of items.values()) armDue(item);
        emit("reset", { snapshot: snapshot() });
      }
      return snapshot();
    },
    async open(id) {
      guard("open");
      await delay();
      guard("open");
      update(id, "open", ["offered", "scheduled"], { state: "active" });
    },
    async release(id) {
      guard("release");
      await delay();
      guard("release");
      update(id, "release", ["active"], { state: "scheduled" });
      // Back in the feed: still due when it was.
      armDue(items.get(id)!);
    },
    async decline(id) {
      guard("decline");
      await delay();
      guard("decline");
      update(id, "decline", ["offered"], { state: "declined" });
    },
    async park(id) {
      guard("park");
      await delay();
      guard("park");
      // Leaving `scheduled` cancels its due timer (update); the original due is kept for unpark.
      update(id, "park", ["scheduled"], { state: "parked", parkedAt: now() });
    },
    async unpark(id) {
      guard("unpark");
      await delay();
      guard("unpark");
      const item = items.get(id);
      const dueAt = item && item.dueAt > now() ? item.dueAt : now();
      update(id, "unpark", ["parked"], { state: "scheduled", dueAt, parkedAt: undefined });
      armDue(items.get(id)!);
    },
    async remove(id) {
      guard("remove");
      await delay();
      guard("remove");
      const item = items.get(id);
      if (!item) throw providerError("not-found", `ScheduleProvider.remove: no item ${id}`);
      if (!item.deletable) throw providerError("invalid-state", `ScheduleProvider.remove: item ${id} wasn't created by the agent`);
      items.delete(id);
      const timer = dueTimers.get(id);
      if (timer) clearTimeout(timer);
      dueTimers.delete(id);
      emit("itemRemoved", { id });
    },
    async complete(id, outcome) {
      guard("complete");
      await delay();
      guard("complete");
      update(id, "complete", ["active"], { state: "done", completedAt: now(), outcome });
    },
    async addNote(id, note) {
      guard("addNote");
      await delay();
      guard("addNote");
      const notes = [...(items.get(id)?.notes ?? []), note];
      update(id, "addNote", ["offered", "scheduled", "active"], { notes });
    },
    async dispose() {
      if (disposed) return;
      disposed = true;
      clearDueTimers();
      listeners.clear();
    },
  };
}
