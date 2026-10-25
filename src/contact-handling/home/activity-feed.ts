// The Activity feed's rules (PLAN.md "Home is the Activity feed"; the
// wireframe, docs/activity-home-wireframe.html, where the two differ):
// (1) offers pin to the top in Needs a decision, whatever their time;
// (2) a row is in the feed or in the rail, never both;
// (3) History is a chip, not a group: what left the feed today (accepted,
//     now in the rail, and completed). The time groups are Now / Today /
//     This week; there is no Completed-today group.
import { assignmentIdFor, scheduleCardKey, type AssignmentId, type AssignmentKind, type ChannelKind, type EpochMs } from "@/domain";
import type { ScheduleItem } from "@/providers";

/** What a row opens: a rail card, a schedule item (opened into the rail),
 *  or a completed conversation (reopened). */
export type FeedTarget =
  | { type: "card"; cardId: string }
  | { type: "schedule"; itemId: string }
  | { type: "history"; entryId: string };

export type FeedRowStatus = "offered" | "scheduled" | "inRail" | "completed";

export interface FeedRow {
  assignmentId: AssignmentId;
  kind: AssignmentKind;
  title: string;
  subtitle: string;
  sourceLabel?: string;
  /** Due (scheduled), arrival (offered) or completion (done). */
  at?: EpochMs;
  /** A display time the row already carries ("12m ago"), when `at` isn't known. */
  timeLabel?: string;
  status: FeedRowStatus;
  target: FeedTarget;
  channel?: ChannelKind;
  /** A completed voice contact that can be called back. */
  redial?: boolean;
}

/** The chips: an empty set is All. */
export type FeedFilter = "assignments" | "history";

export interface FeedInput {
  /** Pending provider offers, already rows. */
  offers: readonly FeedRow[];
  scheduleItems: readonly ScheduleItem[];
  /** The rail's cards (accepted assignments), already rows. */
  railCards: readonly FeedRow[];
  /** Today's completed conversations, already rows. */
  todayHistory: readonly FeedRow[];
  now: EpochMs;
  /** The persona's kinds; schedule items and offers of other kinds are left out. */
  kinds: readonly AssignmentKind[];
  filters: ReadonlySet<FeedFilter>;
}

export interface Feed {
  needsDecision: FeedRow[];
  now: FeedRow[];
  today: FeedRow[];
  thisWeek: FeedRow[];
  /** Shown only while the History chip is on. */
  history: FeedRow[];
  showAssignments: boolean;
  showHistory: boolean;
  counts: { needsDecision: number; now: number; today: number; thisWeek: number; assignments: number; history: number };
}

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(at: EpochMs): EpochMs {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** A schedule item as a feed row. */
export function scheduleRow(item: ScheduleItem): FeedRow {
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

export function buildFeed(input: FeedInput): Feed {
  const { now, kinds, filters } = input;
  const ofKind = (row: FeedRow) => kinds.includes(row.kind);
  const items = input.scheduleItems.map(scheduleRow).filter(ofKind);
  const inRail = new Set(input.railCards.map((r) => r.assignmentId));

  const needsDecision = [...input.offers.filter(ofKind), ...items.filter((r) => r.status === "offered")].sort(byTime);
  const scheduled = items.filter((r) => r.status === "scheduled" && !inRail.has(r.assignmentId)).sort(byTime);
  const endOfToday = startOfDay(now) + DAY_MS;
  const endOfWeek = endOfToday + 6 * DAY_MS;
  const nowRows = scheduled.filter((r) => (r.at ?? 0) <= now);
  const today = scheduled.filter((r) => (r.at ?? 0) > now && (r.at ?? 0) < endOfToday);
  const thisWeek = scheduled.filter((r) => (r.at ?? 0) >= endOfToday && (r.at ?? 0) < endOfWeek);

  const completed = [...input.todayHistory, ...items.filter((r) => r.status === "completed")].sort(byTime);
  const railed = [...input.railCards, ...items.filter((r) => r.status === "inRail" && !inRail.has(r.assignmentId))];
  const history = [...completed, ...railed];

  const showHistory = filters.has("history");
  const showAssignments = filters.size === 0 || filters.has("assignments");
  return {
    needsDecision: showAssignments ? needsDecision : [],
    now: showAssignments ? nowRows : [],
    today: showAssignments ? today : [],
    thisWeek: showAssignments ? thisWeek : [],
    history: showHistory ? history : [],
    showAssignments,
    showHistory,
    counts: {
      needsDecision: needsDecision.length,
      now: nowRows.length,
      today: today.length,
      thisWeek: thisWeek.length,
      assignments: nowRows.length + today.length + thisWeek.length,
      history: history.length,
    },
  };
}
