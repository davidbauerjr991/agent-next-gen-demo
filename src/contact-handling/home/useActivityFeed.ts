import { useCallback, useMemo } from "react";
import { useClockValue } from "@/components/agent-next-gen-page-clock";
import type { ContactHistoryDateFilterValue, ContactHistoryEntry } from "@/components/agent-next-gen-contact-history";
import { assignmentIdFor, scheduleCardKey, type AssignmentKind, type ChannelKind } from "@/domain";
import { useScheduleProvider, useScheduleSnapshot } from "@/provider-context";
import { useSettings } from "@/settings";
import { useWorkspace } from "../workspace/WorkspaceContext";
import { useWorkspaceUiField } from "../workspace-ui-store";
import { buildFeed, type Feed, type FeedRow, type FeedView } from "./activity-feed";
import { CHANNEL_NAMES } from "./channel-names";
import { PERSONA_KINDS } from "./persona-kinds";
import { startOfDay } from "./time";
import { useScheduleLegCardKeys } from "./useScheduleCards";

type Card = ReturnType<typeof useWorkspace>["interactions"][number];

function cardRow(card: Card, status: "offered" | "inRail"): FeedRow {
  const thread = card.threads.find((t) => t.id === card.currentThreadId) ?? card.threads[0];
  const channel = thread?.type as ChannelKind | undefined;
  const name = card.presentedName ?? card.customerName ?? card.customerId;
  return {
    assignmentId: assignmentIdFor(card.id),
    kind: "conversation",
    title: channel ? `${name} · ${CHANNEL_NAMES[channel]}` : name,
    subtitle: thread?.preview ?? "",
    status,
    target: { type: "card", cardId: card.id },
    ...(channel ? { channel } : {}),
  };
}

function historyRow(entry: ContactHistoryEntry): FeedRow {
  const channel = entry.channelType as ChannelKind;
  return {
    assignmentId: assignmentIdFor(`history:${entry.id}`),
    kind: "conversation",
    title: `${entry.name} · ${CHANNEL_NAMES[channel] ?? entry.channelLabel} · ${entry.skillName}`,
    subtitle: `${entry.statusLabel} · ${entry.description}`,
    timeLabel: entry.timeAgo,
    status: "completed",
    target: { type: "history", entryId: entry.id },
    channel,
    redial: entry.redial,
  };
}

export interface ActivityFeed {
  feed: Feed;
  /** The view switcher (one always selected). */
  view: FeedView;
  setView: (view: FeedView) => void;
  /** The kinds the persona sees, for the kind chips, and the ones picked (empty: all). */
  kinds: readonly AssignmentKind[];
  kindFilter: ReadonlySet<AssignmentKind>;
  toggleKind: (kind: AssignmentKind) => void;
  /** History's range (Contact History's date control). */
  historyRange: ContactHistoryDateFilterValue;
  setHistoryRange: (range: ContactHistoryDateFilterValue) => void;
  /** History's search (Contact History's search box): matches a row's title or detail. */
  historyQuery: string;
  setHistoryQuery: (query: string) => void;
  /** The History row whose Contact History preview is open. */
  isSelected: (row: FeedRow) => boolean;
  open: (row: FeedRow) => void;
}

const matches = (row: FeedRow, query: string) => `${row.title} ${row.subtitle}`.toLowerCase().includes(query.trim().toLowerCase());

const HOUR_MS = 60 * 60 * 1000;

/** Where History's range starts: today's midnight, or 48 / 72 hours back. */
function rangeStart(range: ContactHistoryDateFilterValue, now: number): number {
  return range === "today" ? startOfDay(now) : now - (range === "last48h" ? 48 : 72) * HOUR_MS;
}

function toggled<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

/** Opens a schedule item as the active assignment: it moves to the rail
 *  (state `active`, from the source's event) and its cell shows. */
export function useOpenScheduleItem(): (itemId: string) => void {
  const schedule = useScheduleProvider();
  const { switchActiveInteraction } = useWorkspace();
  return useCallback(
    (itemId: string) => {
      schedule?.open(itemId).then(
        () => switchActiveInteraction(scheduleCardKey(itemId)),
        (err) => {
          if (import.meta.env.DEV) console.warn("[schedule] open failed", err);
        },
      );
    },
    [schedule, switchActiveInteraction],
  );
}

/** The Activity feed for the current persona: offers, the schedule, the rail
 *  and History (Contact History's entries in its range), through the feed's
 *  rules (activity-feed.ts). */
export function useActivityFeed(): ActivityFeed {
  const ws = useWorkspace();
  const snapshot = useScheduleSnapshot();
  const openScheduleItem = useOpenScheduleItem();
  const [{ persona }] = useSettings("workspace");
  const [view, setView] = useWorkspaceUiField("activityView");
  const [kindFilter, setKindFilter] = useWorkspaceUiField("activityKinds");
  const [historyRange, setHistoryRange] = useWorkspaceUiField("activityHistoryRange");
  const [historyQuery, setHistoryQuery] = useWorkspaceUiField("activityHistoryQuery");
  // Time groups only move on the minute.
  const minute = useClockValue(ws.clock, (tick) => Math.floor(tick / 60));
  const {
    interactions, contactHistoryByRange, incomingOffer, switchActiveInteraction, setSelectedQueueId, setSelectedContactHistoryEntry,
    selectedContactHistoryEntry, setInteriorPanelOpen,
  } = ws;
  const historyEntries = contactHistoryByRange[historyRange];
  const kinds = PERSONA_KINDS[persona];
  // A call joined to an open schedule item's card is that item's leg: the item's own row stands for the card.
  const legCardKeys = useScheduleLegCardKeys();

  const feed = useMemo(() => {
    void minute;
    const now = Date.now();
    const built = buildFeed({
      offers: interactions.filter((c) => c.offered).map((c) => cardRow(c, "offered")),
      railCards: interactions.filter((c) => !c.offered && !legCardKeys.has(c.id)).map((c) => cardRow(c, "inRail")),
      completedHistory: historyEntries.map(historyRow),
      historySince: rangeStart(historyRange, now),
      scheduleItems: snapshot?.items ?? [],
      now,
      kinds,
      kindFilter,
      view,
    });
    // The search narrows what History lists, as Contact History's does; the counts stay the day's.
    return historyQuery.trim() ? { ...built, history: built.history.filter((r) => matches(r, historyQuery)) } : built;
  }, [interactions, legCardKeys, historyEntries, historyRange, historyQuery, snapshot, kinds, kindFilter, view, minute]);

  const open = useCallback(
    (row: FeedRow) => {
      const target = row.target;
      if (target.type === "card") {
        const card = interactions.find((c) => c.id === target.cardId);
        if (card?.offered) void incomingOffer.accept(card);
        else if (card) switchActiveInteraction(card.id);
      } else if (target.type === "schedule") {
        if (row.status === "offered" || row.status === "scheduled") openScheduleItem(target.itemId);
        else if (row.status === "inRail") switchActiveInteraction(scheduleCardKey(target.itemId));
      } else {
        // A completed contact opens Contact History's own preview (Redial / reopen from there), not a direct reopen;
        // as on Contact History's card, the open row's click closes it and one job at a time holds the panel.
        const entry = historyEntries.find((e) => e.id === target.entryId);
        if (entry?.id === selectedContactHistoryEntry?.id) setSelectedContactHistoryEntry(null);
        else if (entry) {
          setSelectedQueueId(null);
          setInteriorPanelOpen(false);
          setSelectedContactHistoryEntry(entry);
        }
      }
    },
    [
      interactions, incomingOffer, switchActiveInteraction, openScheduleItem, historyEntries, selectedContactHistoryEntry,
      setSelectedQueueId, setSelectedContactHistoryEntry, setInteriorPanelOpen,
    ],
  );
  const selectedEntryId = selectedContactHistoryEntry?.id;
  const isSelected = useCallback(
    (row: FeedRow) => row.target.type === "history" && row.target.entryId === selectedEntryId,
    [selectedEntryId],
  );

  return {
    feed,
    view,
    setView,
    kinds,
    kindFilter,
    toggleKind: useCallback((kind: AssignmentKind) => setKindFilter((current) => toggled(current, kind)), [setKindFilter]),
    historyRange,
    setHistoryRange,
    historyQuery,
    setHistoryQuery,
    isSelected,
    open,
  };
}
