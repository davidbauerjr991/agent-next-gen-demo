// @vitest-environment jsdom
// P-POLISH 1: Settings → Channels and the demo seeds, the bell, the "+".
// 1. A seeded assignment on a channel that's off isn't a card (Phase 1: no
//    Noah, Lauren or Ethan), and its unread notification is out of the bell
//    and its count; turning the channel on shows both. An accepted seed the
//    agent never touched goes back to waiting when its channel goes off; a
//    touched one stays.
// 2. The card's "+" (record header and nav card) shows only with more than
//    one channel on.
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWorkspaceHarness } from "@/test-utils/workspace-harness";
import { AgentWorkspaceAdvancedPage } from "@/components/AgentWorkspaceAdvancedPage";
import { SIM_DEMO_SEED } from "@/adapters/sim/sim-fixtures";
import { INITIAL_NOTIFICATIONS } from "@/components/agent-next-gen-interaction-dashboard";
import { visibleNotifications } from "@/contact-handling/notification-gates";
import type { Interaction as DomainInteraction } from "@/domain";
import { getSettingsStore, resetSettingsStoreForTests } from "./settings-store";
import { profileValues } from "./profiles";
import { SECTIONS, type SectionKey, type SettingsState } from "./settings-schema";

const h = createWorkspaceHarness({ seed: SIM_DEMO_SEED });

beforeEach(() => {
  localStorage.clear();
  resetSettingsStoreForTests();
  h.setUp();
});
afterEach(async () => {
  await h.tearDown();
});

async function setSettings<K extends SectionKey>(section: K, patch: Partial<SettingsState[K]>) {
  await act(async () => {
    getSettingsStore().update(section, patch);
    await vi.advanceTimersByTimeAsync(500);
  });
}

const hasCard = (name: string) => {
  try {
    h.navCard(name);
    return true;
  } catch {
    return false;
  }
};
const seedCards = () => ["Noah Patel", "Lauren Kim", "Ethan Zhang"].filter(hasCard);
const headerPlus = () => h.container.querySelector("[data-slot=header-add-channel] button");
const navPlus = () => h.container.querySelector('aside [aria-label="Add Outbound"]');

async function applyProfile(id: "phase1" | "phase2") {
  await act(async () => {
    getSettingsStore().updateMany(profileValues(id));
    await vi.advanceTimersByTimeAsync(500);
  });
}

async function start() {
  await h.show(AgentWorkspaceAdvancedPage);
  await h.goAvailable();
  await h.advance(500);
}

describe("1: seeded assignments obey Settings → Channels", () => {
  it("Phase 1 (voice only): no seeded card; email on shows Noah and Lauren, SMS on shows Ethan", async () => {
    await start();
    expect(seedCards()).toEqual([]);
    await setSettings("channels", { email: true });
    expect(seedCards()).toEqual(["Noah Patel", "Lauren Kim"]);
    await setSettings("channels", { sms: true });
    expect(seedCards()).toEqual(["Noah Patel", "Lauren Kim", "Ethan Zhang"]);
  });

  it("Phase 1 → Phase 2 → Phase 1 with no interaction: the untouched seeds go back to waiting", async () => {
    await start();
    await applyProfile("phase2");
    expect(seedCards()).toEqual(["Noah Patel", "Lauren Kim", "Ethan Zhang"]);
    await applyProfile("phase1");
    expect(seedCards()).toEqual([]);
    // And are accepted (shown) again once their channels are back on.
    await applyProfile("phase2");
    expect(seedCards()).toEqual(["Noah Patel", "Lauren Kim", "Ethan Zhang"]);
  });

  it("the same round trip after opening Noah's card keeps Noah only", async () => {
    await start();
    await applyProfile("phase2");
    await h.click(h.navCard("Noah Patel"));
    await applyProfile("phase1");
    expect(seedCards()).toEqual(["Noah Patel"]);
  });

  it("Auto-accept off: an offer on a channel that's off isn't an Accept / Decline card either", async () => {
    await setSettings("assignments", { autoAccept: { ...SECTIONS.assignments.defaults.autoAccept, email: false } });
    await start();
    expect(seedCards()).toEqual([]);
    await setSettings("channels", { email: true });
    expect(seedCards()).toEqual(["Noah Patel", "Lauren Kim"]);
  });
});

describe("1: the bell follows the same rule", () => {
  const offer = (id: string, channel: "email" | "sms", state: DomainInteraction["state"] = "offered") =>
    ({ id, channel, state }) as DomainInteraction;
  const unreadIds = (contacts: DomainInteraction[], enabled: string[]) =>
    visibleNotifications(INITIAL_NOTIFICATIONS, contacts, enabled)
      .filter((n) => !n.read)
      .map((n) => n.id);
  const waiting = [offer("seed-notification-1", "email"), offer("seed-notification-3", "email"), offer("seed-notification-4", "sms")];

  it("an unread notification for an offer waiting on a channel that's off is hidden; read ones always show", () => {
    expect(unreadIds(waiting, ["voice"])).toEqual([]);
    expect(unreadIds(waiting, ["voice", "email"])).toEqual(["1", "3"]);
    expect(unreadIds(waiting, ["voice", "email", "sms"])).toEqual(["1", "3", "4"]);
    // Every read (history) notification stays, whatever the channels.
    const read = INITIAL_NOTIFICATIONS.filter((n) => n.read).map((n) => n.id);
    expect(visibleNotifications(INITIAL_NOTIFICATIONS, waiting, []).map((n) => n.id)).toEqual(read);
  });

  it("an accepted thread's notification is unaffected by its channel", () => {
    const accepted = [offer("seed-notification-1", "email", "active"), ...waiting.slice(1)];
    expect(unreadIds(accepted, ["voice"])).toEqual(["1"]);
  });

  // The bell's unread count: its trigger's "Notifications, N unread", or — with the header icon tucked away, as
  // in jsdom (no width) — the same count on the "View All Apps" badge.
  const unreadCount = () => {
    const bell = [...h.container.querySelectorAll('[aria-label^="Notifications"]')]
      .map((el) => el.getAttribute("aria-label")!)
      .find((label) => /^Notifications(, \d+ unread)?$/.test(label));
    if (bell) return Number(/(\d+) unread/.exec(bell)?.[1] ?? 0);
    const apps = h.container.querySelector('[aria-label="View All Apps"]');
    expect(apps).not.toBeNull();
    return Number(apps!.parentElement!.textContent?.match(/\d+/)?.[0] ?? 0);
  };

  // Phase 1 hides the header's app icons, the bell's among them.
  const showAppIcons = () => setSettings("header", { showAppIcons: true });

  it("in the workspace: the unread count follows the channels, and drops untouched seeds again", async () => {
    await start();
    await showAppIcons();
    expect(unreadCount()).toBe(0);
    await setSettings("channels", { email: true });
    expect(unreadCount()).toBe(2);
    await setSettings("channels", { sms: true });
    expect(unreadCount()).toBe(3);
    // Untouched, they go back to waiting with the channels off: so do their notifications.
    await setSettings("channels", { email: false, sms: false });
    expect(unreadCount()).toBe(0);
  });

  it("in the workspace: an opened seed's notification stays when its channel goes off", async () => {
    await start();
    await applyProfile("phase2");
    await h.click(h.navCard("Noah Patel"));
    await applyProfile("phase1");
    await showAppIcons();
    expect(unreadCount()).toBe(1);
  });

  it("a parked seed's notification is hidden like a waiting offer's", () => {
    const accepted = [offer("seed-notification-1", "email", "active"), offer("seed-notification-3", "email", "active")];
    const ids = visibleNotifications(INITIAL_NOTIFICATIONS, accepted, ["voice"], new Set(["seed-notification-3"]))
      .filter((n) => !n.read)
      .map((n) => n.id);
    expect(ids).toEqual(["1", "4"]);
  });
});

describe("2: the add-channel \"+\" needs more than one channel on", () => {
  it("voice + email: in the record header and the nav card; email only: neither; voice back on: both", async () => {
    await setSettings("channels", { email: true });
    await start();
    await h.click(h.navCard("Noah Patel"));
    expect(headerPlus()).not.toBeNull();
    expect(navPlus()).not.toBeNull();
    await setSettings("channels", { voice: false });
    expect(hasCard("Noah Patel")).toBe(true);
    expect(headerPlus()).toBeNull();
    expect(navPlus()).toBeNull();
    await setSettings("channels", { voice: true });
    expect(headerPlus()).not.toBeNull();
    expect(navPlus()).not.toBeNull();
  });
});
