import { afterEach, describe, expect, it } from "vitest";
import type { AssignmentId, Interaction } from "@/domain";
import { assignmentPolicyKey, lookupSkillPolicy, registerSkillPolicy, resetSkillPolicies } from "./skill-policy";

const leg = (journeyId: string, skillId: string, clientId?: string) =>
  ({ id: `${journeyId}-leg`, journeyId, skill: { id: skillId, name: skillId }, ...(clientId ? { clientId } : {}) }) as unknown as Interaction;

afterEach(() => resetSkillPolicies());

describe("skill policies", () => {
  it("a registered policy resolves for a matching assignment, and none for another", () => {
    const policy = { key: { clientId: "acme", skillId: "spanish" }, overrides: {} };
    registerSkillPolicy(policy);
    const legs = [leg("j-1", "spanish", "acme"), leg("j-2", "spanish", "globex"), leg("j-3", "billing", "acme")];
    const policyFor = (id: string) => {
      const key = assignmentPolicyKey(id as AssignmentId, legs);
      return key ? lookupSkillPolicy(key) : undefined;
    };
    expect(policyFor("j-1")).toBe(policy);
    expect(policyFor("j-2")).toBeUndefined();
    expect(policyFor("j-3")).toBeUndefined();
    expect(assignmentPolicyKey("schedule:x" as AssignmentId, legs)).toBeNull();
    // A skill-wide policy covers every client; a client's own wins over it.
    const wide = { key: { skillId: "spanish" }, overrides: {} };
    registerSkillPolicy(wide);
    expect(policyFor("j-2")).toBe(wide);
    expect(policyFor("j-1")).toBe(policy);
  });
});
