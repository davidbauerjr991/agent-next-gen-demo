import type { ScenarioScript } from "../../scenarios/scenario-script";
import type { SimCustomerClient } from "./sim-customer-client";

// Dev-only scenario launcher (P0.5c): a bare letter key plays a script as
// the customer, through the same customer side as `__simCustomer` (and the
// P0.6 console later). The agent UI never knows: these keys used to live in
// the Advanced page, which built the cards itself. Routing (the engine)
// decides whether the agent gets it (available or working, one run per
// script at a time).
//
// Desk is frozen (2026-10-15), and its pages have no scenario UI, so the
// keys only fire on the routes listed here.

const SCENARIO_ROUTES = ["#/agent-advanced"];

export function installScenarioHotkeys(
  customer: Pick<SimCustomerClient, "playScenario">,
  scripts: readonly ScenarioScript[],
  target: Pick<Window, "addEventListener" | "removeEventListener" | "location"> = window,
): () => void {
  const byKey = new Map<string, ScenarioScript>();
  for (const script of scripts) {
    const hotkey = script.launch?.hotkey?.toLowerCase();
    if (hotkey) byKey.set(hotkey, script);
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
    const element = event.target as HTMLElement | null;
    if (element?.tagName === "INPUT" || element?.tagName === "TEXTAREA" || element?.isContentEditable) return;
    if (!SCENARIO_ROUTES.some((route) => target.location.hash.startsWith(route))) return;
    const script = byKey.get(event.key.toLowerCase());
    if (script) customer.playScenario(script.id);
  };

  target.addEventListener("keydown", onKeyDown as EventListener);
  return () => target.removeEventListener("keydown", onKeyDown as EventListener);
}
