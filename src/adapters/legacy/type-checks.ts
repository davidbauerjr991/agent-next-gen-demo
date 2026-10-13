// Compile-time guards for the P0.1 mapping note (PLAN.md → Decisions): if
// today's component-level shapes drift from the domain model, tsc fails here.
// Type-only — nothing is emitted, and no component imports this file. The
// P0.5 migrations add the real legacy → domain mapper functions alongside it.
//
// Not checked yet: `ChannelKind` vs lyra-ui's `ChannelType` (and so
// `Thread["type"]`). tsc can't resolve `@nicecxone/lyra-ui` (the alias lives
// only in vite.config.ts, not tsconfig paths), so those types are `any` and
// any assertion on them would pass vacuously. Add it once the alias resolves.
import type { AgentLegSettledStatus } from "@/components/agent-next-gen-agent-leg-state";
import type { Thread } from "@/components/agent-next-gen-interaction-dashboard";
import type { AgentLegState, Direction } from "@/domain";

type Assert<T extends true> = T;
type Extends<A, B> = [A] extends [B] ? true : false;

export type LegacyTypeChecks = [
  // The cached settled leg status is a subset of the domain leg state.
  Assert<Extends<AgentLegSettledStatus, AgentLegState>>,
  Assert<Extends<NonNullable<Thread["direction"]>, Direction>>,
];
