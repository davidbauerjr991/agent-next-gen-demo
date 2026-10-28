import { useCallback, useMemo } from "react";
import { useClockValue } from "@/components/agent-next-gen-page-clock";
import type { DateRange, DateRangeFilterValue } from "@nicecxone/lyra-ui";
import { contactHistoryEntryMatches, type ContactHistoryEntry } from "@/components/agent-next-gen-contact-history";
import { contactHistoryInRange, contactHistoryWindow } from "../contact-history-range";
import { assignmentIdFor, scheduleCardKey, type AssignmentKind, type ChannelKind } from "@/domain";
import { useScheduleProvider, useScheduleSnapshot } from "@/provider-context";
import { useSettings } from "@/settings";
import { useWorkspace } from "../workspace/WorkspaceContext";
import { useWorkspaceUiField } from "../workspace-ui-store";
import { buildFeed, feedRowMatches, type Feed, type FeedRow, type FeedTarget, type FeedView } from "./activity-feed";
import { CHANNEL_NAMES } from "./channel-names";
import { PERSONA_KINDS } from "./persona-kinds";
import { agoMs } from "./time";
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

function historyRow(entry: ContactHistoryEntry, now: number): FeedRow {
  const channel = entry.channelType as ChannelKind;
  return {
    assignmentId: assignmentIdFor(`history:${entry.id}`),
    kind: "conversation",
    title: `${entry.name} · ${CHANNEL_NAMES[channel] ?? entry.channelLabel} · ${entry.skillName}`,
    subtitle: `${entry.statusLabel} · ${entry.description}`,
    // Shows the card's own "8m ago"; `at` only places it among timestamped rows.
    timeLabel: entry.timeAgo,
    at: now - agoMs(entry.timeAgo),
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
  /** The kinds the persona sees, for the kinds chip, and the ones picked (empty: all), the same in every view. */
  kinds: readonly AssignmentKind[];
  kindFilter: ReadonlySet<AssignmentKind>;
  setKinds: (kinds: readonly AssignmentKind[]) => void;
  /** History's range (Contact History's date control: lyra's DateRangeFilterChip) and its Custom days. */
  historyRange: DateRangeFilterValue;
  setHistoryRange: (range: DateRangeFilterValue) => void;
  historyCustom: DateRange | undefined;
  setHistoryCustom: (range: DateRange | undefined) => void;
  /** History's search (Contact History's search box and its match rule; a schedule row by its title or detail). */
  historyQuery: string;
  setHistoryQuery: (query: string) => void;
  /** The Activity view's and the Parked view's searches (P-HOME-1m). */
  query: string;
  setQuery: (query: string) => void;
  parkedQuery: string;
  setParkedQuery: (query: string) => void;
  /** The row whose preview is open in Home's detail panel. */
  isSelected: (row: FeedRow) => boolean;
  /** A row's click: toggles its preview (Contact History's for a completed contact, the item's for the rest). */
  open: (row: FeedRow) => void;
}


/** The card key a row's target reads its new state by (a schedule item's or an offer's); none for a History entry. */
const targetCardKey = (target: FeedTarget): string | null =>
  target.type === "schedule" ? scheduleCardKey(target.itemId) : target.type === "card" ? target.cardId : null;

const sameTarget = (a: FeedTarget | null, b: FeedTarget) =>
  !!a && a.type === b.type && (a.type === "card" ? a.cardId : a.type === "schedule" ? a.itemId : a.entryId) ===
    (b.type === "card" ? b.cardId : b.type === "schedule" ? b.itemId : b.entryId);

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

/** Toggles a schedule item's or offer's preview in Home's detail panel (one job at a time there,
 *  home-detail-panel.tsx); previewing reads it. */
function usePreviewFeedTarget(): (target: Exclude<FeedTarget, { type: "history" }>) => void {
  const { setSelectedQueueId, setInteriorPanelOpen, setSelectedContactHistoryEntry } = useWorkspace();
  const [, setPreview] = useWorkspaceUiField("homePreview");
  const [, setPreviewed] = useWorkspaceUiField("previewedAssignments");
  return useCallback(
    (target) => {
      setSelectedQueueId(null);
      setInteriorPanelOpen(false);
      setSelectedContactHistoryEntry(null);
      setPreview((current) => (sameTarget(current, target) ? null : target));
      const key = targetCardKey(target);
      if (key) setPreviewed((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
    },
    [setSelectedQueueId, setInteriorPanelOpen, setSelectedContactHistoryEntry, setPreview, setPreviewed],
  );
}

/** What a feed row's click did before P-HOME-1h, now its preview's primary action: an offer's card is accepted, a
 *  rail card made active, a schedule item opened into the rail (or made active, if it's there). */
export function useActivateFeedTarget(): (target: FeedTarget) => void {
  const { interactions, incomingOffer, switchActiveInteraction } = useWorkspace();
  const snapshot = useScheduleSnapshot();
  const openScheduleItem = useOpenScheduleItem();
  return useCallback(
    (target: FeedTarget) => {
      if (target.type === "card") {
        const card = interactions.find((c) => c.id === target.cardId);
        if (card?.offered) void incomingOffer.accept(card);
        else if (card) switchActiveInteraction(card.id);
      } else if (target.type === "schedule") {
        const state = snapshot?.items.find((i) => i.id === target.itemId)?.state;
        if (state === "offered" || state === "scheduled") openScheduleItem(target.itemId);
        else if (state === "active") switchActiveInteraction(scheduleCardKey(target.itemId));
      }
    },
    [interactions, incomingOffer, switchActiveInteraction, snapshot, openScheduleItem],
  );
}

/** The Activity feed for the current persona: offers, the schedule and
 *  History (Contact History's entries in its range), through the feed's rules
 *  (activity-feed.ts). A row's click previews it in Home's detail panel. */
export function useActivityFeed(): ActivityFeed {
  const ws = useWorkspace();
  const snapshot = useScheduleSnapshot();
  const [{ persona }] = useSettings("workspace");
  const [view, setView] = useWorkspaceUiField("activityView");
  const [kindFilter, setKindFilter] = useWorkspaceUiField("activityKinds");
  const [historyRange, setHistoryRange] = useWorkspaceUiField("activityHistoryRange");
  const [historyCustom, setHistoryCustom] = useWorkspaceUiField("activityHistoryCustom");
  const [historyQuery, setHistoryQuery] = useWorkspaceUiField("activityHistoryQuery");
  const [query, setQuery] = useWorkspaceUiField("activityQuery");
  const [parkedQuery, setParkedQuery] = useWorkspaceUiField("activityParkedQuery");
  const activate = useActivateFeedTarget();
  const [preview, setPreview] = useWorkspaceUiField("homePreview");
  const previewTarget = usePreviewFeedTarget();
  // Time groups only move on the minute.
  const minute = useClockValue(ws.clock, (tick) => Math.floor(tick / 60));
  const {
    interactions, contactHistory, setSelectedQueueId, setSelectedContactHistoryEntry, selectedContactHistoryEntry, setInteriorPanelOpen,
    isNewAssignment,
  } = ws;
  // Contact History's entries in History's range (lyra's ranges, by when each happened; P-HOME-1m).
  const historyEntries = useMemo(() => {
    void minute;
    return contactHistoryInRange(contactHistory, historyRange, Date.now(), historyCustom);
  }, [contactHistory, historyRange, historyCustom, minute]);
  const kinds = PERSONA_KINDS[persona];
  // A call joined to an open schedule item's card is that item's leg: the item's own row stands for the card.
  const legCardKeys = useScheduleLegCardKeys();

  const feed = useMemo(() => {
    void minute;
    const now = Date.now();
    const byId = new Map(historyEntries.map((e) => [e.id, e]));
    return buildFeed({
      offers: interactions.filter((c) => c.offered).map((c) => cardRow(c, "offered")),
      railCards: interactions.filter((c) => !c.offered && !legCardKeys.has(c.id)).map((c) => cardRow(c, "inRail")),
      completedHistory: historyEntries.map((e) => historyRow(e, now)),
      historyWindow: contactHistoryWindow(historyRange, now, historyCustom),
      query,
      parkedQuery,
      // Contact History's own match rule for its entries; a schedule row as the other views' searches match.
      historyMatches: historyQuery.trim()
        ? (row) => {
            const entry = row.target.type === "history" ? byId.get(row.target.entryId) : undefined;
            return entry ? contactHistoryEntryMatches(entry, historyQuery) : feedRowMatches(row, historyQuery);
          }
        : undefined,
      scheduleItems: snapshot?.items ?? [],
      now,
      kinds,
      kindFilter,
      view,
      // Unread is the nav card's new state: not yet previewed (below) nor the active card.
      isUnread: (row) => {
        const key = targetCardKey(row.target);
        return !!key && isNewAssignment(key);
      },
    });
  }, [interactions, legCardKeys, historyEntries, historyRange, historyCustom, historyQuery, query, parkedQuery, snapshot, kinds, kindFilter, view, minute, isNewAssignment]);

  const open = useCallback(
    (row: FeedRow) => {
      const target = row.target;
      // An item already open in the rail (P-HOME-1m: it stays in the feed) goes to its card.
      if (row.status === "inRail") return activate(target);
      // The open row's click closes its preview, as on Contact History.
      if (target.type !== "history") return previewTarget(target);
      // A completed contact opens Contact History's own preview (Redial / reopen from there); one job at a time.
      setSelectedQueueId(null);
      setInteriorPanelOpen(false);
      setPreview(null);
      const entry = historyEntries.find((e) => e.id === target.entryId);
      setSelectedContactHistoryEntry(!entry || entry.id === selectedContactHistoryEntry?.id ? null : entry);
    },
    [historyEntries, selectedContactHistoryEntry, setSelectedQueueId, setSelectedContactHistoryEntry, setInteriorPanelOpen, setPreview, previewTarget, activate],
  );
  const selectedEntryId = selectedContactHistoryEntry?.id;
  const isSelected = useCallback(
    (row: FeedRow) => (row.target.type === "history" ? row.target.entryId === selectedEntryId : sameTarget(preview, row.target)),
    [selectedEntryId, preview],
  );

  return {
    feed,
    view,
    setView,
    kinds,
    kindFilter,
    setKinds: useCallback((picked: readonly AssignmentKind[]) => setKindFilter(new Set(picked)), [setKindFilter]),
    historyRange,
    setHistoryRange,
    historyCustom,
    setHistoryCustom,
    historyQuery,
    setHistoryQuery,
    query,
    setQuery,
    parkedQuery,
    setParkedQuery,
    isSelected,
    open,
  };
}
