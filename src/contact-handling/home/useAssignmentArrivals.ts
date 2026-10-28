// Home's arrival banner (P-HOME-1m): a new assignment that arrived while the
// agent wasn't on it. An arrival is a routed inbound contact that goes live
// (delivered, auto-answered) by a provider event after the workspace loaded,
// and wasn't there when it loaded; a ringing offer is Needs a decision, and
// accepting it isn't an arrival, nor is a call the agent dials, a held call
// resuming or a reopened contact. It leaves the banner when viewed (it
// becomes the active card, so it isn't new anymore) or dismissed. Cards are
// keyed by journey (useNavCards). The workspace's toasts (useAssignmentToasts)
// have no arrival event yet: they raise on messages and due callbacks.
import { useCallback, useEffect, useMemo, useRef } from "react";
import { scheduleCardKey, scheduleItemIdOf } from "@/domain";
import { useInteractionProvider, useInteractions, useScheduleProvider, useScheduleSnapshot } from "@/provider-context";
import { useWorkspaceUiField } from "../workspace-ui-store";
import { useWorkspace } from "../workspace/WorkspaceContext";
import { CHANNEL_NAMES } from "./channel-names";
import { useOpenScheduleItem } from "./useActivityFeed";
import { kindLabel } from "@/components/home/home-kinds";
import { t } from "@/i18n";

/** Records arrivals from the provider's events; mount once, at the workspace controller. */
export function useRecordAssignmentArrivals(): void {
  const provider = useInteractionProvider();
  const contacts = useInteractions();
  const [, setArrivals] = useWorkspaceUiField("homeArrivals");
  // The contacts the workspace loaded with aren't arrivals, whatever their state does later.
  const loaded = useRef<Set<string> | null>(null);
  if (!loaded.current) loaded.current = new Set(contacts.map((c) => c.id as string));
  useEffect(() => {
    const rang = new Set<string>();
    const recorded = new Set<string>();
    const offIncoming = provider.on("incoming", ({ interaction }) => {
      // A ringing offer the agent takes isn't an arrival; one that's auto-answered is.
      if (!interaction.autoAnswered) rang.add(interaction.journeyId ?? interaction.id);
    });
    const offState = provider.on("stateChanged", (event) => {
      if (event.kind !== "interaction") return;
      const { interaction } = event;
      const card = interaction.journeyId ?? interaction.id;
      if (interaction.state !== "active" || interaction.direction !== "inbound" || interaction.origin !== "routed") return;
      if (loaded.current!.has(interaction.id) || rang.has(card) || recorded.has(card)) return;
      recorded.add(card);
      setArrivals((prev) => (prev.includes(card) ? prev : [...prev, card]));
    });
    return () => {
      offIncoming();
      offState();
    };
  }, [provider, setArrivals]);

  // The schedule's arrivals: an item that appears after its day was listed (a source's `add`).
  const schedule = useScheduleProvider();
  const snapshot = useScheduleSnapshot();
  const listed = useRef<Set<string> | null>(null);
  if (!listed.current && snapshot) listed.current = new Set(snapshot.items.map((i) => i.id));
  useEffect(() => {
    if (!schedule) return;
    const offReset = schedule.on("reset", ({ snapshot: day }) => {
      listed.current = new Set(day.items.map((i) => i.id));
    });
    const offChanged = schedule.on("itemChanged", ({ item }) => {
      if (!listed.current || listed.current.has(item.id)) return;
      listed.current.add(item.id);
      if (item.state !== "offered" && item.state !== "scheduled") return;
      const card = scheduleCardKey(item.id);
      setArrivals((prev) => (prev.includes(card) ? prev : [...prev, card]));
    });
    return () => {
      offReset();
      offChanged();
    };
  }, [schedule, setArrivals]);
}

export interface AssignmentArrival {
  id: string;
  name: string;
  /** Its channel (a contact) or kind (a schedule item), translated. */
  detail?: string;
}

/** The banner's arrivals (still new: not yet the active card), newest first, with View and Dismiss. */
export function useAssignmentArrivals(): { arrivals: AssignmentArrival[]; view: (id: string) => void; dismiss: () => void } {
  const { interactions, isNewAssignment, switchActiveInteraction } = useWorkspace();
  const snapshot = useScheduleSnapshot();
  const openScheduleItem = useOpenScheduleItem();
  const [ids, setArrivals] = useWorkspaceUiField("homeArrivals");
  const arrivals = useMemo(
    () =>
      [...ids]
        .reverse()
        .flatMap((id): AssignmentArrival[] => {
          if (!isNewAssignment(id)) return [];
          // A schedule arrival: still in the feed (not opened, parked or done), named by its customer or title.
          const itemId = scheduleItemIdOf(id);
          if (itemId) {
            const item = snapshot?.items.find((i) => i.id === itemId && (i.state === "offered" || i.state === "scheduled"));
            return item ? [{ id, name: item.customer?.name ?? item.title, detail: t(kindLabel(item.kind)) }] : [];
          }
          const card = interactions.find((c) => c.id === id);
          if (!card) return [];
          const thread = card.threads.find((t) => t.id === card.currentThreadId) ?? card.threads[0];
          const channel = thread ? CHANNEL_NAMES[thread.type as keyof typeof CHANNEL_NAMES] : undefined;
          return [{ id, name: card.presentedName ?? card.customerName ?? card.customerId, ...(channel ? { detail: t(channel) } : {}) }];
        }),
    [ids, interactions, isNewAssignment, snapshot],
  );
  const view = useCallback(
    (id: string) => {
      setArrivals((prev) => prev.filter((x) => x !== id));
      const itemId = scheduleItemIdOf(id);
      if (itemId) openScheduleItem(itemId);
      else switchActiveInteraction(id);
    },
    [setArrivals, switchActiveInteraction, openScheduleItem],
  );
  const dismiss = useCallback(() => setArrivals([]), [setArrivals]);
  return { arrivals, view, dismiss };
}
