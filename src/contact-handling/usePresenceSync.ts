import { useEffect } from "react";
import { useAgentState, useInteractionProvider } from "@/provider-context";

// The page's status picker → the provider's agent presence (P0.5c fix). The
// page keeps its own `agentStatus` (lyra's `AgentStatus` codes, which the sim
// serves one-to-one, sim-fixtures.ts) for the profile and the auto-"Working"
// rule; routing reads the provider's presence, so every change is sent
// there. Before this, the provider stayed on its first presence (Available)
// whatever the agent picked, and routing offered contacts during Lunch.

export function usePresenceSync(code: string): void {
  const provider = useInteractionProvider();
  const current = useAgentState()?.presence.code;
  useEffect(() => {
    // No snapshot yet (or no provider behind it): nothing to sync with.
    if (current === undefined || current === code) return;
    provider.setAgentState(code).catch((error) => {
      if (import.meta.env.DEV) console.warn(`[presence] setAgentState("${code}") failed`, error);
    });
  }, [code, current, provider]);
}
