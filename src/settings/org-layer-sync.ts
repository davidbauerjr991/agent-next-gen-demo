// Fills the org layers from the OrgLayerProvider (P-CONFIG-LAYERS): the employee's chain for the current persona,
// asked again whenever the persona changes (the demo's stand-in for who signed in, until P-EMPLOYEES). Started and
// stopped by ProviderRoot with the provider set, like the schedule store. A new chain is the directory's assignment,
// not an org edit, so it replaces the layers and the change-set log starts again from it.
import type { OrgLayerFile, OrgLayerProvider } from "@/providers";
import { resetChangeSets } from "./change-set";
import type { LayerProfile } from "./layers";
import { getOrgLayers } from "./org-layers";
import { readLayerSections, readLocks } from "./saved-profiles";
import { getSettingsStore } from "./settings-store";

/** One layer file as a layer: its sections and locks through the profile readers. */
export function readLayerFile(file: OrgLayerFile): LayerProfile {
  return {
    level: file.level,
    id: file.id,
    name: file.name,
    primary: file.level === "team" ? !!file.primary : undefined,
    values: readLayerSections(file.sections).values,
    locks: readLocks(file.locks),
  };
}

/** Starts filling the org layers from `provider`; the returned stop clears them. */
export function startOrgLayerSync(provider: OrgLayerProvider): () => void {
  const store = getSettingsStore();
  let persona = store.getState().values.workspace.persona;
  let request = 0;
  let stopped = false;

  async function load() {
    const mine = ++request;
    try {
      const chain = await provider.chainFor(persona);
      // A later persona's (or a stop) supersedes this answer.
      if (stopped || mine !== request) return;
      resetChangeSets();
      getOrgLayers().setLayers(chain.layers.map(readLayerFile));
    } catch (err) {
      if (import.meta.env?.DEV) console.warn("[settings] the org layers couldn't be loaded; the agent's own settings apply", err);
      // Not the previous persona's layers and locks either.
      if (!stopped && mine === request) {
        resetChangeSets();
        getOrgLayers().setLayers([]);
      }
    }
  }

  void load();
  const unsubscribe = store.subscribe(() => {
    const next = store.getState().values.workspace.persona;
    if (next === persona) return;
    persona = next;
    void load();
  });
  return () => {
    stopped = true;
    unsubscribe();
    resetChangeSets();
    getOrgLayers().setLayers([]);
  };
}
