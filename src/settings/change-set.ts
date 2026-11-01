// Change sets (P-CONFIG-LAYERS; PLAN Decisions 2026-11-01, "Configuration as proposals"): the only write path for the
// org layers. A change set is one intent, a before/after per layer section and who it affects, applied as a unit and
// revertible as one. P-ADMIN adds the log view and the preview, P-CONFIG-ASSIST the conversation; today the one caller
// is applying a saved profile whose level is above the agent's. Kept in memory with the org layers they change, per
// holder, and dropped when the directory hands the employee a new chain (`resetChangeSets`).
import type { LayerProfile, OrgLevel } from "./layers";
import { getOrgLayers, type OrgLayers } from "./org-layers";
import type { SectionKey } from "./settings-schema";

/** A section in one layer: its value (absent: the layer doesn't set it) and whether the layer locks it. */
export interface LayerSectionState {
  value?: unknown;
  locked: boolean;
}

export interface LayerChange {
  level: OrgLevel;
  /** The layer's profile. A change assigns it at its level: a team becomes the primary one (the others stay
   *  memberships), any other level's profile replaces the one there. */
  profileId: string;
  profileName?: string;
  section: SectionKey;
  /** What the section was, for P-ADMIN's preview and diff; applying doesn't check it. */
  before: LayerSectionState;
  after: LayerSectionState;
}

export interface ChangeSet {
  intent: string;
  changes: LayerChange[];
  /** Who it reaches (teams, employees), for the preview. */
  affected: string[];
}

export interface AppliedChangeSet extends ChangeSet {
  /** Unique for the session, across resets. */
  id: string;
  /** 1, 2, … in the order applied since the chain was handed over. */
  version: number;
  reverted: boolean;
}

interface Log {
  base: readonly LayerProfile[];
  sets: AppliedChangeSet[];
}

const logs = new WeakMap<OrgLayers, Log>();
let nextId = 1;

function withChange(layers: readonly LayerProfile[], change: LayerChange): LayerProfile[] {
  const existing = layers.find((l) => l.level === change.level && l.id === change.profileId);
  const target: LayerProfile = existing ?? { level: change.level, id: change.profileId, name: change.profileName ?? change.profileId, values: {}, locks: [] };
  const values = { ...target.values } as Record<SectionKey, unknown>;
  if (change.after.value === undefined) delete values[change.section];
  else values[change.section] = change.after.value;
  const locks = target.locks.filter((k) => k !== change.section).concat(change.after.locked ? [change.section] : []);
  const updated: LayerProfile = { ...target, primary: change.level === "team" ? true : target.primary, values: values as LayerProfile["values"], locks };
  const others = layers.flatMap((l) => {
    if (l === existing) return [];
    if (l.level !== change.level) return [l];
    return l.level === "team" ? [{ ...l, primary: false }] : [];
  });
  return [...others, updated];
}

function replay(holder: OrgLayers, log: Log) {
  holder.setLayers(log.sets.filter((s) => !s.reverted).reduce((acc, set) => set.changes.reduce(withChange, acc), log.base));
}

/** Applies `set` to the org layers as one unit and records it. */
export function applyChangeSet(set: ChangeSet, holder: OrgLayers = getOrgLayers()): AppliedChangeSet {
  let log = logs.get(holder);
  if (!log) logs.set(holder, (log = { base: holder.getState().layers, sets: [] }));
  const applied: AppliedChangeSet = { ...set, id: `cs-${nextId++}`, version: log.sets.length + 1, reverted: false };
  log.sets = [...log.sets, applied];
  replay(holder, log);
  return applied;
}

/** Reverts one applied change set: the layers become the chain with every other applied set. False for an unknown or
 *  already reverted id. */
export function revertChangeSet(id: string, holder: OrgLayers = getOrgLayers()): boolean {
  const log = logs.get(holder);
  const set = log?.sets.find((s) => s.id === id);
  if (!log || !set || set.reverted) return false;
  log.sets = log.sets.map((s) => (s === set ? { ...s, reverted: true } : s));
  replay(holder, log);
  return true;
}

export function changeSetLog(holder: OrgLayers = getOrgLayers()): readonly AppliedChangeSet[] {
  return logs.get(holder)?.sets ?? [];
}

/** The directory handed over a new chain: the log starts again from it. */
export function resetChangeSets(holder: OrgLayers = getOrgLayers()) {
  logs.delete(holder);
}
