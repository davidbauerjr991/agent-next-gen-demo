// Calls placed from schedule items (P-HOME-1d, -1e): a callback's Dial (or a
// task's "Call <customer>") opens the dial pad, never dials directly; the
// call carries the item's customer (name, record, the reason as its summary
// line) and joins the item's card as its voice leg — its journey is the
// item's assignment (`assignmentIdFor(scheduleCardKey(id))`), the same way a
// channel added to a conversation card joins that card. When the call's
// wrap-up is done, a callback completes with the call's disposition and
// leaves the rail, while a task stays open and gets the call's summary as a
// note. P0.9 generalizes the leg-join to every assignment (PROGRESS Known gaps).
import { useCallback, useEffect, useRef } from "react";
import { scheduleCardKey, scheduleItemIdOf } from "@/domain";
import { useInteractions, useScheduleProvider, useScheduleSnapshot } from "@/provider-context";
import type { ScheduleItem } from "@/providers";
import { useWorkspace } from "../workspace/WorkspaceContext";
import { useWorkspaceUiField } from "../workspace-ui-store";

/** The number and reason a call from `item` carries, or `null` when it has no number. */
export function scheduleCallTarget(item: ScheduleItem): { phone: string; summary: string[] } | null {
  const d = item.detail;
  if (d.kind === "callback") return { phone: d.phone, summary: [d.reason] };
  const phone = item.customer?.phone;
  if (!phone) return null;
  return { phone, summary: d.kind === "task" ? [`${d.ticket}: ${d.summary}`] : [item.subtitle] };
}

/** Opens the dial pad beneath `anchorEl` for a call from `item`, prefilled with the customer's number. `openFirst`
 *  (a Home preview's Dial, P-HOME-1i): confirming opens the item into the rail, then places the call, which joins its
 *  card as the voice leg and shows; cancelling leaves the item where it was. */
export function useScheduleDial(): (item: ScheduleItem, anchorEl: HTMLElement | null, options?: { openFirst?: boolean }) => void {
  const { outboundDial } = useWorkspace();
  const schedule = useScheduleProvider();
  const [, setKindCellShownFor] = useWorkspaceUiField("kindCellShownFor");
  return useCallback(
    (item, anchorEl, options) => {
      const target = scheduleCallTarget(item);
      if (!target) return;
      // The call becomes the card's selected row once it's placed (the main column follows it).
      setKindCellShownFor(null);
      outboundDial.openScheduleDialPad(
        {
          itemId: item.id,
          phoneNumber: target.phone,
          contactName: item.customer?.name ?? target.phone,
          ...(item.customer?.entityId ? { entityId: item.customer.entityId } : {}),
          summary: target.summary,
          ...(options?.openFirst && schedule ? { beforePlace: () => schedule.open(item.id) } : {}),
        },
        anchorEl,
      );
    },
    [outboundDial, schedule, setKindCellShownFor],
  );
}

/** A training's Start or a meeting's Join (P-HOME-1i): marks it started and, if it isn't open yet, opens it into the
 *  rail as the active assignment. The cell shows it started. */
export function useStartScheduleItem(): (item: ScheduleItem) => void {
  const [, setStarted] = useWorkspaceUiField("kindStarted");
  const { switchActiveInteraction } = useWorkspace();
  const schedule = useScheduleProvider();
  return useCallback(
    (item) => {
      // Started once it's open (a failed open leaves it as it was).
      const show = () => {
        setStarted((prev) => new Set(prev).add(item.id));
        switchActiveInteraction(scheduleCardKey(item.id));
      };
      if (item.state === "active") return show();
      schedule?.open(item.id).then(show, (err) => {
        if (import.meta.env.DEV) console.warn("[schedule] start failed", err);
      });
    },
    [setStarted, switchActiveInteraction, schedule],
  );
}

/** Watches the voice legs on schedule items' cards; mount once, at the workspace controller. */
export function useScheduleCallWrapUps(): void {
  const interactions = useInteractions();
  const snapshot = useScheduleSnapshot();
  const schedule = useScheduleProvider();
  const handled = useRef(new Set<string>());

  useEffect(() => {
    if (!schedule) return;
    for (const call of interactions) {
      const itemId = scheduleItemIdOf(call.journeyId);
      if (!itemId || call.state !== "ended" || handled.current.has(call.id)) continue;
      handled.current.add(call.id);
      const item = snapshot?.items.find((i) => i.id === itemId);
      if (!item) continue;
      const disposition = call.outcome?.dispositionCode;
      const fail = (err: unknown) => {
        if (import.meta.env.DEV) console.warn("[schedule] call follow-up failed", err);
      };
      if (item.kind === "callback" && item.state === "active") {
        // The callback is done: it completes with the call's disposition and leaves the rail (its cell closes with it).
        schedule.complete(item.id, { ...(disposition ? { disposition } : {}), note: call.outcome?.summary?.trim() || "Called" }).catch(fail);
      } else if (item.state !== "done" && item.state !== "declined") {
        // A task (or anything else) stays open; the call's summary joins its notes.
        const summary = call.outcome?.summary?.trim() || (disposition ? `Call: ${disposition}` : "Call completed");
        schedule.addNote(item.id, summary).catch(fail);
      }
    }
  }, [interactions, snapshot, schedule]);
}
