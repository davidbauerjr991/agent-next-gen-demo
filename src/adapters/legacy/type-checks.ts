// Compile-time guards for the P0.1 mapping note (PLAN.md → Decisions): if
// today's component-level shapes drift from the domain model, tsc fails here.
// Type-only — nothing is emitted, and no component imports this file. The
// P0.5 migrations add the real legacy → domain mapper functions alongside it.
import type { AgentProfileProps, ChannelType } from "@nicecxone/lyra-ui";
import type { Interaction as NavCard, Thread } from "@/components/agent-next-gen-interaction-dashboard";
import type { AgentLegState, ChannelKind, Direction, EntityId, InteractionId } from "@/domain";
import type { ReopenRequest } from "@/providers";

type Assert<T extends true> = T;
type Extends<A, B> = [A] extends [B] ? true : false;
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type IsAny<T> = 0 extends 1 & T ? true : false;

export type LegacyTypeChecks = [
  // lyra-ui types must actually resolve; `any` would make the checks below pass vacuously.
  Assert<Same<IsAny<ChannelType>, false>>,
  // Domain channels, lyra-ui channels, and Thread channels are the same set.
  Assert<Same<ChannelKind, ChannelType>>,
  Assert<Same<Thread["type"], ChannelKind>>,
  // AgentProfile's controlled leg prop takes the domain leg state as is (P0.5a).
  Assert<Same<NonNullable<AgentProfileProps["agentLegStatus"]>, AgentLegState>>,
  Assert<Extends<NonNullable<Thread["direction"]>, Direction>>,
  // Store-built cards (P0.5b.1): the command target and entity link carry the domain ids.
  Assert<Same<NonNullable<Thread["providerInteractionId"]>, InteractionId>>,
  Assert<Extends<EntityId, NonNullable<NavCard["entityId"]>>>,
  // The reopen request mirrors the thread fields a reopen restores.
  Assert<Same<ReopenRequest["direction"], Direction>>,
  Assert<Same<ReopenRequest["channel"], Thread["type"]>>,
];
