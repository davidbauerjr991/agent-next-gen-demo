// @vitest-environment jsdom
// Settings → Home (P0.5d.2, v3's Home settings ported): the Dashboard's
// header, greeting, section order and queue tiles follow the home section.
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWorkspaceHarness } from "@/test-utils/workspace-harness";
import { AgentWorkspaceAdvancedPage } from "@/components/AgentWorkspaceAdvancedPage";
import { CURRENT_AGENT_FIRST_NAME } from "@/components/agent-next-gen-shared-utils";
import { getSettingsStore, resetSettingsStoreForTests } from "./settings-store";
import { SECTIONS, type HomeSettings } from "./settings-schema";

const h = createWorkspaceHarness();

beforeEach(() => {
  localStorage.clear();
  resetSettingsStoreForTests();
  h.setUp();
});

afterEach(async () => {
  await h.tearDown();
});

async function setHome(patch: Partial<HomeSettings>) {
  await act(async () => {
    getSettingsStore().update("home", patch);
    await vi.advanceTimersByTimeAsync(50);
  });
}

/** The Dashboard's rendered sections, in order ("performance productivity" is one shared row). */
const renderedSections = () =>
  [...h.container.querySelectorAll("[data-home-section]")].map((el) => el.getAttribute("data-home-section"));

const headings = () => [...h.container.querySelectorAll("h1, h2")].map((el) => el.textContent?.trim());

const queueTileNames = () => {
  const queue = h.container.querySelector('[data-home-section="queue"]');
  return ["Digital", "Inbound Voice", "Voicemail", "Work Item", "Outbound Voice"].filter((name) =>
    queue?.textContent?.includes(name),
  );
};

describe("Home: the Dashboard follows Settings → Home", () => {
  it("defaults: the header with Hello + first name, v3's sections then Activity and Reminders, three queue tiles", async () => {
    await h.show(AgentWorkspaceAdvancedPage);
    expect(headings()).toContain(`Hello ${CURRENT_AGENT_FIRST_NAME}`);
    expect(renderedSections()).toEqual(["queue", "contactHistory", "performance productivity", "activity", "reminders"]);
    expect(queueTileNames()).toEqual(["Inbound Voice", "Voicemail", "Outbound Voice"]);
  });

  it("Show header off hides the header block", async () => {
    await h.show(AgentWorkspaceAdvancedPage);
    await setHome({ showHeader: false });
    expect(headings().some((t) => t?.startsWith("Hello"))).toBe(false);
    expect(h.container.textContent).not.toContain("My Assignment Queue");
  });

  it("composes the greeting and the first name; a blank greeting falls back to Hello", async () => {
    await h.show(AgentWorkspaceAdvancedPage);
    await setHome({ greeting: "Welcome back" });
    expect(headings()).toContain(`Welcome back ${CURRENT_AGENT_FIRST_NAME}`);
    await setHome({ showFirstName: false });
    expect(headings()).toContain("Welcome back");
    await setHome({ greeting: "   " });
    expect(headings()).toContain("Hello");
  });

  it("renders the enabled sections in the stored order", async () => {
    await h.show(AgentWorkspaceAdvancedPage);
    await setHome({
      sections: [
        { key: "performance", enabled: true },
        { key: "contactHistory", enabled: true },
        { key: "queue", enabled: false },
        { key: "productivity", enabled: true },
      ],
    });
    // Performance and Productivity aren't adjacent here, so each gets its own row.
    expect(renderedSections()).toEqual(["performance", "contactHistory", "productivity"]);
  });

  it("the queue tiles follow the channel flags; none on drops the row", async () => {
    await h.show(AgentWorkspaceAdvancedPage);
    // A digital channel on (Phase 1 is voice only), so Settings → Channels doesn't hide the Digital tile.
    await act(async () => {
      getSettingsStore().update("channels", { chat: true });
      await vi.advanceTimersByTimeAsync(50);
    });
    await setHome({
      queue: { channels: { digital: true, inboundVoice: false, voicemail: true, workItem: true, outboundVoice: false } },
    });
    expect(queueTileNames()).toEqual(["Digital", "Voicemail", "Work Item"]);
    await setHome({
      queue: { channels: { digital: false, inboundVoice: false, voicemail: false, workItem: false, outboundVoice: false } },
    });
    expect(renderedSections()).not.toContain("queue");
  });

  it("the queue tiles follow Settings → Channels too: Digital needs a digital channel on, the voice tiles need voice; Work Item isn't a channel", async () => {
    await h.show(AgentWorkspaceAdvancedPage);
    await setHome({
      queue: { channels: { digital: true, inboundVoice: true, voicemail: true, workItem: true, outboundVoice: true } },
    });
    // Phase 1: voice only.
    expect(queueTileNames()).toEqual(["Inbound Voice", "Voicemail", "Work Item", "Outbound Voice"]);
    const setChannels = async (channels: Record<string, boolean>) =>
      act(async () => {
        getSettingsStore().update("channels", channels);
        await vi.advanceTimersByTimeAsync(50);
      });
    await setChannels({ email: true });
    expect(queueTileNames()).toEqual(["Digital", "Inbound Voice", "Voicemail", "Work Item", "Outbound Voice"]);
    await setChannels({ voice: false });
    expect(queueTileNames()).toEqual(["Digital", "Work Item"]);
  });
});

describe("Settings → Home controls", () => {
  const button = (title: string) =>
    h.container.querySelector<HTMLButtonElement>(`[title="${title}"], [aria-label="${title}"]`);

  it("the first row's up and the last row's down are disabled; a move reorders the stored sections", async () => {
    await h.show(AgentWorkspaceAdvancedPage);
    const settings = [...h.container.querySelectorAll("aside button, aside [role=button]")].find(
      (el) => el.textContent?.trim() === "Settings",
    )!;
    await h.click(settings);
    expect(button("Move Queue up")?.disabled).toBe(true);
    expect(button("Move Queue down")?.disabled).toBe(false);
    expect(button("Move Follow-ups down")?.disabled).toBe(true);
    expect(button("Move Follow-ups up")?.disabled).toBe(false);
    await h.click(button("Move Queue down")!);
    expect(getSettingsStore().getState().values.home.sections.map((s) => s.key)).toEqual([
      "contactHistory",
      "queue",
      "performance",
      "productivity",
      "activity",
      "reminders",
      "teamQueues",
      "teamToday",
      "needsYou",
      "pipeline",
      "campaignToday",
      "followUps",
    ]);
    expect(button("Move Contact history up")?.disabled).toBe(true);
  });

  it("the queue tile checkboxes show only while Queue is on; greeting fields only while the header is on", async () => {
    await h.show(AgentWorkspaceAdvancedPage);
    const settings = [...h.container.querySelectorAll("aside button, aside [role=button]")].find(
      (el) => el.textContent?.trim() === "Settings",
    )!;
    await h.click(settings);
    const labels = () => [...h.container.querySelectorAll("label")].map((l) => l.textContent?.trim());
    expect(labels()).toEqual(expect.arrayContaining(["Inbound Voice", "Greeting", "Display agent first name"]));
    await setHome({ showHeader: false, sections: SECTIONS.home.defaults.sections.map((s) => ({ ...s, enabled: s.key !== "queue" })) });
    expect(labels()).not.toContain("Inbound Voice");
    expect(labels()).not.toContain("Greeting");
    expect(labels()).not.toContain("Display agent first name");
  });
});

describe("home section storage", () => {
  const read = (raw: unknown) => SECTIONS.home.read(raw, SECTIONS.home.defaults);

  it("keeps a stored order, drops unknown and repeated keys, appends missing ones with their default", () => {
    const value = read({
      sections: [
        { key: "productivity", enabled: false },
        { key: "bogus", enabled: true },
        { key: "queue", enabled: true },
        { key: "productivity", enabled: true },
      ],
    });
    expect(value.sections).toEqual([
      { key: "productivity", enabled: false },
      { key: "queue", enabled: true },
      { key: "contactHistory", enabled: true },
      { key: "performance", enabled: true },
      { key: "activity", enabled: true },
      { key: "reminders", enabled: true },
      { key: "teamQueues", enabled: false },
      { key: "teamToday", enabled: false },
      { key: "needsYou", enabled: false },
      { key: "pipeline", enabled: false },
      { key: "campaignToday", enabled: false },
      { key: "followUps", enabled: false },
    ]);
  });

  it("a stored v2 home from before P-HOME-1 keeps its order and gains the new keys and the oneColumn layout", () => {
    const value = read({
      sections: [
        { key: "performance", enabled: true },
        { key: "queue", enabled: false },
        { key: "contactHistory", enabled: true },
        { key: "productivity", enabled: true },
      ],
    });
    expect(value.sections.slice(0, 4).map((s) => s.key)).toEqual(["performance", "queue", "contactHistory", "productivity"]);
    expect(value.sections.find((s) => s.key === "queue")?.enabled).toBe(false);
    expect(value.sections.find((s) => s.key === "activity")?.enabled).toBe(true);
    expect(value.layout).toBe("oneColumn");
    expect(read({ layout: "grid" }).layout).toBe("oneColumn");
    expect(read({ layout: "twoColumn" }).layout).toBe("twoColumn");
  });

  it("falls back to the defaults for a malformed list or channel flag", () => {
    const value = read({ sections: "nope", queue: { channels: { digital: "yes" } } });
    expect(value.sections).toEqual(SECTIONS.home.defaults.sections);
    expect(value.queue.channels.digital).toBe(false);
    expect(value.greeting).toBe("Hello");
  });
});
