import { useCallback, useMemo } from "react";
import type { CreateNewChannelDisabledReasons } from "@nicecxone/lyra-ui";
import { useAgentState } from "@/provider-context";

// What the agent's own presence blocks (PLAN.md Decisions, P-AIFIRST (i)):
// hide what doesn't exist for this agent; disable, with the reason, what
// exists but the agent's current state blocks. Presence never hides a
// control. Routing offers nothing while Unavailable (the engine's gate); the
// agent can't reply in a live chat or start a call. Email, SMS and WhatsApp
// stay open, and an existing call keeps its bar.

export const UNAVAILABLE_REPLY_REASON = "You're Unavailable — go Available to reply.";
export const UNAVAILABLE_CALL_TOOLTIP = "Go Available to call";

/** Whether the agent's presence lets them take sync work (Available or a
 *  Working state). Unknown (no snapshot yet) counts as available. */
export function useAgentAvailable(): boolean {
  const presence = useAgentState()?.presence;
  return !presence || presence.category !== "unavailable";
}

/** The channels presence disables for every outbound launch, with the reason
 *  (lyra `CreateNew`'s `channelDisabledReasons`, the Customers picker, the
 *  ad-hoc "+"): voice while Unavailable. Email, SMS and WhatsApp stay open. */
export function useChannelDisabledReasons(): CreateNewChannelDisabledReasons | undefined {
  const available = useAgentAvailable();
  return useMemo(() => (available ? undefined : { voice: UNAVAILABLE_CALL_TOOLTIP }), [available]);
}

/** The reason a thread's composer is disabled, if presence blocks it: a
 *  live chat while Unavailable. */
export function useReplyBlockedReason(): (channel: string | undefined) => string | undefined {
  const available = useAgentAvailable();
  return useCallback((channel) => (!available && channel === "chat" ? UNAVAILABLE_REPLY_REASON : undefined), [available]);
}
