import type { AssignmentKind, ChannelKind, EntityId, EpochMs } from "../domain";
import type { EventSource, ProviderLifecycle } from "./events";

/** Whose day the schedule holds. Until P-EMPLOYEES supplies the employee's
 *  role this comes from `workspace.persona` (PLAN.md "Persona (demo)"). */
export type ScheduleRole = "agent" | "supervisor" | "sales";

/** Where a schedule item is in its life. `offered` waits for a decision,
 *  `scheduled` is coming, `active` is open in the rail, `done` is outcomed. */
export type ScheduleItemState = "offered" | "scheduled" | "active" | "done";

/** What each kind carries for its row and its cell. Content is data, as in
 *  the scenario scripts. */
export type ScheduleItemDetail =
  | { kind: "conversation"; channel: ChannelKind; summary: string }
  | { kind: "callback"; phone: string; reason: string }
  | { kind: "meeting"; attendees: number; agenda: readonly string[]; joinLabel: string }
  | { kind: "training"; module: string; dueLabel?: string }
  | { kind: "task"; ticket: string; summary: string; actions: readonly string[] }
  | { kind: "coaching" | "evaluation" | "campaign-block"; points: readonly string[] };

/** The outcome a kind records when its item is completed (P-HOME-1's
 *  placeholder shapes; P-HOME-3 gives each kind its full form). */
export interface ScheduleOutcome {
  note?: string;
  /** Meeting: one action item per line. */
  actionItems?: readonly string[];
  /** Training: whether the module was completed, and the quiz score. */
  completed?: boolean;
  score?: number;
  /** Task: the ticket's status after the work. */
  ticketStatus?: string;
}

export interface ScheduleItem {
  id: string;
  kind: AssignmentKind;
  title: string;
  subtitle: string;
  /** Where it came from, as the row says it: "WFM", "Customer request". */
  sourceLabel: string;
  customer?: { name: string; entityId?: EntityId };
  dueAt: EpochMs;
  durationMin?: number;
  state: ScheduleItemState;
  completedAt?: EpochMs;
  outcome?: ScheduleOutcome;
  detail: ScheduleItemDetail;
}

/** One line on a Home card. `tone` marks a figure off target. */
export interface ScheduleCardMetric {
  label: string;
  value: string;
  hint?: string;
  tone?: "critical" | "warning";
}

/** One schedule snapshot: the role's day, plus the figures its Home cards
 *  show (keyed by `home.sections` key) until P-REPORTING supplies them. */
export interface ScheduleSnapshot {
  role: ScheduleRole;
  items: readonly ScheduleItem[];
  cards: Readonly<Record<string, readonly ScheduleCardMetric[]>>;
}

export interface ScheduleEvents {
  /** An item changed state (opened, completed); the full item. */
  itemChanged: { item: ScheduleItem };
  /** A scheduled item reached its due time. */
  itemDue: { item: ScheduleItem };
  /** The day was replaced (a different role was listed). */
  reset: { snapshot: ScheduleSnapshot };
}

/**
 * The person's scheduled work — callbacks, meetings, trainings, tasks,
 * coaching, evaluations, campaign blocks — from WFM, the calendar and the
 * work queues. The sim's stub source seeds one day per role; real sources
 * arrive with P0.9 (WorkItem) and the WFM/calendar connections.
 */
export interface ScheduleProvider extends EventSource<ScheduleEvents>, ProviderLifecycle {
  /** The day for `role`. Listing a different role than the current one
   *  replaces the day and emits `reset`. */
  listItems(query: { role: ScheduleRole }): Promise<ScheduleSnapshot>;
  /** Opens an offered or scheduled item as an active assignment. */
  open(id: string): Promise<void>;
  /** Records the outcome of an active item and marks it done. */
  complete(id: string, outcome: ScheduleOutcome): Promise<void>;
}
