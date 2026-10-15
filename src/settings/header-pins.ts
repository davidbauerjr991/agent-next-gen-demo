// Header apps come from the `header` section. A header icon shows when its
// app is enabled with placement "header" (Search and Notifications are plain
// flags); a left-nav placement becomes a rail item next to Home/Settings.
// The page's `PanelKey`s map onto them here.
import { EXTRA_HEADER_APPS, type ExtraHeaderApp, type HeaderSettings } from "./settings-schema";

export type HeaderPanelKey = "notif" | "conversations" | "search" | ExtraHeaderApp;

const isExtra = (key: HeaderPanelKey): key is ExtraHeaderApp => (EXTRA_HEADER_APPS as readonly string[]).includes(key);

/** Which apps show an icon in the header row. */
export function pinnedKeysFromHeader(header: HeaderSettings): Record<HeaderPanelKey, boolean> {
  const inHeader = Object.fromEntries(
    EXTRA_HEADER_APPS.map((app) => [app, header.apps[app].enabled && header.apps[app].placement === "header"]),
  ) as Record<ExtraHeaderApp, boolean>;
  return {
    notif: header.notifications,
    search: header.search,
    conversations: header.agentChat.enabled && header.agentChat.placement === "header",
    ...inHeader,
  };
}

/** Apps placed in the left nav, as rail items (in this order). */
export function leftNavKeysFromHeader(header: HeaderSettings): HeaderPanelKey[] {
  return [
    ...(header.agentChat.enabled && header.agentChat.placement === "leftnav" ? (["conversations"] as const) : []),
    ...EXTRA_HEADER_APPS.filter((app) => header.apps[app].enabled && header.apps[app].placement === "leftnav"),
  ];
}

/** Apps placed as Home tabs, in the stored tab order. The tab bar shows
 *  (Dashboard first) whenever this isn't empty. */
export function homeTabApps(header: HeaderSettings): ExtraHeaderApp[] {
  return header.tabOrder.filter((app) => header.apps[app].enabled && header.apps[app].placement === "tab");
}

/** The `header` patch for a dragged Home tab order: the dragged tab apps in
 *  their new order, then every other app in its old order. */
export function tabOrderPatch(header: HeaderSettings, dragged: readonly string[]): Partial<HeaderSettings> {
  const moved = dragged.filter((k): k is ExtraHeaderApp => isExtra(k as HeaderPanelKey));
  return { tabOrder: [...moved, ...header.tabOrder.filter((app) => !moved.includes(app))] };
}

/** The `header` patch that pins (shows in the header) or unpins one app from
 *  the apps menu. Pinning moves the app to the header placement. */
export function headerPatchForPin(header: HeaderSettings, key: HeaderPanelKey, pinned: boolean): Partial<HeaderSettings> {
  if (key === "notif") return { notifications: pinned };
  if (key === "search") return { search: pinned };
  if (key === "conversations") {
    return { agentChat: pinned ? { enabled: true, placement: "header" } : { ...header.agentChat, enabled: false } };
  }
  if (isExtra(key)) {
    const next = pinned ? { enabled: true, placement: "header" as const } : { ...header.apps[key], enabled: false };
    return { apps: { ...header.apps, [key]: next } };
  }
  return {};
}
