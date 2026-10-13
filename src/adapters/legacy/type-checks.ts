// Compile-time guards for the P0.1 mapping note (PLAN.md → Decisions): if
// today's component-level shapes drift from the domain model, tsc fails here.
// Type-only — nothing is emitted, and no component imports this file. The
// P0.5 migrations add the real legacy → domain mapper functions alongside it.
import type { ChannelType } from "@nicecxone/lyra-ui";
import type { AgentLegSettledStatus } from "@/components/agent-next-gen-agent-leg-state";
import type { Thread } from "@/components/agent-next-gen-interaction-dashboard";
import type { AgentLegState, ChannelKind, Direction } from "@/domain";

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
  // The cached settled leg status is a subset of the domain leg state.
  Assert<Extends<AgentLegSettledStatus, AgentLegState>>,
  Assert<Extends<NonNullable<Thread["direction"]>, Direction>>,
];
