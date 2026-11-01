// What Settings says about a section's source (P-CONFIG-LAYERS): "Set by: Atlas team profile (primary)" for a value an
// org layer sets, "Locked by: Birch team profile" for a section a lock holds. One whole message per level, so each
// translates as a sentence (the i18n shim has no ICU select; P-I18N may fold them).
import { t } from "@/i18n";
import type { LayerLevel, LayerRef, SectionSource } from "./layers";

const SET_BY: Record<LayerLevel, string> = {
  tenant: "Set by: {name} tenant profile",
  enterprise: "Set by: {name} enterprise profile",
  contactCenter: "Set by: {name} contact center profile",
  team: "Set by: {name} team profile",
  agent: "Set by: {name} agent profile",
};

const LOCKED_BY: Record<LayerLevel, string> = {
  tenant: "Locked by: {name} tenant profile",
  enterprise: "Locked by: {name} enterprise profile",
  contactCenter: "Locked by: {name} contact center profile",
  team: "Locked by: {name} team profile",
  agent: "Locked by: {name} agent profile",
};

/** Without a profile name (an Agent-level lock from no named profile): a whole sentence of its own. */
const UNNAMED: Record<"set" | "locked", Record<LayerLevel, string>> = {
  set: {
    tenant: "Set by: your tenant profile",
    enterprise: "Set by: your enterprise profile",
    contactCenter: "Set by: your contact center profile",
    team: "Set by: your team profile",
    agent: "Set by: your agent profile",
  },
  locked: {
    tenant: "Locked by: your tenant profile",
    enterprise: "Locked by: your enterprise profile",
    contactCenter: "Locked by: your contact center profile",
    team: "Locked by: your team profile",
    agent: "Locked by: your agent profile",
  },
};

const named = (messages: Record<LayerLevel, string>, ref: LayerRef) =>
  ref.profileName ? t(messages[ref.level], { name: ref.profileName }) : t(UNNAMED[messages === SET_BY ? "set" : "locked"][ref.level]);

/** The Workspace profile picker's group for a saved profile of each level (P-CONFIG-LAYERS 8), in picker order. */
export const SAVED_PROFILE_GROUPS: readonly [LayerLevel, string][] = [
  ["agent", "Saved"],
  ["team", "Team profiles"],
  ["contactCenter", "Contact center profiles"],
  ["enterprise", "Enterprise profiles"],
  ["tenant", "Tenant profiles"],
];

/** Saved profiles in picker order (by level, then as saved), each with its group's label. */
export function savedProfilesByLevel<P extends { level: LayerLevel }>(saved: readonly P[]): { profile: P; group: string }[] {
  return SAVED_PROFILE_GROUPS.flatMap(([level, group]) => saved.filter((p) => p.level === level).map((profile) => ({ profile, group: t(group) })));
}

/** The intent of the change set that assigns a profile at an org level (P-ADMIN's preview shows it). */
const ASSIGN_INTENT: Record<Exclude<LayerLevel, "agent">, string> = {
  tenant: "Assign {name} as the tenant profile",
  enterprise: "Assign {name} as the enterprise profile",
  contactCenter: "Assign {name} as the contact center profile",
  team: "Assign {name} as the primary team's profile",
};

export function assignIntent(level: Exclude<LayerLevel, "agent">, name: string): string {
  return t(ASSIGN_INTENT[level], { name });
}

/** The section's lock as Settings shows it, or null when nothing locks it. */
export function lockedByLabel(source: SectionSource | undefined): string | null {
  return source?.lockedBy ? named(LOCKED_BY, source.lockedBy) : null;
}

/** The marker Settings shows on a section: the lock when one holds it, else the org layer that sets it; null for the
 *  agent's own values and the defaults (nothing to say). */
export function sourceLabel(source: SectionSource | undefined): string | null {
  const locked = lockedByLabel(source);
  if (locked) return locked;
  const from = source?.from;
  if (!from || from.level === "agent") return null;
  if (from.level === "team" && from.primary && from.profileName) return t("Set by: {name} team profile (primary)", { name: from.profileName });
  return named(SET_BY, from);
}
