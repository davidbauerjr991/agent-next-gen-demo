// Toasts for other assignments (PLAN.md "Toasts for other assignments";
// P-HOME-1): an event on an assignment the agent isn't looking at raises a
// toast; every toast is also a row in the Notifications drawer (the toast is
// the transient layer, the drawer the log). The rules, without React.
import type { AssignmentId, AssignmentKind, ChannelKind } from "@/domain";
import type { ToastEvent, ToastSettings } from "@/settings";

export interface AssignmentToast {
  id: string;
  assignmentId: AssignmentId;
  event: ToastEvent;
  kind: AssignmentKind;
  /** The rail card it's about (a journey id, or `schedule:<id>`). */
  cardId: string;
  /** The leg it's about, for View to open. */
  threadKey?: string;
  /** For a schedule item that isn't open yet: View opens it (or, with `preview`, its feed row's preview). */
  scheduleItemId?: string;
  /** View opens the schedule item's feed-row preview on Home rather than the item (a new work item, P-HOME-1m). */
  preview?: boolean;
  /** An offered conversation (the incoming toast, P-HOME-1n): View goes to its tile, where Accept / Decline are. */
  offer?: boolean;
  name: string;
  channel?: ChannelKind;
  line: string;
  /** Stays until acted on (approvals; SLA breaches later). */
  urgent: boolean;
  /** Gone from the stack (View, Dismiss, timed out); still in the drawer. */
  dismissed?: boolean;
}

/** How many toasts show at once; the rest are "+N more". */
const VISIBLE_TOASTS = 3;

/** The events that stay until acted on, and that `quietOnVoice` never holds back. */
export const URGENT_TOAST_EVENTS: readonly ToastEvent[] = ["approval"];

/** Whether `event` raises a toast under `settings` (`onCall`: the agent is on a live call). `forced`: a setting
 *  constraint holds this event on (the incoming toast under placement "none"), so "Quiet during a call" doesn't hold
 *  it back either. */
export function toastAllowed(event: ToastEvent, settings: ToastSettings, onCall: boolean, forced = false): boolean {
  if (!settings.enabled || !settings.events[event]) return false;
  return !(settings.quietOnVoice && onCall && !forced && !URGENT_TOAST_EVENTS.includes(event));
}

/** The stack, newest first: the visible toasts and how many more wait. */
export function toastStack(toasts: readonly AssignmentToast[]): { shown: AssignmentToast[]; more: number } {
  const live = toasts.filter((t) => !t.dismissed).reverse();
  return { shown: live.slice(0, VISIBLE_TOASTS), more: Math.max(0, live.length - VISIBLE_TOASTS) };
}

export const TOAST_NOTIFICATION_PREFIX = "toast:";
