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
  /** For a schedule item that isn't open yet: View opens it. */
  scheduleItemId?: string;
  name: string;
  channel?: ChannelKind;
  line: string;
  /** Stays until acted on (approvals; SLA breaches later). */
  urgent: boolean;
  /** Gone from the stack (View, Dismiss, timed out); still in the drawer. */
  dismissed?: boolean;
}

/** How many toasts show at once; the rest are "+N more". */
export const VISIBLE_TOASTS = 3;

/** The events that stay until acted on, and that `quietOnVoice` never holds back. */
export const URGENT_TOAST_EVENTS: readonly ToastEvent[] = ["approval"];

/** Whether `event` raises a toast under `settings` (`onCall`: the agent is on a live call). */
export function toastAllowed(event: ToastEvent, settings: ToastSettings, onCall: boolean): boolean {
  if (!settings.enabled || !settings.events[event]) return false;
  return !(settings.quietOnVoice && onCall && !URGENT_TOAST_EVENTS.includes(event));
}

/** The stack, newest first: the visible toasts and how many more wait. */
export function toastStack(toasts: readonly AssignmentToast[]): { shown: AssignmentToast[]; more: number } {
  const live = toasts.filter((t) => !t.dismissed).reverse();
  return { shown: live.slice(0, VISIBLE_TOASTS), more: Math.max(0, live.length - VISIBLE_TOASTS) };
}

export const TOAST_NOTIFICATION_PREFIX = "toast:";

/** Initials for a toast's avatar ("Maya Chen" → "MC"). */
export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}
