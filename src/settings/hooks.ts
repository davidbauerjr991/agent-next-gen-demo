import { useCallback, useEffect, useSyncExternalStore } from "react";
import { deriveProfile, profileValues, type ProfileId, type WorkspaceProfile } from "./profiles";
import defaultAppIcon from "@/assets/app-icon.svg";
import { applyBrandColors } from "./brand-colors";
import { withAgentSettings } from "./scope";
import { DEFAULT_APP_NAME, type SectionKey, type SettingsState } from "./settings-schema";
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

/** Writes every agent-scope setting of a built-in profile; admin-scope
 *  settings (the brand, the social placeholders) stay as they are. */
export function applyProfile(id: ProfileId) {
  const store = getSettingsStore();
  store.updateMany(withAgentSettings(store.getState().values, profileValues(id)));
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
  const { theme, brand } = getSettingsStore().getState().values.appearance;
  document.documentElement.setAttribute("data-theme", theme);
  applyBrandColors(brand.colors);
}

/** Applies the stored theme to `<html data-theme>`, the brand colors as
 *  overrides on lyra's tokens, and the brand's app name to the tab title;
 *  mounted once at the app root. */
export function useApplyTheme() {
  const [{ theme, brand }] = useSettings("appearance");
  const { appName } = useBrand();
  const { primary, accent } = brand.colors;
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
  useEffect(() => {
    applyBrandColors({ primary, accent });
  }, [primary, accent]);
  useEffect(() => {
    document.title = appName;
  }, [appName]);
}

/** The white-label brand (Settings → Appearance): the app name (the default
 *  when left empty) and the logo's src (the default app icon when none). */
export function useBrand(): { appName: string; logoSrc: string; customLogo: boolean } {
  const [{ brand }] = useSettings("appearance");
  return {
    appName: brand.appName.trim() || DEFAULT_APP_NAME,
    logoSrc: brand.logo ?? defaultAppIcon,
    customLogo: brand.logo !== null,
  };
}
