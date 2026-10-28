// The Activity feed's rules (PLAN.md "Home is the Activity feed"; the
// wireframe, docs/activity-home-wireframe.html, where the two differ):
// (1) offers pin to the top in Needs a decision, whatever their time;
// (2) an item open in the rail stays in its time group, marked open
//     (P-HOME-1m; 1e's "feed or rail, never both" is gone: the rail is what's
//     held, the feed is the day, nearest first);
// (P-HOME-1k) a row is unread until previewed or opened (the nav card's new
//     state); a parked item is out of the feed and the rail, in the Parked view;
// (3) History is a view, not a group: Contact History's entries in its range
//     (P-HOME-1h: the same entries, order and times as the card), with
//     completed schedule items of other kinds merged in by completion time.
//     The time groups are Today (overdue included) / This week / Later (past
//     the week; no range control, and no Now group, since 1m); there is no
//     Completed-today group. Conversations are the rail's, never feed rows;
//     only their offers are (Needs a decision).
import { assignmentIdFor, scheduleCardKey, type AssignmentId, type AssignmentKind, type ChannelKind, type EpochMs } from "@/domain";
import type { ScheduleItem } from "@/providers";
import { DAY_MS, startOfDay } from "./time";

/** What a row opens: a rail card, a schedule item (opened into the rail),
 *  or a completed conversation (reopened). */
export type FeedTarget =
  | { type: "card"; cardId: string }
  | { type: "schedule"; itemId: string }
  | { type: "history"; entryId: string };

type FeedRowStatus = "offered" | "scheduled" | "inRail" | "completed" | "parked";

export interface FeedRow {
  assignmentId: AssignmentId;
  kind: AssignmentKind;
  title: string;
  subtitle: string;
  sourceLabel?: string;
  /** Due (scheduled), arrival (offered) or completion (done; a Contact History entry's is from its "8m ago"). */
  at?: EpochMs;
  /** A display time the row already carries ("12m ago"), when `at` isn't known. */
  timeLabel?: string;
  status: FeedRowStatus;
  target: FeedTarget;
  channel?: ChannelKind;
  /** A completed voice contact that can be called back. */
  redial?: boolean;
  /** Not yet previewed or opened (P-HOME-1k): the nav card's new state (`isNewAssignment`). */
  unread?: boolean;
  /** The agent created it: Delete instead of only Park (P-HOME-1k). */
  deletable?: boolean;
}

/** The view switcher (P-HOME-1e, -1k): Assignments is Needs a decision and the
 *  time groups; Parked the parked items; History what completed. */
export type FeedView = "assignments" | "parked" | "history";

export interface FeedInput {
  /** Pending provider offers, already rows. */
  offers: readonly FeedRow[];
  scheduleItems: readonly ScheduleItem[];
  /** The rail's cards (accepted assignments): a schedule item on one shows as open. */
  railCards: readonly FeedRow[];
  /** Contact History's entries in History's range, already rows, in the card's order. */
  completedHistory: readonly FeedRow[];
  /** The start of History's range: schedule items completed before it are left out. */
  historySince: EpochMs;
  /** History's search (Contact History's): keeps the rows it matches. Unset: every row. */
  historyMatches?: (row: FeedRow) => boolean;
  now: EpochMs;
  /** The persona's kinds; schedule items and offers of other kinds are left out. */
  kinds: readonly AssignmentKind[];
  /** The kind chips: an empty set is every kind. Applies to every group, History included. */
  kindFilter: ReadonlySet<AssignmentKind>;
  view: FeedView;
  /** Whether a row hasn't been previewed or opened yet (the nav card's new state). Unset: every row is read. */
  isUnread?: (row: FeedRow) => boolean;
}

export interface Feed {
  needsDecision: FeedRow[];
  /** Due before tonight, overdue included (P-HOME-1m: there is no Now group). */
  today: FeedRow[];
  thisWeek: FeedRow[];
  /** Past the week (collapsed until the agent opens it). */
  later: FeedRow[];
  /** Shown only in the History view. */
  history: FeedRow[];
  /** Shown only in the Parked view: parked items, newest parked first. */
  parked: FeedRow[];
  showAssignments: boolean;
  showParked: boolean;
  showHistory: boolean;
  counts: {
    needsDecision: number;
    today: number;
    thisWeek: number;
    later: number;
    assignments: number;
    /** The Assignments view's unread rows (offers and the time groups). */
    unread: number;
    parked: number;
    history: number;
  };
  /** Unread Assignments rows by kind, whatever the kind chips pick (the chips' counts). */
  unreadByKind: Partial<Record<AssignmentKind, number>>;
}

/** A schedule item as a feed row. */
function scheduleRow(item: ScheduleItem): FeedRow {
  const status: FeedRowStatus =
    item.state === "offered"
      ? "offered"
      : item.state === "scheduled"
        ? "scheduled"
        : item.state === "active"
          ? "inRail"
          : item.state === "parked"
            ? "parked"
            : "completed";
  return {
    ...(item.deletable ? { deletable: true } : {}),
    assignmentId: assignmentIdFor(scheduleCardKey(item.id)),
    kind: item.kind,
    title: item.title,
    subtitle: item.subtitle,
    sourceLabel: item.sourceLabel,
    at: item.state === "done" ? (item.completedAt ?? item.dueAt) : item.state === "parked" ? (item.parkedAt ?? item.dueAt) : item.dueAt,
    status,
    target: { type: "schedule", itemId: item.id },
    ...(item.detail.kind === "conversation" ? { channel: item.detail.channel } : {}),
  };
}

const byTime = (a: FeedRow, b: FeedRow) => (a.at ?? 0) - (b.at ?? 0);

export function buildFeed(input: FeedInput): Feed {
  const { now, kinds, kindFilter, view } = input;
  const persona = (row: FeedRow) => kinds.includes(row.kind);
  const picked = (row: FeedRow) => kindFilter.size === 0 || kindFilter.has(row.kind);
  const ofKind = (row: FeedRow) => persona(row) && picked(row);
  const isUnread = input.isUnread ?? (() => false);
  const withUnread = (row: FeedRow): FeedRow => (isUnread(row) ? { ...row, unread: true } : row);
  // A declined offer has left the feed. Every persona row first (the chips' unread counts), then the chips' pick.
  const personaItems = input.scheduleItems.filter((i) => i.state !== "declined").map(scheduleRow).filter(persona).map(withUnread);
  const items = personaItems.filter(picked);
  const offers = input.offers.filter(persona).map(withUnread);
  const inRail = new Set(input.railCards.map((r) => r.assignmentId));

  const needsDecision = [...offers.filter(picked), ...items.filter((r) => r.status === "offered")].sort(byTime);
  // Scheduled and open items, nearest first; one on a rail card is open (an item opened from the feed, or a card that
  // holds its assignment).
  const asOpen = (r: FeedRow): FeedRow => (r.status === "scheduled" && inRail.has(r.assignmentId) ? { ...r, status: "inRail", unread: undefined } : r);
  const inTimeGroups = (r: FeedRow) => r.status === "scheduled" || r.status === "inRail";
  const scheduled = items.filter(inTimeGroups).map(asOpen).sort(byTime);
  const endOfToday = startOfDay(now) + DAY_MS;
  const endOfWeek = endOfToday + 6 * DAY_MS;
  const due = (r: FeedRow) => r.at ?? 0;
  // No Now group (P-HOME-1m): Today is everything due before tonight, overdue included, nearest first.
  const today = scheduled.filter((r) => due(r) < endOfToday);
  const thisWeek = scheduled.filter((r) => due(r) >= endOfToday && due(r) < endOfWeek);
  const later = scheduled.filter((r) => due(r) >= endOfWeek);

  // Contact History's entries (newest first, as the card lists them) with the completed schedule items merged in by
  // completion time; a stable sort keeps the card's own order among its entries.
  const completedItems = items.filter((r) => r.status === "completed" && r.kind !== "conversation" && due(r) >= input.historySince);
  const matches = input.historyMatches ?? (() => true);
  const history = [...input.completedHistory.filter(ofKind), ...completedItems].sort((a, b) => due(b) - due(a)).filter(matches);

  // Parked (P-HOME-1k): out of the feed and the rail, newest parked first; the chips filter it.
  const parked = items.filter((r) => r.status === "parked").sort((a, b) => due(b) - due(a));

  // Unread: the rows the Assignments count counts (the time groups; Needs a decision has its own header count); by
  // kind over every persona row, whatever the chips pick, so each chip can show its own.
  const unreadByKind: Partial<Record<AssignmentKind, number>> = {};
  for (const r of personaItems.filter(inTimeGroups).map(asOpen)) {
    if (r.unread && r.status === "scheduled") unreadByKind[r.kind] = (unreadByKind[r.kind] ?? 0) + 1;
  }
  const assignmentRows = [...today, ...thisWeek, ...later];

  const showHistory = view === "history";
  const showParked = view === "parked";
  const showAssignments = view === "assignments";
  return {
    needsDecision: showAssignments ? needsDecision : [],
    today: showAssignments ? today : [],
    thisWeek: showAssignments ? thisWeek : [],
    later: showAssignments ? later : [],
    history: showHistory ? history : [],
    parked: showParked ? parked : [],
    showAssignments,
    showParked,
    showHistory,
    counts: {
      needsDecision: needsDecision.length,
      today: today.length,
      thisWeek: thisWeek.length,
      later: later.length,
      assignments: assignmentRows.length,
      unread: assignmentRows.filter((r) => r.unread && r.status === "scheduled").length,
      parked: parked.length,
      history: history.length,
    },
    unreadByKind,
  };
}
