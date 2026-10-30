// @vitest-environment jsdom
// P-LAYOUT's gate: the workspace's composition under every built-in profile — Home, a conversation under the
// profile's AI display, the same conversation under AI display panel, and a kind cell — snapshotted before the step
// moves anything onto parts and slots. Not pixels: the tree of placement markers (`data-slot`, `data-part`,
// `data-canvas-*`, `data-home-*`, …), landmarks and regions by their label, and the header's and the nav's buttons by
// label, and tabs by name (where a header app shows: a header icon, a rail item, a Home tab). The header's overflow
// measurement is stubbed below so its icons render as in a desktop browser. Ids and digits are normalised; repeated siblings (one per seeded card) are kept,
// so a change to the seed changes these too. Empty reference cards are shown (`showEmptyReferenceCards`), so hiding
// them isn't covered here (canvas-hascontent.test.tsx is). A snapshot change beyond P-LAYOUT's two container fixes
// is shown to Dave before it's committed.
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CREATE_NEW_CUSTOMERS } from "@nicecxone/lyra-ui/customers-data";
import { SIM_DEMO_SEED } from "@/adapters/sim/sim-fixtures";
import { AgentWorkspaceAdvancedPage } from "@/components/AgentWorkspaceAdvancedPage";
import { createWorkspaceHarness } from "@/test-utils/workspace-harness";
import { withPersonaSections } from "@/settings/persona";
import { PROFILE_IDS, profileValues, type ProfileId } from "@/settings/profiles";
import { getSettingsStore, resetSettingsStoreForTests } from "@/settings/settings-store";
import { showEmptyReferenceCards } from "@/test-utils/reference-cards";
import { resetCanvasRegistry } from "@/contact-handling/canvas-registry";

const h = createWorkspaceHarness({ seed: SIM_DEMO_SEED, schedule: true });
const priya = CREATE_NEW_CUSTOMERS.find((c) => c.id === "priya-shah-history")!;

// The header hides its app icons when the icon row's left edge comes within 16px of the app name's right edge
// (`useWsHeaderApps`' measure). The harness measures every box at 1600px, so the gap reads -1600 and every icon
// hides. Here the app name (the wrapper around the brand mark, while the app menu has no items; lyra AppHeader's own
// wrapper matches too and isn't measured) ends at 200px and the icon row starts at 1200px, so
// the icons show as they do in a desktop browser. Every other box keeps the harness's measurement.
const harnessRect = Element.prototype.getBoundingClientRect;
const rect = (left: number, right: number) =>
  ({ x: left, y: 0, top: 0, left, right, bottom: 56, width: right - left, height: 56, toJSON: () => ({}) }) as DOMRect;
function headerRect(this: Element): DOMRect {
  if (this.closest("header")) {
    if (this.matches("div.flex.items-center.gap-0")) return rect(1200, 1600);
    if (this.matches("div.flex.items-center") && this.querySelector("[data-slot=brand-mark]")) return rect(0, 200);
  }
  return harnessRect.call(this);
}

beforeEach(() => {
  Element.prototype.getBoundingClientRect = headerRect;
  localStorage.clear();
  resetSettingsStoreForTests();
  resetCanvasRegistry();
  showEmptyReferenceCards();
  h.setUp();
  vi.setSystemTime(new Date(2026, 9, 24, 10, 30));
});
afterEach(async () => {
  resetCanvasRegistry();
  await h.tearDown();
  Element.prototype.getBoundingClientRect = harnessRect;
});

/** Attributes that say where something mounts. Values that carry ids or names are reduced to their kind. */
const MARKERS = [
  "data-slot",
  "data-part",
  "data-canvas-region",
  "data-canvas-cell",
  "data-canvas-pinned",
  "data-home-section",
  "data-home-card",
  "data-home-layout",
  "data-home-column",
  "data-home-header",
  "data-home-scroll",
  "data-home-detail",
  "data-main-thread",
  "data-docked",
  "data-placement",
  "data-kind-cell",
  "data-in-main",
  "data-activity-feed",
  "data-feed-views",
] as const;
const FREE_VALUES = new Set(["data-main-thread", "data-in-main", "data-docked", "data-activity-feed", "data-feed-views", "data-canvas-pinned"]);
const LANDMARKS = new Set(["ASIDE", "MAIN", "NAV", "HEADER", "FOOTER"]);
const LANDMARK_ROLES = new Set(["region", "complementary", "navigation", "main", "banner", "dialog", "tablist"]);

/** A label without its digits (counts, times, numbers in a name). */
const label = (el: Element) => {
  const value = el.getAttribute("aria-label");
  return value ? `[aria-label=${value.replace(/\d+/g, "#")}]` : "";
};

/** A button's name: its aria-label, else its title (lyra `ActionIconButton`), else its text (a rail item). */
const buttonName = (el: Element) => {
  const value = el.getAttribute("aria-label") ?? el.getAttribute("title") ?? el.textContent?.trim() ?? "";
  return value ? `[name=${value.replace(/\d+/g, "#")}]` : "";
};

function describeNode(el: Element, inChrome: boolean): string | null {
  const attrs: string[] = [];
  for (const name of MARKERS) {
    if (!el.hasAttribute(name)) continue;
    const value = el.getAttribute(name)!;
    attrs.push(FREE_VALUES.has(name) ? `${name}${value === "" ? "" : value === "ai" ? "=ai" : "=*"}` : `${name}=${value}`);
  }
  const role = el.getAttribute("role");
  const landmark = LANDMARKS.has(el.tagName) || (role !== null && LANDMARK_ROLES.has(role));
  // In the header and the nav, a button is where an app shows (a header icon, a rail item).
  const chromeButton = inChrome && (el.tagName === "BUTTON" || role === "button" || role === "tab") && buttonName(el) !== "";
  if (!attrs.length && !landmark && !chromeButton) return null;
  const tag = el.tagName.toLowerCase();
  const roleText = role && LANDMARK_ROLES.has(role) ? `[role=${role}]` : "";
  const name = chromeButton ? buttonName(el) : landmark ? label(el) : "";
  return `${tag}${roleText}${name}${attrs.map((a) => `[${a}]`).join("")}`;
}

/** The composition tree: every marked element under `root`, indented by its depth among marked ancestors. */
function composition(root: Element): string {
  const lines: string[] = [];
  const walk = (el: Element, depth: number, inChrome: boolean) => {
    const line = describeNode(el, inChrome);
    const next = line ? depth + 1 : depth;
    if (line) lines.push(`${"  ".repeat(depth)}${line}`);
    const chrome = inChrome || el.tagName === "HEADER" || el.tagName === "NAV" || el.getAttribute("role") === "tablist";
    for (const child of el.children) walk(child, next, chrome);
  };
  walk(root, 0, false);
  return lines.join("\n");
}

/** The page and everything it portals into `document.body` (slide-overs, the docked panel's portals). */
const snapshot = () => composition(document.body);

async function withProfile(id: ProfileId, extra?: () => void) {
  await act(async () => {
    getSettingsStore().updateMany(profileValues(id));
    extra?.();
    await vi.advanceTimersByTimeAsync(50);
  });
  await h.show(AgentWorkspaceAdvancedPage);
  await h.goAvailable();
  await h.advance(500);
}

const UNKNOWN = "(161) 474-9179";

/** A dialed call: voice is on under every profile (Phase 1 is voice only), and it brings the voice bar. */
async function openDialedCall() {
  await act(async () => {
    const dialed = h.provider.dial({ channel: "voice", address: UNKNOWN, skillId: "general" });
    await vi.advanceTimersByTimeAsync(500);
    await dialed;
  });
  await h.click(h.navCard(UNKNOWN));
  await h.advance(500);
}

async function openPriyaChat() {
  const id = await h.startInbound("chat", priya.emailAddress!, priya.name);
  await h.accept(id);
  await h.click(h.navCard(priya.name));
  await h.advance(500);
}

const feedRow = (text: string) =>
  [...h.container.querySelectorAll<HTMLElement>("[data-activity-feed] [data-feed-row]")].find((r) => r.textContent?.includes(text));

describe("composition under every built-in profile (P-LAYOUT gate)", () => {
  it.each(PROFILE_IDS)("%s: Home", async (id) => {
    await withProfile(id);
    expect(snapshot()).toMatchSnapshot();
  });

  it.each(PROFILE_IDS)("%s: a call under the profile's AI display", async (id) => {
    await withProfile(id);
    await openDialedCall();
    expect(snapshot()).toMatchSnapshot();
  });

  it.each(PROFILE_IDS)("%s: a call under AI display panel", async (id) => {
    await withProfile(id, () => getSettingsStore().update("ai", { displayLocation: "panel" }));
    await openDialedCall();
    expect(snapshot()).toMatchSnapshot();
  });

  // Phase 1 has no chat channel.
  it.each(PROFILE_IDS.filter((id) => id !== "phase1"))("%s: a chat under the profile's AI display", async (id) => {
    await withProfile(id);
    await openPriyaChat();
    expect(snapshot()).toMatchSnapshot();
  });

  it.each(PROFILE_IDS.filter((id) => id !== "phase1"))("%s: a chat under AI display panel", async (id) => {
    await withProfile(id, () => getSettingsStore().update("ai", { displayLocation: "panel" }));
    await openPriyaChat();
    expect(snapshot()).toMatchSnapshot();
  });

  it.each(PROFILE_IDS)("%s: a kind cell (the Activity feed on, to open it from)", async (id) => {
    await withProfile(id, () => {
      const store = getSettingsStore();
      store.update("home", { sections: withPersonaSections(store.getState().values.home.sections, "agent") });
    });
    const row = feedRow("Returns team stand-up");
    expect(row, "the stand-up's feed row").toBeDefined();
    await h.click(row!);
    const open = document.querySelector<HTMLElement>("[data-home-detail=item] [data-preview-open]");
    expect(open, "the preview's Open").not.toBeNull();
    await h.click(open!);
    await h.advance(300);
    expect(h.container.querySelector("[data-kind-cell]")).not.toBeNull();
    expect(snapshot()).toMatchSnapshot();
  });
});
