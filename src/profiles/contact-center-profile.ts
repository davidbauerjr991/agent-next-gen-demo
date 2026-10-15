// Stub of the vertical profile (P0.3). P1.1 replaces this with the real
// `ContactCenterProfile` (terminology, schema, generators, scenarios, intent
// pack, …) and its registry. Until then nothing may read fields that don't
// exist here — the provider context only carries the active profile through.

export interface ContactCenterProfile {
  /** Stable id, e.g. "telecom". Part of the provider-cache key. */
  id: string;
  /** Display name, e.g. "Telecom". */
  name: string;
  /** Service-level thresholds. Omitted: `DEFAULT_SLA`. */
  sla?: ProfileSla;
}

/** Seconds after which a wait turns warning (amber), then critical (red). */
export interface SlaThresholds {
  warningSeconds: number;
  criticalSeconds: number;
}

/** The profile's SLA settings. Only `answer` lives here so far: the
 *  awaiting-reply thresholds are still the app's AWAITING_* constants
 *  (agent-next-gen-shared-utils.ts) and the hold ones lyra-ui's
 *  HOLD_*_SECONDS (hold-sla.ts). */
export interface ProfileSla {
  /** A ringing offer the agent hasn't answered (the incoming tile). */
  answer: SlaThresholds;
}

export const DEFAULT_SLA: ProfileSla = {
  answer: { warningSeconds: 5, criticalSeconds: 10 },
};

/** The only profile until P1.1. */
export const PLACEHOLDER_PROFILE: ContactCenterProfile = {
  id: "placeholder",
  name: "Placeholder",
  sla: DEFAULT_SLA,
};
