import type { AgentId, EpochMs, ExternalRef } from "./ids";

/** The agent's softphone/telephony connection. "connecting" is transient. */
export type AgentLegState = "disconnected" | "connecting" | "connected";

export type PresenceCategory = "available" | "working" | "unavailable";

export interface AgentPresence {
  /** Platform status code, e.g. "available", "lunch", "after-call-work". */
  code: string;
  label: string;
  category: PresenceCategory;
  since: EpochMs;
  reasonCode?: string;
}

export interface AgentState {
  agentId: AgentId;
  externalId?: ExternalRef;
  presence: AgentPresence;
  leg: AgentLegState;
  legChangedAt?: EpochMs;
}
