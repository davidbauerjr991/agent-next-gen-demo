// Profile assignment seam (P-PROFILES; filled in Phase 7 My Team). An admin
// assigns a profile to agents, teams or skills through the DirectoryProvider
// (P0.9); the agent's workspace asks this source which one applies, saves it
// to the library if it's new, and applies it with its locks — the same path
// as applying a saved profile by hand (`applyProfile`). The
// `#/agent-console?as=<agentId>` window (P0.9.3) is the first caller. Until
// then the standalone source assigns nothing.
import type { ProfileFile } from "./saved-profiles";

export interface ProfileAssignmentSource {
  /** The profile assigned to the signed-in agent, or null for none. */
  assigned(): Promise<ProfileFile | null>;
}

export const standaloneProfileAssignment: ProfileAssignmentSource = {
  assigned: async () => null,
};
