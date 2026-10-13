// Stub of the named-database handle (P0.3). P1.4 backs it with Dexie
// (IndexedDB) and adds create/switch/export/reset. The provider context only
// carries the active handle through to provider construction.

export interface DatabaseHandle {
  /** Stable id. Part of the provider-cache key, so switching databases
   *  rebuilds the provider set. */
  id: string;
  /** Display name. */
  name: string;
  /** The `ContactCenterProfile.id` this database was generated for. */
  profileId: string;
}

/** The only database until P1.4. */
export const PLACEHOLDER_DATABASE: DatabaseHandle = {
  id: "placeholder",
  name: "Placeholder",
  profileId: "placeholder",
};
