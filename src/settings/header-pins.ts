// Header apps come from the `header` section (on/off) and `layout.parts` (where, P-LAYOUT). A header icon shows when
// its app is enabled and its part is in the header slot (Search and Notifications are plain flags); the left-nav slot
// makes it a rail item next to Home/Settings, the top of Home a Home tab. The page's `PanelKey`s map onto them here.
import type { LayoutParts } from "@/layout/layout-section";
import type { SlotId } from "@/layout/slots";
import { EXTRA_HEADER_APPS, type ExtraHeaderApp, type HeaderSettings } from "./settings-schema";

export type HeaderPanelKey = "notif" | "conversations" | "search" | ExtraHeaderApp;

const isExtra = (key: HeaderPanelKey): key is ExtraHeaderApp => (EXTRA_HEADER_APPS as readonly string[]).includes(key);

const appIn = (header: HeaderSettings, parts: LayoutParts, app: ExtraHeaderApp, slot: SlotId) => header.apps[app].enabled && parts[app].slot === slot;
const agentChatIn = (header: HeaderSettings, parts: LayoutParts, slot: SlotId) => header.agentChat.enabled && parts.agentChat.slot === slot;

/** Which apps show an icon in the header row. */
export function pinnedKeysFromHeader(header: HeaderSettings, parts: LayoutParts): Record<HeaderPanelKey, boolean> {
  const inHeader = Object.fromEntries(EXTRA_HEADER_APPS.map((app) => [app, appIn(header, parts, app, "header")])) as Record<ExtraHeaderApp, boolean>;
  return {
    notif: header.notifications,
    search: header.search,
    conversations: agentChatIn(header, parts, "header"),
    ...inHeader,
  };
}

/** Apps placed in the left nav, as rail items (in this order). */
export function leftNavKeysFromHeader(header: HeaderSettings, parts: LayoutParts): HeaderPanelKey[] {
  return [
    ...(agentChatIn(header, parts, "left-nav") ? (["conversations"] as const) : []),
    ...EXTRA_HEADER_APPS.filter((app) => appIn(header, parts, app, "left-nav")),
  ];
}

/** Apps placed as Home tabs, in the stored tab order. The tab bar shows
 *  (Dashboard first) whenever this isn't empty. */
export function homeTabApps(header: HeaderSettings, parts: LayoutParts): ExtraHeaderApp[] {
  return header.tabOrder.filter((app) => appIn(header, parts, app, "home-top"));
}

/** The `header` patch for a dragged Home tab order: the dragged tab apps in
 *  their new order, then every other app in its old order. */
export function tabOrderPatch(header: HeaderSettings, dragged: readonly string[]): Partial<HeaderSettings> {
  const moved = dragged.filter((k): k is ExtraHeaderApp => isExtra(k as HeaderPanelKey));
  return { tabOrder: [...moved, ...header.tabOrder.filter((app) => !moved.includes(app))] };
}

/** The `header` patch that pins (shows in the header) or unpins one app from
 *  the apps menu. Pinning moves the app to the header placement (its preset moves
 *  the part to the header slot, P-LAYOUT). */
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
