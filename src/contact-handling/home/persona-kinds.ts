import type { AssignmentKind } from "@/domain";
import type { Persona } from "@/settings";

/** Which kinds of assignment each persona's Activity feed shows (PLAN.md
 *  "Assignment kinds are a registry": role presets). Until P-EMPLOYEES the
 *  persona is `workspace.persona`. */
export const PERSONA_KINDS: Record<Persona, readonly AssignmentKind[]> = {
  agent: ["conversation", "callback", "meeting", "training", "task"],
  supervisor: ["meeting", "coaching", "evaluation", "conversation", "task"],
  sales: ["callback", "campaign-block", "meeting", "task", "conversation"],
};
