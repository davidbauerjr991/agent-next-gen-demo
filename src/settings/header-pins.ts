// Header app pins come from the `header` section: four apps are named header
// flags, the rest are extra pins. The page's `PanelKey`s map onto them here.
import { EXTRA_HEADER_APPS, type ExtraHeaderApp, type HeaderSettings } from "./settings-schema";

export type HeaderPanelKey =
  | "notif"
  | "conversations"
  | "schedule"
  | "search"
  | ExtraHeaderApp;

const FLAG_FOR_KEY = {
  notif: "notifications",
  conversations: "agentChat",
  schedule: "calendar",
  search: "search",
} as const satisfies Record<string, keyof HeaderSettings>;

const isExtra = (key: HeaderPanelKey): key is ExtraHeaderApp => (EXTRA_HEADER_APPS as readonly string[]).includes(key);

export function pinnedKeysFromHeader(header: HeaderSettings): Record<HeaderPanelKey, boolean> {
  return {
    notif: header.notifications,
    conversations: header.agentChat,
    schedule: header.calendar,
    search: header.search,
    ...header.pins,
  };
}

/** The `header` patch that pins or unpins one app. */
export function headerPatchForPin(header: HeaderSettings, key: HeaderPanelKey, pinned: boolean): Partial<HeaderSettings> {
  if (isExtra(key)) return { pins: { ...header.pins, [key]: pinned } };
  return { [FLAG_FOR_KEY[key]]: pinned };
}
