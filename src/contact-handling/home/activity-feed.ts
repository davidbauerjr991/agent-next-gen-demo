// The Activity feed's rules (PLAN.md "Home is the Activity feed"; the
// wireframe, docs/activity-home-wireframe.html, where the two differ):
// (1) offers pin to the top in Needs a decision, whatever their time;
// (2) a row is in the feed or in the rail, never both;
// (3) History is a view, not a group: Contact History's entries in its range
//     (P-HOME-1h: the same entries, order and times as the card), with
//     completed schedule items of other kinds merged in by completion time.
//     The time groups are Now / Today / This week, and Later when the
//     Assignments range goes past the week; there is no Completed-today group.
import { assignmentIdFor, scheduleCardKey, type AssignmentId, type AssignmentKind, type ChannelKind, type EpochMs } from "@/domain";
import type { ScheduleItem } from "@/providers";
import { DAY_MS, startOfDay } from "./time";

/** What a row opens: a rail card, a schedule item (opened into the rail),
 *  or a completed conversation (reopened). */
export type FeedTarget =
  | { type: "card"; cardId: string }
  | { type: "schedule"; itemId: string }
  | { type: "history"; entryId: string };

type FeedRowStatus ="offered" | "scheduled" | "inRail" | "completed";

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
}

/** The view switcher (P-HOME-1e): Assignments is Needs a decision and the
 *  time groups; History is everything that left the feed or completed. */
export type FeedView = "assignments" | "history";

/** The Assignments view's date range (P-HOME-1h): it bounds the time groups; past the week adds Later. */
export type AssignmentsRange = "today" | "week" | "next30" | "all";

export const ASSIGNMENTS_RANGES: readonly AssignmentsRange[] = ["today", "week", "next30", "all"];

export interface FeedInput {
  /** Pending provider offers, already rows. */
  offers: readonly FeedRow[];
  scheduleItems: readonly ScheduleItem[];
  /** The rail's cards (accepted assignments): a schedule item on one isn't in the feed. */
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
  /** Default `week`. */
  range?: AssignmentsRange;
}

export interface Feed {
  needsDecision: FeedRow[];
  now: FeedRow[];
  today: FeedRow[];
  thisWeek: FeedRow[];
  /** Past the week, within the range (Next 30 days, All). */
  later: FeedRow[];
  /** Shown only in the History view. */
  history: FeedRow[];
  showAssignments: boolean;
  showHistory: boolean;
  counts: { needsDecision: number; now: number; today: number; thisWeek: number; later: number; assignments: number; history: number };
}

/** A schedule item as a feed row. */
function scheduleRow(item: ScheduleItem): FeedRow {
  const status: FeedRowStatus =
    item.state === "offered" ? "offered" : item.state === "scheduled" ? "scheduled" : item.state === "active" ? "inRail" : "completed";
  return {
    assignmentId: assignmentIdFor(scheduleCardKey(item.id)),
    kind: item.kind,
    title: item.title,
    subtitle: item.subtitle,
    sourceLabel: item.sourceLabel,
    at: item.state === "done" ? (item.completedAt ?? item.dueAt) : item.dueAt,
    status,
    target: { type: "schedule", itemId: item.id },
    ...(item.detail.kind === "conversation" ? { channel: item.detail.channel } : {}),
  };
}

const byTime = (a: FeedRow, b: FeedRow) => (a.at ?? 0) - (b.at ?? 0);
const NEXT_30_DAYS_MS = 30 * DAY_MS;

export function buildFeed(input: FeedInput): Feed {
  const { now, kinds, kindFilter, view, range = "week" } = input;
  const ofKind = (row: FeedRow) => kinds.includes(row.kind) && (kindFilter.size === 0 || kindFilter.has(row.kind));
  // A declined offer has left the feed.
  const items = input.scheduleItems.filter((i) => i.state !== "declined").map(scheduleRow).filter(ofKind);
  const inRail = new Set(input.railCards.map((r) => r.assignmentId));

  const needsDecision = [...input.offers.filter(ofKind), ...items.filter((r) => r.status === "offered")].sort(byTime);
  const scheduled = items.filter((r) => r.status === "scheduled" && !inRail.has(r.assignmentId)).sort(byTime);
  const endOfToday = startOfDay(now) + DAY_MS;
  const endOfWeek = endOfToday + 6 * DAY_MS;
  const due = (r: FeedRow) => r.at ?? 0;
  const nowRows = scheduled.filter((r) => due(r) <= now);
  const today = scheduled.filter((r) => due(r) > now && due(r) < endOfToday);
  const thisWeek = range === "today" ? [] : scheduled.filter((r) => due(r) >= endOfToday && due(r) < endOfWeek);
  const later =
    range === "next30" || range === "all"
      ? scheduled.filter((r) => due(r) >= endOfWeek && (range === "all" || due(r) < now + NEXT_30_DAYS_MS))
      : [];

  // Contact History's entries (newest first, as the card lists them) with the completed schedule items merged in by
  // completion time; a stable sort keeps the card's own order among its entries.
  const completedItems = items.filter((r) => r.status === "completed" && r.kind !== "conversation" && due(r) >= input.historySince);
  const matches = input.historyMatches ?? (() => true);
  const history = [...input.completedHistory.filter(ofKind), ...completedItems].sort((a, b) => due(b) - due(a)).filter(matches);

  const showHistory = view === "history";
  const showAssignments = view === "assignments";
  return {
    needsDecision: showAssignments ? needsDecision : [],
    now: showAssignments ? nowRows : [],
    today: showAssignments ? today : [],
    thisWeek: showAssignments ? thisWeek : [],
    later: showAssignments ? later : [],
    history: showHistory ? history : [],
    showAssignments,
    showHistory,
    counts: {
      needsDecision: needsDecision.length,
      now: nowRows.length,
      today: today.length,
      thisWeek: thisWeek.length,
      later: later.length,
      assignments: nowRows.length + today.length + thisWeek.length + later.length,
      history: history.length,
    },
  };
}
