// Storage for the settings store. Every access is wrapped: private browsing,
// blocked site data, a full quota or a missing `localStorage` all fall back
// to "nothing stored" and silently dropped writes, never an exception.

export const SETTINGS_KEY_PREFIX = "agent-next-gen:settings:";

export interface SettingsStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  /** Every stored key with the settings prefix. */
  keys(): string[];
}

export function safeStorage(getStorage: () => Storage = () => window.localStorage): SettingsStorage {
  const storage = (): Storage | null => {
    try {
      return getStorage() ?? null;
    } catch {
      return null;
    }
  };
  return {
    get(key) {
      try {
        return storage()?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        storage()?.setItem(key, value);
      } catch {
        // Quota or blocked storage: the in-memory value still applies.
      }
    },
    remove(key) {
      try {
        storage()?.removeItem(key);
      } catch {
        // Nothing to do.
      }
    },
    keys() {
      try {
        const s = storage();
        if (!s) return [];
        const out: string[] = [];
        for (let i = 0; i < s.length; i += 1) {
          const key = s.key(i);
          if (key?.startsWith(SETTINGS_KEY_PREFIX)) out.push(key);
        }
        return out;
      } catch {
        return [];
      }
    },
  };
}
