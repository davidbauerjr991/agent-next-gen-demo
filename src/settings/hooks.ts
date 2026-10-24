import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { PROFILE_LABELS, deriveProfileState, profileValues, type ProfileId, type WorkspaceProfile } from "./profiles";
import {
  exportProfile,
  getProfileLibrary,
  importProfile,
  isSavedProfileId,
  type ProfileImportError,
  type ProfileLibrary,
  type ProfileLibraryState,
  type ProfileReadWarning,
  type SavedProfile,
  type SavedProfileId,
} from "./saved-profiles";
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

/** Writes every agent-scope setting of a profile, built-in or saved; admin-
 *  and personal-scope settings (the brand, the theme, the phone) stay as they
 *  are. A saved profile's locks apply with it; a built-in clears them. The
 *  profile is recorded as the applied base either way, so later changes read
 *  "modified from" it. */
export function applyProfile(id: ProfileId | SavedProfileId) {
  const store = getSettingsStore();
  const library = getProfileLibrary();
  const saved = isSavedProfileId(id) ? library.getState().saved.find((p) => p.id === id) : undefined;
  if (isSavedProfileId(id) && !saved) return;
  const values = saved ? saved.values : profileValues(id as ProfileId);
  // Locks first come off, so the write lands; then the new ones go on.
  library.setApplied(null);
  store.updateMany(withAgentSettings(store.getState().values, values));
  library.setApplied({ id, locks: saved ? saved.locks : [] });
}

/** The saved profiles and the applied locks. */
export function useProfileLibrary(): ProfileLibraryState {
  const library = getProfileLibrary();
  return useSyncExternalStore(library.subscribe, library.getState);
}

/** Whether the applied profile locks `section` (it renders read-only in
 *  Settings, and the store refuses its agent-scope writes). */
export function useSectionLocked(section: SectionKey | undefined): boolean {
  const { applied } = useProfileLibrary();
  return !!section && !!applied?.locks.includes(section);
}

export interface WorkspaceProfileApi {
  /** Built-in id, saved id, or "custom". */
  profile: WorkspaceProfile;
  /** The settings differ from `profile` (the applied base they came from). */
  modified: boolean;
  saved: SavedProfile[];
  apply: (id: ProfileId | SavedProfileId) => void;
  /** Saves the current agent-scope settings as a new profile, which becomes
   *  the applied base (the applied locks stay as they are). */
  saveAs: (name: string) => SavedProfile | null;
  /** Writes the current agent-scope settings back into the active saved
   *  profile, keeping its locks; false unless a saved profile is active. */
  save: () => boolean;
  /** Reverts the settings to the active profile's values. */
  discard: () => void;
  rename: ProfileLibrary["rename"];
  duplicate: ProfileLibrary["duplicate"];
  remove: ProfileLibrary["remove"];
  setLocks: ProfileLibrary["setLocks"];
  /** The share file for a built-in or saved profile. */
  exportFile: (id: ProfileId | SavedProfileId) => { name: string; json: string } | null;
  /** Reads a share file and saves it as a new profile. */
  importFile: (text: string) => { ok: true; profile: SavedProfile; warnings: ProfileReadWarning[] } | { ok: false; error: ProfileImportError };
}

/** The derived workspace profile, the saved profiles, and what to do with them. */
export function useWorkspaceProfile(): WorkspaceProfileApi {
  const library = getProfileLibrary();
  const { saved, applied } = useProfileLibrary();
  const values = useSettingsSelector(useCallback((state: SettingsStoreState) => state.values, []));
  const { profile, modified } = useMemo(() => deriveProfileState(values, saved, applied?.id ?? null), [values, saved, applied]);
  return useMemo(
    () => ({
      profile,
      modified,
      saved,
      apply: applyProfile,
      saveAs: (name) => {
        const added = library.saveAs(name, getSettingsStore().getState().values);
        if (added) library.setApplied({ id: added.id, locks: library.getState().applied?.locks ?? [] });
        return added;
      },
      save: () => (isSavedProfileId(profile) ? library.overwrite(profile, getSettingsStore().getState().values) : false),
      discard: () => {
        if (profile !== "custom") applyProfile(profile);
      },
      rename: library.rename,
      duplicate: library.duplicate,
      remove: library.remove,
      setLocks: library.setLocks,
      exportFile: (id) => {
        if (isSavedProfileId(id)) {
          const p = library.getState().saved.find((s) => s.id === id);
          return p ? { name: p.name, json: exportProfile(p) } : null;
        }
        return { name: PROFILE_LABELS[id], json: exportProfile({ name: PROFILE_LABELS[id], values: profileValues(id), locks: [] }) };
      },
      importFile: (text) => {
        const result = importProfile(text);
        if (!result.ok) return result;
        const added = library.saveAs(result.profile.name, result.profile.values, result.profile.locks);
        return added ? { ok: true, profile: added, warnings: result.warnings } : { ok: false, error: "malformed" };
      },
    }),
    [profile, modified, saved, library],
  );
}

/** Resets every setting to its default and clears the applied profile's
 *  locks; saved profiles are kept. */
export function useResetSettings(): () => void {
  return useCallback(() => {
    getProfileLibrary().setApplied(null);
    getSettingsStore().resetAll();
  }, []);
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
