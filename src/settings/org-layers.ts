// The org layers above the agent's own (P-CONFIG-LAYERS): the employee's chain as the directory assigns it (Tenant,
// Enterprise, Contact Center, primary team), held in memory — they're the org's, never stored with the agent's
// settings. Empty until a source fills it, so a workspace without one resolves exactly as before. The settings store
// re-resolves when it changes.
import type { LayerProfile } from "./layers";

export interface OrgLayerState {
  layers: readonly LayerProfile[];
}

export interface OrgLayers {
  getState(): OrgLayerState;
  subscribe(listener: () => void): () => void;
  setLayers(layers: readonly LayerProfile[]): void;
}

export function createOrgLayers(): OrgLayers {
  let state: OrgLayerState = { layers: [] };
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setLayers(layers) {
      if (layers === state.layers || (layers.length === 0 && state.layers.length === 0)) return;
      state = { layers };
      for (const listener of [...listeners]) listener();
    },
  };
}

let singleton: OrgLayers | null = null;

/** The app's org layers, created on first use. */
export function getOrgLayers(): OrgLayers {
  if (!singleton) singleton = createOrgLayers();
  return singleton;
}

/** Tests only. */
export function resetOrgLayersForTests() {
  singleton = null;
}
