import { useCallback, useEffect, useRef } from "react";
import type { AgentNotification } from "@nicecxone/lyra-ui";
import { assignmentIdFor, scheduleCardKey, type ChannelKind } from "@/domain";
import { useAgentState, useInteractionProvider, useScheduleProvider, useScheduleSnapshot } from "@/provider-context";
import { useConstraint, useSettings, type ToastEvent } from "@/settings";
import { inArrivalGrace, isRoutedContact, isScheduleArrival, newArrivals } from "./arrivals";
import { useAssignmentsAtHomeTop } from "../useAssignmentsPanel";
import { t } from "@/i18n";
import type { useWsHeaderApps } from "../workspace/controller/useWsHeaderApps";
import { useWorkspaceUiStore } from "../workspace-ui-store";
import { withFeedItemPreview } from "../home/feed-preview";
import { feedTimeLabel } from "../home/time";
import { TOAST_NOTIFICATION_PREFIX, URGENT_TOAST_EVENTS, toastAllowed, type AssignmentToast } from "./assignment-toasts";

/** The workspace as the controller's last slice builds it (before this hook's own API is added). */
type WorkspaceBase = ReturnType<typeof useWsHeaderApps>;

const NOTIFICATION_TITLES: Record<ToastEvent, string> = {
  message: "New message",
  approval: "Approval requested",
  callbackDue: "Callback due",
  awaitingReply: "Waiting for your reply",
  workItem: "New work item",
  transfer: "Transfer arriving",
  incoming: "New assignment",
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
  // While a constraint forces the incoming toast on (placement "none": no list on screen), it's the only sign of a
  // new assignment, so "Quiet during a call" doesn't hold it back.
  const incomingForced = !!useConstraint("notifications.toasts.events.incoming");
  // The handlers below read the latest of these, not the values they were registered with.
  // Where an offer's tile is: the rail (left nav or interior panel), or the top of Home.
  const offersAtHome = useAssignmentsAtHomeTop();
  const latest = useRef({ ws, settings, incomingForced, offersAtHome });
  latest.current = { ws, settings, incomingForced, offersAtHome };
  // Toast ids, per workspace mount (a toast's id is also its drawer row's).
  const counter = useRef(0);

  const raise = useCallback(
    (toast: Omit<AssignmentToast, "id" | "urgent">) => {
      const { ws: w, settings: s, incomingForced: forced } = latest.current;
      if (!toastAllowed(toast.event, s, !!w.liveVoiceCallInteraction, forced && toast.event === "incoming")) return;
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

  // A new assignment (P-HOME-1n, `incoming`): a card that arrives holding a routed contact — offered, auto-accepted
  // or delivered — whatever card is active (`newArrivals`). Cards on screen at mount are seen already.
  const routed = useRef(new Set<string>());
  const seenCards = useRef<Set<string> | null>(null);
  useEffect(() => {
    const note = (interaction: Parameters<typeof isRoutedContact>[0] & { id: string }) => {
      if (isRoutedContact(interaction)) routed.current.add(interaction.id);
    };
    const offIncoming = provider.on("incoming", ({ interaction }) => note(interaction));
    const offState = provider.on("stateChanged", (payload) => {
      if (payload.kind === "interaction") note(payload.interaction);
    });
    return () => {
      offIncoming();
      offState();
    };
  }, [provider]);
  // The grace after the agent first goes Available on this mount (`inArrivalGrace`): the day's starting cards join
  // the baseline instead of toasting. Only the first transition opens it, so a later status change doesn't.
  const agent = useAgentState();
  const firstAvailableAt = useRef<number | undefined>(undefined);
  if (firstAvailableAt.current === undefined && agent && agent.presence.category !== "unavailable") firstAvailableAt.current = Date.now();
  useEffect(() => {
    if (!seenCards.current || inArrivalGrace(firstAvailableAt.current, Date.now())) {
      seenCards.current = new Set([...(seenCards.current ?? []), ...ws.interactions.map((c) => c.id)]);
      return;
    }
    for (const card of newArrivals(seenCards.current, ws.interactions, routed.current)) {
      const thread = card.threads[0];
      raise({
        event: "incoming",
        assignmentId: assignmentIdFor(card.id),
        kind: "conversation",
        cardId: card.id,
        ...(thread ? { threadKey: thread.id, channel: thread.type as ChannelKind } : {}),
        // An offer's View goes to its tile (the left nav, or the top of Home), not into the card.
        offer: !!card.offered,
        name: card.presentedName ?? card.customerName ?? card.customerId,
        line: card.offered ? t("Offered to you") : t("Assigned to you"),
      });
    }
    for (const card of ws.interactions) seenCards.current.add(card.id);
  }, [ws.interactions, raise]);

  // A new work item (P-HOME-1m): a schedule item that appears after its day was listed (a source's `add`; P0.9's work
  // items later). Its toast names the kind, the title and when it's due. With the incoming toast on (P-HOME-1n) it's
  // that toast instead — offered items too — so an item never toasts twice.
  const snapshot = useScheduleSnapshot();
  const listed = useRef<Set<string> | null>(null);
  if (!listed.current && snapshot) listed.current = new Set(snapshot.items.map((i) => i.id));
  useEffect(() => {
    if (!schedule) return;
    const offReset = schedule.on("reset", ({ snapshot: day }) => {
      listed.current = new Set(day.items.map((i) => i.id));
    });
    const offChanged = schedule.on("itemChanged", ({ item }) => {
      if (!listed.current) return;
      const arrived = isScheduleArrival(listed.current, item);
      listed.current.add(item.id);
      if (!arrived) return;
      const { settings: s } = latest.current;
      const incoming = s.enabled && s.events.incoming;
      // Without the incoming toast: scheduled only (an offered item is Needs a decision, and offers don't toast).
      if (!incoming && item.state !== "scheduled") return;
      raise({
        event: incoming ? "incoming" : "workItem",
        assignmentId: assignmentIdFor(scheduleCardKey(item.id)),
        kind: item.kind,
        cardId: scheduleCardKey(item.id),
        scheduleItemId: item.id,
        preview: true,
        name: item.title,
        line: item.state === "offered" ? t("Offered to you") : t("Due {time}", { time: feedTimeLabel(item.dueAt, Date.now()) }),
      });
    });
    return () => {
      offReset();
      offChanged();
    };
  }, [schedule, raise]);

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
      if (toast.scheduleItemId && toast.preview) {
        // Home, with the item's feed row previewed (as its click does).
        const itemId = toast.scheduleItemId;
        w.switchActiveInteraction(null);
        w.setShowSettings(false);
        w.setLeftNavPage(null);
        w.setSelectedQueueId(null);
        w.setInteriorPanelOpen(false);
        w.setSelectedContactHistoryEntry(null);
        store.update((state) => withFeedItemPreview(state, itemId, toast.kind));
        return;
      }
      if (toast.offer) {
        // An offer's Accept / Decline are on its tile: the rail's (open the nav; the agent's work stays), or the top
        // of Home's (go Home).
        if (latest.current.offersAtHome) {
          w.setShowSettings(false);
          w.setLeftNavPage(null);
          w.switchActiveInteraction(null);
        } else {
          w.setNavOpen(true);
        }
        return;
      }
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
    [dismiss, schedule, store],
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
