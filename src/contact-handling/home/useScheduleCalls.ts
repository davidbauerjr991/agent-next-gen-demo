// Calls placed from schedule items (P-HOME-1d), until P0.9: a callback's Dial
// (or a task's "Call <customer>") opens the dial pad, never dials directly; the
// call carries the item's customer (name, record, the reason as its summary
// line); when the call's wrap-up is done, a callback completes with the call's
// disposition and leaves the rail, while a task stays open and gets the call's
// summary as a note.
// P0.9: the call becomes a leg of the callback's (or task's) assignment
// instead of its own card, and this link-and-watch goes away (PROGRESS Known gaps).
import { useCallback, useEffect, useRef } from "react";
import type { InteractionId } from "@/domain";
import { useInteractions, useScheduleProvider, useScheduleSnapshot } from "@/provider-context";
import type { ScheduleItem } from "@/providers";
import { useWorkspace } from "../workspace/WorkspaceContext";
import { useWorkspaceUiStore } from "../workspace-ui-store";

/** The number and reason a call from `item` carries, or `null` when it has no number. */
export function scheduleCallTarget(item: ScheduleItem): { phone: string; summary: string[] } | null {
  const d = item.detail;
  if (d.kind === "callback") return { phone: d.phone, summary: [d.reason] };
  const phone = item.customer?.phone;
  if (!phone) return null;
  return { phone, summary: d.kind === "task" ? [`${d.ticket}: ${d.summary}`] : [item.subtitle] };
}

/** Opens the dial pad beneath `anchorEl` for a call from `item`, prefilled with the customer's number. */
export function useScheduleDial(): (item: ScheduleItem, anchorEl: HTMLElement | null) => void {
  const { outboundDial } = useWorkspace();
  const store = useWorkspaceUiStore();
  return useCallback(
    (item, anchorEl) => {
      const target = scheduleCallTarget(item);
      if (!target) return;
      outboundDial.openScheduleDialPad(
        {
          itemId: item.id,
          phoneNumber: target.phone,
          contactName: item.customer?.name ?? target.phone,
          ...(item.customer?.entityId ? { entityId: item.customer.entityId } : {}),
          summary: target.summary,
          onPlaced: (callId: InteractionId) =>
            store.update((state) => ({ ...state, scheduleCallLinks: { ...state.scheduleCallLinks, [callId]: item.id } })),
        },
        anchorEl,
      );
    },
    [outboundDial, store],
  );
}

/** Watches the calls placed from schedule items; mount once, at the workspace controller. */
export function useScheduleCallWrapUps(): void {
  const interactions = useInteractions();
  const snapshot = useScheduleSnapshot();
  const schedule = useScheduleProvider();
  const store = useWorkspaceUiStore();
  const handled = useRef(new Set<string>());

  useEffect(() => {
    if (!schedule) return;
    const links = store.getState().scheduleCallLinks;
    for (const [callId, itemId] of Object.entries(links)) {
      const call = interactions.find((i) => i.id === callId);
      if (!call || call.state !== "ended" || handled.current.has(callId)) continue;
      handled.current.add(callId);
      store.update((state) => {
        const { [callId]: _done, ...rest } = state.scheduleCallLinks;
        return { ...state, scheduleCallLinks: rest };
      });
      const item = snapshot?.items.find((i) => i.id === itemId);
      if (!item) continue;
      const disposition = call.outcome?.dispositionCode;
      const fail = (err: unknown) => {
        if (import.meta.env.DEV) console.warn("[schedule] call follow-up failed", err);
      };
      if (item.kind === "callback" && item.state === "active") {
        // The callback is done: it completes with the call's disposition and leaves the rail (its cell closes with it).
        schedule.complete(item.id, { ...(disposition ? { disposition } : {}), note: call.outcome?.summary?.trim() || "Called" }).catch(fail);
      } else if (item.state !== "done") {
        // A task (or anything else) stays open; the call's summary joins its notes.
        const summary = call.outcome?.summary?.trim() || (disposition ? `Call: ${disposition}` : "Call completed");
        schedule.addNote(item.id, summary).catch(fail);
      }
    }
  }, [interactions, snapshot, schedule, store]);
}
