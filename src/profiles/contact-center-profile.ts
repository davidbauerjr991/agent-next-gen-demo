// Stub of the vertical profile (P0.3). P1.1 replaces this with the real
// `ContactCenterProfile` (terminology, schema, generators, scenarios, intent
// pack, …) and its registry. Until then nothing may read fields that don't
// exist here — the provider context only carries the active profile through.

export interface ContactCenterProfile {
  /** Stable id, e.g. "telecom". Part of the provider-cache key. */
  id: string;
  /** Display name, e.g. "Telecom". */
  name: string;
}

/** The only profile until P1.1. */
export const PLACEHOLDER_PROFILE: ContactCenterProfile = {
  id: "placeholder",
  name: "Placeholder",
};
