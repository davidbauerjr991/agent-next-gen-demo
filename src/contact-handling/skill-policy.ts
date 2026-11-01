// Skill policies (P-CONFIG-LAYERS; PLAN Decisions 2026-11-01): what varies by skill varies per assignment, never per
// desktop — a desktop serves every skill the agent holds at once, so skills aren't a settings layer. A policy is keyed
// by { clientId?, skillId } and resolved for one assignment from its legs. The seam only: no policy field exists yet;
// P-TRANSLATE declares the first ("translate on Spanish skills") in the schema and registers it here.
import { useMemo } from "react";
import { assignmentIdFor, type AssignmentId, type Interaction } from "@/domain";
import { useInteractions } from "@/provider-context";

/** What a skill policy can set for an assignment. Its fields are declared as the steps that use them arrive. */
export type AssignmentPolicy = Record<never, never>;

export interface SkillPolicyKey {
  /** Absent: every client's contacts on the skill. */
  clientId?: string;
  skillId: string;
}

export interface SkillPolicy {
  key: SkillPolicyKey;
  overrides: Partial<AssignmentPolicy>;
}

/** Registered when a step's module loads (P-TRANSLATE's first); `useAssignmentPolicy` doesn't watch it, so a policy
 *  added at runtime (P-ADMIN) needs a subscription here first. */
let registry: SkillPolicy[] = [];

export function registerSkillPolicy(policy: SkillPolicy) {
  registry = [...registry.filter((p) => p.key.skillId !== policy.key.skillId || p.key.clientId !== policy.key.clientId), policy];
}

/** Tests only. */
export function resetSkillPolicies() {
  registry = [];
}

/** The policy for `key`: the client's own for the skill first, else the skill's for every client. */
export function lookupSkillPolicy(key: SkillPolicyKey): SkillPolicy | undefined {
  return (
    registry.find((p) => p.key.skillId === key.skillId && key.clientId !== undefined && p.key.clientId === key.clientId) ??
    registry.find((p) => p.key.skillId === key.skillId && p.key.clientId === undefined)
  );
}

/** The one reading of an assignment's policy key: its first leg with a skill, and that leg's client. Null for an
 *  assignment with no skilled leg (a schedule item, an outbound dial without a skill). */
export function assignmentPolicyKey(assignmentId: AssignmentId, interactions: readonly Interaction[]): SkillPolicyKey | null {
  const leg = interactions.find((i) => assignmentIdFor(i.journeyId) === assignmentId && i.skill);
  return leg?.skill ? { skillId: leg.skill.id, ...(leg.clientId ? { clientId: leg.clientId } : {}) } : null;
}

/** The policy overrides for one assignment (none when no policy matches). */
export function useAssignmentPolicy(assignmentId: AssignmentId): Partial<AssignmentPolicy> {
  const interactions = useInteractions();
  return useMemo(() => {
    const key = assignmentPolicyKey(assignmentId, interactions);
    return (key && lookupSkillPolicy(key)?.overrides) ?? {};
  }, [assignmentId, interactions]);
}
