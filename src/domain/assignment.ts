// The assignment: what the agent is handed and what gets outcomed (PLAN.md
// Domain, 2026-10-23). Domain only — no React, lyra-ui or vendor imports.
import type { Brand } from "./ids";

/** Every kind of assignment the registry knows (PLAN.md "Assignment kinds
 *  are a registry"). A conversation arrives from InteractionProvider; every
 *  other kind arrives from a schedule source until P0.9's WorkItem and
 *  P-QM add their own. */
export type AssignmentKind =
  | "conversation"
  | "callback"
  | "meeting"
  | "training"
  | "task"
  | "campaign-block"
  | "coaching"
  | "evaluation";

/** The grouping key of an assignment's legs and work items. */
export type AssignmentId = Brand<string, "AssignmentId">;

const SCHEDULE_CARD_PREFIX = "schedule:";

/** The rail card key of a schedule item's assignment. */
export function scheduleCardKey(itemId: string): string {
  return `${SCHEDULE_CARD_PREFIX}${itemId}`;
}

/** The schedule item id behind a card key, or `null` for a conversation card. */
export function scheduleItemIdOf(cardKey: string): string | null {
  return cardKey.startsWith(SCHEDULE_CARD_PREFIX) ? cardKey.slice(SCHEDULE_CARD_PREFIX.length) : null;
}

/** The one derivation of an assignment's id from today's card key: a
 *  conversation card's key is its journey id, a schedule card's key is
 *  `schedule:<itemId>`. P0.9's re-key replaces this body and nothing else. */
export function assignmentIdFor(cardKey: string): AssignmentId {
  return cardKey as AssignmentId;
}
