// Scenario scripts (P0.7): the format, its validation and helpers, and the
// four ported cases. The scenario player (P0.5c) and the console's
// canned-lines panel (P0.6) read from here; later the active profile
// supplies the list.
import { LUCAS_THOMAS_SCRIPT } from "./scripts/lucas-thomas";
import { MARCUS_WEBB_SCRIPT } from "./scripts/marcus-webb";
import { MAYA_CHEN_SCRIPT } from "./scripts/maya-chen";
import { TOM_LEWIS_SCRIPT } from "./scripts/tom-lewis";
import type { ScenarioScript } from "./scenario-script";

export type * from "./scenario-script";
export {
  cannedLines,
  parseScenarioJson,
  startRequest,
  stepsFor,
  toCustomerAction,
  validateScenario,
  type ScenarioCustomerAction,
} from "./validate";
export { LUCAS_THOMAS_SCRIPT, MARCUS_WEBB_SCRIPT, MAYA_CHEN_SCRIPT, TOM_LEWIS_SCRIPT };

export const SCENARIOS: readonly ScenarioScript[] = [MARCUS_WEBB_SCRIPT, LUCAS_THOMAS_SCRIPT, TOM_LEWIS_SCRIPT, MAYA_CHEN_SCRIPT];

export function getScenario(id: string): ScenarioScript | undefined {
  return SCENARIOS.find((script) => script.id === id);
}
