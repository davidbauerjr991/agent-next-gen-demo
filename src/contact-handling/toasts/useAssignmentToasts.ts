import { useCallback, useEffect, useRef } from "react";
import type { AgentNotification } from "@nicecxone/lyra-ui";
import { assignmentIdFor, scheduleCardKey, type ChannelKind } from "@/domain";
import { useInteractionProvider, useScheduleProvider } from "@/provider-context";
import { useSettings, type ToastEvent } from "@/settings";
import { t } from "@/i18n";
import type { useWsHeaderApps } from "../workspace/controller/useWsHeaderApps";
import { useWorkspaceUiStore } from "../workspace-ui-store";
import { TOAST_NOTIFICATION_PREFIX, URGENT_TOAST_EVENTS, toastAllowed, type AssignmentToast } from "./assignment-toasts";

/** The workspace as the controller's last slice builds it (before this hook's own API is added). */
type WorkspaceBase = ReturnType<typeof useWsHeaderApps>;

const NOTIFICATION_TITLES: Record<ToastEvent, string> = {
  message: "New message",
  approval: "Approval requested",
  callbackDue: "Callback due",
  awaitingReply: "Waiting for your reply",
  workItem: "Work item update",
  transfer: "Transfer arriving",
};

/** Focuses the composer once the opened thread has rendered it. */
function focusComposerSoon(tries = 10) {
  requestAnimationFrame(() => {
    const el = document.querySelector<HTMLTextAreaElement>("[data-composer-input]");
    if (el && !el.disabled) el.focus();
    else if (tries > 0) focusComposerSoon(tries - 1);
  });
}

/** Raises toasts for events on assignments other than the active one and
 *  logs each in the Notifications drawer; returns View and Dismiss. Mounted
 *  once, at the workspace controller. */
export function useAssignmentToasts(ws: WorkspaceBase) {
  const provider = useInteractionProvider();
  const schedule = useScheduleProvider();
  const store = useWorkspaceUiStore();
  const [{ toasts: settings }] = useSettings("notifications");
  // The handlers below read the latest of these, not the values they were registered with.
  const latest = useRef({ ws, settings });
  latest.current = { ws, settings };
  // Toast ids, per workspace mount (a toast's id is also its drawer row's).
  const counter = useRef(0);

  const raise = useCallback(
    (toast: Omit<AssignmentToast, "id" | "urgent">) => {
      const { ws: w, settings: s } = latest.current;
      if (!toastAllowed(toast.event, s, !!w.liveVoiceCallInteraction)) return;
      counter.current += 1;
      const id = `${TOAST_NOTIFICATION_PREFIX}${counter.current}`;
      const full: AssignmentToast = { ...toast, id, urgent: URGENT_TOAST_EVENTS.includes(toast.event) };
      store.update((state) => ({ ...state, assignmentToasts: [...state.assignmentToasts, full] }));
      const row: AgentNotification = {
        id,
        type: toast.event === "approval" ? "escalation" : "custom",
        title: t(NOTIFICATION_TITLES[toast.event]),
        subtitle: `${toast.name} · ${toast.line}`,
        timestamp: t("Just now"),
        read: false,
      };
      w.setNotifications((prev) => [row, ...prev]);
    },
    [store],
  );

  // A message or an approval request on a conversation the agent isn't looking at.
  useEffect(
    () =>
      provider.on("message", ({ message }) => {
        const { ws: w } = latest.current;
        const card = w.interactions.find((c) => c.threads.some((th) => th.providerInteractionId === message.interactionId));
        if (!card || card.offered || card.id === w.activeInteractionId) return;
        const thread = card.threads.find((th) => th.providerInteractionId === message.interactionId);
        const approval = message.annotation?.kind === "approval" && !message.annotation.response && !message.annotation.withdrawn;
        const event: ToastEvent | null = approval ? "approval" : message.kind === "text" && message.author.role === "customer" ? "message" : null;
        if (!event) return;
        raise({
          event,
          assignmentId: assignmentIdFor(card.id),
          kind: "conversation",
          cardId: card.id,
          ...(thread ? { threadKey: thread.id, channel: thread.type as ChannelKind } : {}),
          name: card.presentedName ?? card.customerName ?? card.customerId,
          line: approval ? t("{agent} requested approval", { agent: message.annotation?.by ?? t("AI agent") }) : message.text,
        });
      }),
    [provider, raise],
  );

  // A scheduled callback reaching its time.
  useEffect(() => {
    if (!schedule) return;
    return schedule.on("itemDue", ({ item }) => {
      if (item.kind !== "callback") return;
      raise({
        event: "callbackDue",
        assignmentId: assignmentIdFor(scheduleCardKey(item.id)),
        kind: "callback",
        cardId: scheduleCardKey(item.id),
        scheduleItemId: item.id,
        name: item.customer?.name ?? item.title,
        line: item.subtitle,
      });
    });
  }, [schedule, raise]);

  const dismiss = useCallback(
    (id: string) =>
      store.update((state) => ({
        ...state,
        assignmentToasts: state.assignmentToasts.map((toast) => (toast.id === id ? { ...toast, dismissed: true } : toast)),
      })),
    [store],
  );

  /** Switches to the toast's assignment, filtered to its leg, with the composer focused. */
  const view = useCallback(
    (toast: AssignmentToast) => {
      const { ws: w } = latest.current;
      dismiss(toast.id);
      w.setNotifications((prev) => prev.map((n) => (n.id === toast.id ? { ...n, read: true } : n)));
      if (toast.scheduleItemId) {
        const itemId = toast.scheduleItemId;
        schedule?.open(itemId).then(
          () => w.switchActiveInteraction(toast.cardId),
          () => w.switchActiveInteraction(toast.cardId),
        );
        return;
      }
      if (toast.threadKey) w.handleChannelSelect(toast.cardId, toast.threadKey);
      else w.switchActiveInteraction(toast.cardId);
      focusComposerSoon();
    },
    [dismiss, schedule],
  );

  /** A drawer row a toast logged: View again. False for any other row. */
  const viewFromNotification = useCallback(
    (notificationId: string): boolean => {
      const toast = store.getState().assignmentToasts.find((x) => x.id === notificationId);
      if (!toast) return false;
      view(toast);
      return true;
    },
    [store, view],
  );

  return { view, dismiss, viewFromNotification };
}
