// The persona's Home card set (PLAN.md "Persona (demo)"). Switching persona
// turns its set on and every other section off, in the order the agent has
// stored: a custom order is never replaced.
import { useCallback } from "react";
import type { HomeSection, HomeSectionKey, Persona } from "./settings-schema";
import { getSettingsStore } from "./settings-store";

/** Which Home sections each persona has on. Contact History is in none of
 *  them: it stays a section the agent can turn on. */
export const PERSONA_HOME_SECTIONS: Record<Persona, readonly HomeSectionKey[]> = {
  agent: ["activity", "queue", "performance", "productivity", "reminders"],
  supervisor: ["activity", "teamQueues", "teamToday", "needsYou"],
  sales: ["activity", "pipeline", "campaignToday", "followUps"],
};

/** `sections` with `persona`'s set on and the rest off; the order is kept. */
export function withPersonaSections(sections: readonly HomeSection[], persona: Persona): HomeSection[] {
  const on = PERSONA_HOME_SECTIONS[persona];
  return sections.map((section) => ({ ...section, enabled: on.includes(section.key) }));
}

/** Sets the persona and applies its Home card set in one commit (a locked
 *  section is left as it is, like any other update). */
export function useSetPersona(): (persona: Persona) => void {
  return useCallback((persona: Persona) => {
    const store = getSettingsStore();
    const sections = withPersonaSections(store.getState().values.home.sections, persona);
    store.updateMany({ workspace: { persona }, home: { sections } });
  }, []);
}
