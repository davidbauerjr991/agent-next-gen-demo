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
