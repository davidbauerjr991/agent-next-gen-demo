// Configuration layers (P-CONFIG-LAYERS; PLAN Decisions 2026-10-29, revised 2026-11-01). Settings resolve through
// Tenant → Enterprise → Contact Center → Team → Agent, with personal-scope settings below everything. Each layer is a
// partial profile: the sections it carries are the ones it sets, with per-section locks. A section's value comes from
// the lowest layer that sets it, unless a higher layer locks it: a lock propagates down, so the value then comes from
// the lowest setter at or above the topmost lock. Skills are not a layer (a desktop serves every skill at once; a
// skill's behaviour is a per-assignment policy, `src/contact-handling/skill-policy.ts`), and the team layer is the
// employee's primary team only. Pure; the settings store resolves through it.
import { agentSettings, sectionInProfiles, withAgentSettings, type AgentSettings } from "./scope";
import { SECTIONS, defaultSettings, type SectionKey, type SectionSchemas, type SettingsState } from "./settings-schema";

/** Top to bottom. Removing a level later is deleting its entry. */
export const LAYER_LEVELS = ["tenant", "enterprise", "contactCenter", "team", "agent"] as const;
export type LayerLevel = (typeof LAYER_LEVELS)[number];
/** The levels above the agent's own: the org's. */
export type OrgLevel = Exclude<LayerLevel, "agent">;

/** Each level as it reads inside "Set by: Atlas team profile" (through `t()` where shown). */
export const LAYER_LABELS: Record<LayerLevel, string> = {
  tenant: "tenant",
  enterprise: "enterprise",
  contactCenter: "contact center",
  team: "team",
  agent: "agent",
};

/** One org layer's profile. `values` holds only the sections it sets; a field a set section leaves out reads as its
 *  default, never as the agent's. A team's `primary` says whether it's the employee's primary team, the only one
 *  that enters the chain. */
export interface LayerProfile {
  level: OrgLevel;
  id: string;
  name: string;
  primary?: boolean;
  values: Partial<AgentSettings>;
  locks: SectionKey[];
}

/** The agent's own layer: the stored sections, and the applied profile's locks. */
export interface AgentLayer {
  /** Whether the agent has the section stored. */
  sets: (key: SectionKey) => boolean;
  locks: readonly SectionKey[];
  /** The applied profile's name, for "Locked by". */
  profileName?: string;
}

export interface LayerRef {
  level: LayerLevel;
  profileName?: string;
  primary?: boolean;
}

/** Where a section's value comes from: a layer, or the defaults when nothing sets it; and the layer whose lock holds
 *  it, if any. */
export interface SectionSource {
  from: LayerRef | null;
  lockedBy: LayerRef | null;
}

interface ChainEntry extends LayerRef {
  sets: (key: SectionKey) => boolean;
  locks: readonly SectionKey[];
  values?: Partial<AgentSettings>;
}

const levelIndex = (level: LayerLevel) => LAYER_LEVELS.indexOf(level);

/** The org layers that enter the chain, top to bottom: a team only when it's primary. Two layers at one level (the
 *  directory gives one per level) keep their given order, the later one lower. */
export function orgChain(layers: readonly LayerProfile[]): LayerProfile[] {
  return layers.filter((l) => l.level !== "team" || l.primary).sort((a, b) => levelIndex(a.level) - levelIndex(b.level));
}

function chainOf(layers: readonly LayerProfile[], agent: AgentLayer): ChainEntry[] {
  const org: ChainEntry[] = orgChain(layers).map((l) => ({
    level: l.level,
    profileName: l.name,
    primary: l.primary,
    sets: (key) => l.values[key] !== undefined,
    locks: l.locks,
    values: l.values,
  }));
  return [...org, { level: "agent", profileName: agent.profileName, sets: agent.sets, locks: agent.locks }];
}

const ref = (entry: ChainEntry): LayerRef => ({ level: entry.level, profileName: entry.profileName, primary: entry.primary });

/** The section's source in `chain`, and the entry whose value wins (undefined: the defaults). */
function sourceOf(chain: readonly ChainEntry[], key: SectionKey): { source: SectionSource; winner?: ChainEntry } {
  const lockIdx = chain.findIndex((entry) => entry.locks.includes(key));
  const candidates = lockIdx >= 0 ? chain.slice(0, lockIdx + 1) : chain;
  const winner = [...candidates].reverse().find((entry) => entry.sets(key));
  return {
    source: { from: winner ? ref(winner) : null, lockedBy: lockIdx >= 0 ? ref(chain[lockIdx]) : null },
    winner,
  };
}

/** `agentState` (the agent's stored values, defaults where unstored) with every section's agent-scope fields taken
 *  from the layer that wins it; personal- and admin-scope fields always stay the agent's. `sets`: whether a layer
 *  (the agent's included) sets each section, as opposed to the defaults showing through. */
export function resolveLayers(
  agentState: SettingsState,
  layers: readonly LayerProfile[],
  agent: AgentLayer,
  sections: SectionSchemas = SECTIONS,
): { values: SettingsState; sources: Record<SectionKey, SectionSource>; sets: Record<SectionKey, boolean> } {
  const chain = chainOf(layers, agent);
  const incoming: Partial<AgentSettings> = {};
  const sources = {} as Record<SectionKey, SectionSource>;
  const sets = {} as Record<SectionKey, boolean>;
  const defaults = agentSettings(defaultSettings(sections), sections);
  for (const key of Object.keys(sections) as SectionKey[]) {
    if (!sectionInProfiles(key, sections)) {
      // Nothing in it is a profile's (wholly personal or admin): the agent's, never locked.
      sources[key] = { from: agent.sets(key) ? { level: "agent" } : null, lockedBy: null };
      sets[key] = agent.sets(key);
      continue;
    }
    const { source, winner } = sourceOf(chain, key);
    sources[key] = source;
    sets[key] = winner !== undefined;
    if (winner?.level === "agent") continue;
    // A layer's section over the defaults; locked above the agent with no setter at or above the lock, the defaults
    // alone. Either way never the agent's stored value.
    if (winner || source.lockedBy) (incoming as Record<SectionKey, unknown>)[key] = { ...defaults[key], ...winner?.values![key] };
  }
  const values = Object.keys(incoming).length === 0 ? agentState : withAgentSettings(agentState, incoming as AgentSettings, sections);
  return { values, sources, sets };
}

/** Every section a lock at any layer holds (a write to it is refused). */
export function lockedSections(layers: readonly LayerProfile[], agentLocks: readonly SectionKey[]): SectionKey[] {
  return [...new Set([...orgChain(layers).flatMap((l) => l.locks), ...agentLocks])];
}
