import { useCallback, useMemo } from "react";
import { useClockValue } from "@/components/agent-next-gen-page-clock";
import type { ContactHistoryEntry } from "@/components/agent-next-gen-contact-history";
import { assignmentIdFor, scheduleCardKey, type ChannelKind } from "@/domain";
import { useScheduleProvider, useScheduleSnapshot } from "@/provider-context";
import { useSettings } from "@/settings";
import { useWorkspace } from "../workspace/WorkspaceContext";
import { useWorkspaceUiField } from "../workspace-ui-store";
import { buildFeed, type Feed, type FeedFilter, type FeedRow } from "./activity-feed";
import { CHANNEL_NAMES } from "./channel-names";
import { PERSONA_KINDS } from "./persona-kinds";

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
  filters: ReadonlySet<FeedFilter>;
  /** All: clears the chips. */
  clearFilters: () => void;
  toggleFilter: (filter: FeedFilter) => void;
  open: (row: FeedRow) => void;
  /** The completed contact behind a History row, for its Call back. */
  historyEntryOf: (row: FeedRow) => ContactHistoryEntry | undefined;
  /** False when the active providers have no schedule source (only conversations then). */
  hasSchedule: boolean;
}

/** The Activity feed for the current persona: offers, the schedule, the rail
 *  and today's completed contacts, through the feed's rules (activity-feed.ts). */
export function useActivityFeed(): ActivityFeed {
  const ws = useWorkspace();
  const schedule = useScheduleProvider();
  const snapshot = useScheduleSnapshot();
  const [{ persona }] = useSettings("workspace");
  const [filters, setFilters] = useWorkspaceUiField("activityFilters");
  // Time groups only move on the minute.
  const minute = useClockValue(ws.clock, (tick) => Math.floor(tick / 60));
  const { interactions, contactHistoryByRange, incomingOffer, switchActiveInteraction, handleReopenContactHistoryEntry } = ws;
  const todayEntries = contactHistoryByRange.today;

  const feed = useMemo(() => {
    void minute;
    return buildFeed({
      offers: interactions.filter((c) => c.offered).map((c) => cardRow(c, "offered")),
      railCards: interactions.filter((c) => !c.offered).map((c) => cardRow(c, "inRail")),
      todayHistory: todayEntries.map(historyRow),
      scheduleItems: snapshot?.items ?? [],
      now: Date.now(),
      kinds: PERSONA_KINDS[persona],
      filters,
    });
  }, [interactions, todayEntries, snapshot, persona, filters, minute]);

  const historyEntryOf = useCallback(
    (row: FeedRow) => (row.target.type === "history" ? todayEntries.find((e) => e.id === (row.target as { entryId: string }).entryId) : undefined),
    [todayEntries],
  );

  const open = useCallback(
    (row: FeedRow) => {
      const target = row.target;
      if (target.type === "card") {
        const card = interactions.find((c) => c.id === target.cardId);
        if (card?.offered) void incomingOffer.accept(card);
        else if (card) switchActiveInteraction(card.id);
      } else if (target.type === "schedule") {
        // Opening moves it to the rail (state `active`, from the source's event) and makes it the active assignment.
        const key = scheduleCardKey(target.itemId);
        if (row.status === "offered" || row.status === "scheduled") {
          schedule?.open(target.itemId).then(
            () => switchActiveInteraction(key),
            (err) => {
              if (import.meta.env.DEV) console.warn("[schedule] open failed", err);
            },
          );
        } else if (row.status === "inRail") {
          switchActiveInteraction(key);
        }
      } else {
        const entry = todayEntries.find((e) => e.id === target.entryId);
        if (entry) handleReopenContactHistoryEntry(entry);
      }
    },
    [interactions, incomingOffer, switchActiveInteraction, schedule, todayEntries, handleReopenContactHistoryEntry],
  );

  return {
    feed,
    filters,
    clearFilters: useCallback(() => setFilters(new Set()), [setFilters]),
    toggleFilter: useCallback(
      (filter: FeedFilter) =>
        setFilters((current) => {
          const next = new Set(current);
          if (next.has(filter)) next.delete(filter);
          else next.add(filter);
          return next;
        }),
      [setFilters],
    ),
    open,
    historyEntryOf,
    hasSchedule: !!schedule,
  };
}
