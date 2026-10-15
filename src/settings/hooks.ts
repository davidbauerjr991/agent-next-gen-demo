import { useCallback, useEffect, useSyncExternalStore } from "react";
import { deriveProfile, profileValues, type ProfileId, type WorkspaceProfile } from "./profiles";
import type { SectionKey, SettingsState } from "./settings-schema";
import { getSettingsStore, type SectionPatch, type SettingsStoreState, type UpdateOptions } from "./settings-store";

function useSettingsSelector<T>(select: (state: SettingsStoreState) => T): T {
  const store = getSettingsStore();
  return useSyncExternalStore(store.subscribe, () => select(store.getState()));
}

/** One section's values and its updater. Changes apply immediately. */
export function useSettings<K extends SectionKey>(
  section: K,
): [SettingsState[K], (patch: SectionPatch<K>, options?: UpdateOptions) => void] {
  const value = useSettingsSelector(useCallback((state: SettingsStoreState) => state.values[section], [section]));
  const update = useCallback(
    (patch: SectionPatch<K>, options?: UpdateOptions) => getSettingsStore().update(section, patch, options),
    [section],
  );
  return [value, update];
}

/** One setting and its setter. */
export function useSetting<K extends SectionKey, F extends keyof SettingsState[K]>(
  section: K,
  field: F,
): [SettingsState[K][F], (value: SettingsState[K][F]) => void] {
  const value = useSettingsSelector(
    useCallback((state: SettingsStoreState) => state.values[section][field], [section, field]),
  );
  const set = useCallback(
    (next: SettingsState[K][F]) => {
      const patch: Partial<SettingsState[K]> = {};
      patch[field] = next;
      getSettingsStore().update(section, patch);
    },
    [section, field],
  );
  return [value, set];
}

/** Whether a section has a stored value (the launch screen's "Save
 *  Preferences" starts checked when the phone section was saved before). */
export function useSectionStored(section: SectionKey): boolean {
  return useSettingsSelector(useCallback((state: SettingsStoreState) => state.stored[section], [section]));
}

/** Writes every section of a built-in profile. */
export function applyProfile(id: ProfileId) {
  getSettingsStore().updateMany(profileValues(id));
}

/** The derived workspace profile and how to apply one. */
export function useWorkspaceProfile(): { profile: WorkspaceProfile; apply: (id: ProfileId) => void } {
  const profile = useSettingsSelector(useCallback((state: SettingsStoreState) => deriveProfile(state.values), []));
  return { profile, apply: applyProfile };
}

export function useResetSettings(): () => void {
  return useCallback(() => getSettingsStore().resetAll(), []);
}

/** Writes the stored theme to `<html data-theme>` once at boot, before the
 *  first render, so anything that reads the attribute while rendering starts
 *  right. */
export function applyStoredTheme() {
  document.documentElement.setAttribute("data-theme", getSettingsStore().getState().values.appearance.theme);
}

/** Applies the stored theme to `<html data-theme>`; mounted once at the app root. */
export function useApplyTheme() {
  const [{ theme }] = useSettings("appearance");
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
}
