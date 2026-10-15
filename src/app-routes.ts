// Hash routes. "login" is the root (empty hash); an unknown hash lands there
// too. Advanced (`#/agent-advanced`) is the one agent workspace (P0.5d.2):
// Phase 1 and Phase 2 are profiles of it (Settings), not pages.
import type { ProfileId } from "@/settings";

export type Page = "agent-workspace" | "agent-advanced" | "outbound" | "login";

export const PAGE_HASH: Record<Page, string> = {
  "agent-advanced": "#/agent-advanced",
  "agent-workspace": "#/agentworkspacepremium",
  outbound: "#/outboundengagement",
  login: "",
};

/** Old routes that still resolve: Desk's `#/agent-premium` (deleted in
 *  P0.5d.2) opens Advanced on the Phase 2 profile, which was Desk's layout. */
const LEGACY_ROUTES: Record<string, { page: Page; profile: ProfileId }> = {
  "#/agent-premium": { page: "agent-advanced", profile: "phase2" },
};

export interface ResolvedRoute {
  page: Page;
  /** Set for a legacy route: replace the URL's hash with this one. */
  redirectTo?: string;
  /** Set for a legacy route: apply this profile. */
  profile?: ProfileId;
}

export function resolveHash(hash: string): ResolvedRoute {
  const legacy = LEGACY_ROUTES[hash];
  if (legacy) return { page: legacy.page, redirectTo: PAGE_HASH[legacy.page], profile: legacy.profile };
  const page = (Object.keys(PAGE_HASH) as Page[]).find((p) => PAGE_HASH[p] !== "" && PAGE_HASH[p] === hash);
  return { page: page ?? "login" };
}
