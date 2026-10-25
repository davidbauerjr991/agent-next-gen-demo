// @vitest-environment jsdom
// Settings → Channels: the channels agents contact customers on. Each gate
// with the channel on and off; the sim refusing an inbound on a channel
// that's off; the seeded lists keyed by channel (Contact History, the
// Journey Summary's history rows, the Dashboard's queue tiles) following it.
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CreateNewOutboundConfig } from "@nicecxone/lyra-ui";
import { createWorkspaceHarness } from "@/test-utils/workspace-harness";
import { AgentWorkspaceAdvancedPage } from "@/components/AgentWorkspaceAdvancedPage";
import { OUTBOUND_CONFIG } from "@/components/agent-next-gen-outbound-data";
import { buildContactHistoryByRange } from "@/components/agent-next-gen-contact-history";
import { journeySummaryFor } from "@/contact-handling/journey-summary";
import { enabledChannelOptions, withEnabledChannels } from "@/contact-handling/channel-gates";
import { SettingsView } from "@/components/settings/SettingsView";
import { getSettingsStore, resetSettingsStoreForTests } from "./settings-store";
import { applyProfile } from "./hooks";
import { PROFILES, deriveProfile, profileValues } from "./profiles";
import { showContactHistoryOnHome } from "@/test-utils/home-sections";
import { SECTIONS, SOCIAL_CHANNELS, type ChannelsSettings, type SectionKey, type SettingsState } from "./settings-schema";

const h = createWorkspaceHarness();

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
    await vi.advanceTimersByTimeAsync(50);
  });
}

const PHASE1: ChannelsSettings = SECTIONS.channels.defaults;
const ALL: ChannelsSettings = { ...PHASE1, voice: true, chat: true, email: true, sms: true, whatsapp: true };
const SOCIAL_OFF = Object.fromEntries(SOCIAL_CHANNELS.map((c) => [c, false]));

describe("channel gates (pure)", () => {
  it("New Outbound / the add-channel menu offer only the channels that are on", () => {
    const ids = (channels: ChannelsSettings) => enabledChannelOptions(OUTBOUND_CONFIG.channelOptions, channels).map((o) => o.id);
    expect(ids(PHASE1)).toEqual(["voice"]);
    expect(ids(ALL).sort()).toEqual(OUTBOUND_CONFIG.channelOptions.map((o) => o.id).sort());
    expect(ids({ ...PHASE1, sms: true })).toEqual(expect.arrayContaining(["voice", "sms"]));
  });

  it("a contact's own channel list drops the channels that are off", () => {
    type Contact = CreateNewOutboundConfig["groups"][number]["contacts"] extends (infer T)[] | undefined ? T : never;
    const contact = { id: "c", name: "C", channels: ["voice", "sms", "email"], email: "c@example.com" } as Contact;
    expect(withEnabledChannels(contact, PHASE1).channels).toEqual(["voice"]);
    expect(withEnabledChannels(contact, { ...PHASE1, email: true }).channels).toEqual(["voice", "email"]);
    // Only the channels the entry has an address for: no email on file, no Email.
    const noEmail = { id: "d", name: "D", channels: ["voice", "email"] } as Contact;
    expect(withEnabledChannels(noEmail, ALL).channels).toEqual(["voice"]);
  });

  it("the Contact History fixtures span several channels (so the page tests below mean something)", () => {
    const channels = new Set(Object.values(buildContactHistoryByRange([])).flat().map((e) => e.channelType));
    expect(channels.has("voice")).toBe(true);
    expect(channels.size).toBeGreaterThan(1);
  });

  it("the seeded lists keep only the rows on channels that are on: Contact History (every range, this session's rows too) and the Journey Summary's history rows", () => {
    const types = (byRange: ReturnType<typeof buildContactHistoryByRange>) => new Set(Object.values(byRange).flat().map((e) => e.channelType));
    const dismissed = { ...buildContactHistoryByRange([]).last48h.find((e) => e.channelType === "chat")!, id: "dismissed-chat" };
    expect(types(buildContactHistoryByRange([dismissed], PHASE1))).toEqual(new Set(["voice"]));
    expect(buildContactHistoryByRange([dismissed], PHASE1).today).toEqual([]);
    expect(types(buildContactHistoryByRange([dismissed], { ...PHASE1, chat: true }))).toEqual(new Set(["voice", "chat"]));
    // A customer whose history includes an off channel: those rows are left out of the Journey Summary.
    const entry = buildContactHistoryByRange([]).last72h.find((e) => e.channelType !== "voice" && e.customerId)!;
    const all = journeySummaryFor({ customerName: entry.name, customerId: entry.customerId });
    const voiceOnly = journeySummaryFor({ customerName: entry.name, customerId: entry.customerId, channels: PHASE1 });
    expect(all!.rows.length).toBeGreaterThan(voiceOnly?.rows.length ?? 0);
  });

  it("Phase 1 is voice only; Phase 2 turns every channel on (the social placeholders aren't in a profile)", () => {
    expect(PHASE1).toEqual({ voice: true, chat: false, email: false, sms: false, whatsapp: false, social: SOCIAL_OFF });
    expect(profileValues("phase1").channels).toEqual({ voice: true, chat: false, email: false, sms: false, whatsapp: false });
    expect(profileValues("phase2").channels).toEqual({ voice: true, chat: true, email: true, sms: true, whatsapp: true });
    expect(profileValues("aifirst").channels).toEqual(profileValues("phase2").channels);
    // The built-in snapshots themselves leave every social channel off.
    for (const id of ["phase1", "phase2", "aifirst"] as const) expect(PROFILES[id].channels.social).toEqual(SOCIAL_OFF);
  });
});

describe("social placeholders (channels.social)", () => {
  it("store and round-trip through storage", async () => {
    await setSettings("channels", { social: { ...SOCIAL_OFF, messenger: true, wechat: true } as ChannelsSettings["social"] });
    resetSettingsStoreForTests();
    expect(getSettingsStore().getState().values.channels.social).toEqual({ ...SOCIAL_OFF, messenger: true, wechat: true });
    // An older stored channels value (no `social`) keeps its choices and reads them all off.
    expect(SECTIONS.channels.read({ voice: false, chat: true }, PHASE1)).toEqual({ ...PHASE1, voice: false, chat: true });
  });

  it("are admin-scope, like the brand: applyProfile(\"phase2\") leaves a set brand and a set social switch unchanged", async () => {
    const brand = { appName: "Acme Care", logo: null, colors: { primary: "#c2185b", accent: null } };
    await setSettings("appearance", { brand });
    await setSettings("channels", { social: { ...SOCIAL_OFF, instagram: true } as ChannelsSettings["social"] });
    expect(deriveProfile(getSettingsStore().getState().values)).toBe("phase1");
    await act(async () => applyProfile("phase2"));
    const { channels, appearance } = getSettingsStore().getState().values;
    expect(channels.social).toEqual({ ...SOCIAL_OFF, instagram: true });
    expect(appearance.brand).toEqual(brand);
    expect(channels.chat).toBe(true);
    expect(deriveProfile(getSettingsStore().getState().values)).toBe("phase2");
  });

  it("Settings lists them under Social, each tagged \"Arrives in P2.7\"", async () => {
    await h.render(<SettingsView />);
    const group = h.container.querySelector("[data-setting=social-channels]")!;
    expect(group.textContent).toContain("Social");
    expect(group.querySelectorAll("[role=switch]")).toHaveLength(8);
    expect(group.textContent!.match(/Arrives in P2\.7/g)).toHaveLength(8);
    await h.click(group.querySelector<HTMLElement>("[role=switch]")!);
    expect(getSettingsStore().getState().values.channels.social.messenger).toBe(true);
  });

  it("nothing routes them: the workspace's agent channels never include one", async () => {
    await h.show(AgentWorkspaceAdvancedPage);
    const setAgentChannels = vi.spyOn(h.provider, "setAgentChannels");
    await setSettings("channels", { chat: true, social: { ...SOCIAL_OFF, messenger: true, x: true } as ChannelsSettings["social"] });
    expect(setAgentChannels).toHaveBeenCalled();
    for (const [channels] of setAgentChannels.mock.calls) expect([...channels].sort()).toEqual(["chat", "voice"]);
  });
});

describe("routing (the sim's startInbound)", () => {
  it("refuses an inbound on a channel that's off, with a dev warning; on, it's offered", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await h.show(AgentWorkspaceAdvancedPage);
    await h.goAvailable();
    // Off: refused, so accepting finds nothing to accept.
    const refusedId = await h.startInbound("chat", "priya.shah@example.com", "Priya Shah");
    await h.accept(refusedId);
    expect(() => h.navCard("Priya Shah")).toThrow();
    expect(warn.mock.calls.some((args) => args.some((a) => String(a).includes("channel chat is off in Settings → Channels")))).toBe(true);
    await setSettings("channels", { chat: true });
    // On: offered (a digital offer is a notification until accepted).
    await h.accept(await h.startInbound("chat", "priya.shah@example.com", "Priya Shah"));
    expect(() => h.navCard("Priya Shah")).not.toThrow();
    warn.mockRestore();
  });

  it("refuses every inbound while the agent isn't Available or Working, with a dev warning", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await h.show(AgentWorkspaceAdvancedPage);
    await setSettings("channels", { chat: true });
    // Not yet Available: neither a chat nor a call reaches the agent.
    for (const [channel, address] of [["chat", "priya.shah@example.com"], ["voice", "(312) 555-0164"]] as const) {
      await h.accept(await h.startInbound(channel, address, "Priya Shah"));
      expect(() => h.navCard("Priya Shah")).toThrow();
    }
    expect(warn.mock.calls.filter((args) => args.some((a) => String(a).includes("not available or working")))).toHaveLength(2);
    await h.goAvailable();
    await h.accept(await h.startInbound("chat", "priya.shah@example.com", "Priya Shah"));
    expect(() => h.navCard("Priya Shah")).not.toThrow();
    warn.mockRestore();
  });

  it("a contact open on a channel that's turned off stays until it ends", async () => {
    await h.show(AgentWorkspaceAdvancedPage);
    await h.goAvailable();
    await setSettings("channels", { chat: true });
    await h.accept(await h.startInbound("chat", "priya.shah@example.com", "Priya Shah"));
    await setSettings("channels", { chat: false });
    expect(() => h.navCard("Priya Shah")).not.toThrow();
  });
});

describe("the Customers table's channel actions", () => {
  const table = () => h.container.querySelector("table");
  const iconsTitled = (label: string) => table()?.querySelectorAll(`[title="${label}"], [aria-label="${label}"]`).length ?? 0;
  /** Select Channel's options, by label (a radio's name lives in its <label>). */
  const radios = () =>
    [...document.body.querySelectorAll('[role="radio"]')].map(
      (r) =>
        (r.id && document.querySelector(`label[for="${r.id}"]`)?.textContent?.trim()) ||
        r.closest("label")?.textContent?.trim() ||
        r.getAttribute("value"),
    );

  async function customersTab() {
    await h.show(AgentWorkspaceAdvancedPage);
    await act(async () => {
      getSettingsStore().updateMany(profileValues("phase2"));
      await vi.advanceTimersByTimeAsync(50);
    });
    const tab = [...h.container.querySelectorAll('[data-slot=home-tabs] [role="tab"]')].find((t) => t.textContent?.trim() === "Customers")!;
    await h.click(tab);
  }

  it("email off: no email icon on any row and no Email in Select Channel", async () => {
    await customersTab();
    expect(iconsTitled("Email")).toBeGreaterThan(0);
    await setSettings("channels", { email: false });
    expect(iconsTitled("Email")).toBe(0);
    const voice = table()!.querySelector<HTMLElement>('[title="Voice"], [aria-label="Voice"]')!;
    await h.click(voice);
    expect(radios()).toContain("Voice");
    expect(radios()).not.toContain("Email");
  });

  it("voice only: one icon per row, and the popover skips the channel step", async () => {
    await customersTab();
    await setSettings("channels", { voice: true, chat: false, email: false, sms: false, whatsapp: false });
    for (const label of ["Email", "SMS", "WhatsApp", "Chat"]) expect(iconsTitled(label)).toBe(0);
    await h.click(table()!.querySelector<HTMLElement>('[title="Voice"], [aria-label="Voice"]')!);
    expect(radios()).toEqual([]);
    expect(document.body.textContent).toContain("Outbound Skill");
  });
});

describe("New Outbound's Select Channel (lyra CreateNew, the same channel list)", () => {
  const radios = () =>
    [...document.body.querySelectorAll('[role="radio"]')].map(
      (r) =>
        (r.id && document.querySelector(`label[for="${r.id}"]`)?.textContent?.trim()) ||
        r.closest("label")?.textContent?.trim() ||
        r.getAttribute("value"),
    );
  const button = (text: string) => [...document.body.querySelectorAll("button")].find((b) => b.textContent?.trim() === text);
  const startsWith = (text: string) => [...document.body.querySelectorAll("button")].find((b) => b.textContent?.trim().startsWith(text));

  async function typeIn(input: HTMLInputElement, value: string) {
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await vi.advanceTimersByTimeAsync(50);
    });
  }

  /** Phase 2, New Outbound open on Favorites, the search field typed into. */
  async function search(query: string) {
    await h.show(AgentWorkspaceAdvancedPage);
    await act(async () => {
      getSettingsStore().updateMany(profileValues("phase2"));
      await vi.advanceTimersByTimeAsync(50);
    });
    await h.click([...h.container.querySelectorAll("aside button")].find((b) => b.textContent?.includes("New Outbound"))!);
    const field = document.getElementById("new-outbound-search") as HTMLInputElement;
    await typeIn(field, query);
  }

  it("a typed email (an entry with only an email address) offers only Email", async () => {
    await search("jane@example.com");
    await h.click(startsWith("Continue with")!);
    expect(radios()).toEqual(["Email"]);
  });

  it("with Email off, a typed email offers none", async () => {
    await search("jane@example.com");
    await setSettings("channels", { email: false });
    await h.click(startsWith("Continue with")!);
    expect(radios()).not.toContain("Email");
  });

  it("a typed phone number offers Voice, SMS and WhatsApp; SMS off drops SMS", async () => {
    await search("(312) 555-0199");
    await setSettings("channels", { sms: false });
    await h.click(startsWith("Continue with")!);
    expect(radios()).toEqual(["Voice", "WhatsApp"]);
  });

  it("an SMS outbound to a directory customer adds an SMS row to their card", async () => {
    await search("Priya");
    // The menu shows a count per group; the All group lists the match.
    const all = [...document.querySelectorAll<HTMLElement>("[data-radix-popper-content-wrapper] *")].find(
      (el) => (el.getAttribute("role") === "button" || el.tagName === "BUTTON") && el.textContent?.trim().startsWith("All"),
    )!;
    await h.click(all);
    const row = [...document.querySelectorAll<HTMLElement>("[data-radix-popper-content-wrapper] *")].find(
      (el) => (el.getAttribute("role") === "button" || el.tagName === "BUTTON") && el.textContent?.includes("Priya Shah"),
    )!;
    await h.click(row);
    const sms = [...document.body.querySelectorAll<HTMLElement>('[role="radio"]')].find(
      (r) => (r.id && document.querySelector(`label[for="${r.id}"]`)?.textContent?.trim()) === "SMS" || r.getAttribute("value") === "sms",
    )!;
    await h.click(sms);
    await h.click(button("Start Interaction")!);
    await h.advance(500);
    const rows = [...h.container.querySelectorAll("aside [aria-label]")].map((el) => el.getAttribute("aria-label")!);
    expect(rows.some((label) => label.startsWith("SMS channel"))).toBe(true);
  });
});

describe("the workspace", () => {
  const launcher = () => [...h.container.querySelectorAll("aside button")].find((b) => b.textContent?.includes("New Outbound"));
  const historySection = () => h.container.querySelector('[data-home-section="contactHistory"]');
  const historyTags = () =>
    [...(historySection()?.querySelectorAll('[role="button"]') ?? [])].flatMap((row) =>
      ["Voice", "Chat", "Email", "SMS", "WhatsApp"].filter((label) =>
        [...row.querySelectorAll("span")].some((s) => s.children.length === 0 && s.textContent?.trim() === label),
      ),
    );

  it("Contact History follows Settings → Channels: voice only shows voice rows only; turning chat on restores its rows, off drops them again", async () => {
    showContactHistoryOnHome();
    await h.show(AgentWorkspaceAdvancedPage);
    const rows = () => historySection()?.querySelectorAll('[role="button"]').length ?? 0;
    const snapshot = () => ({ rows: rows(), tags: historyTags() });
    // Phase 1 (voice only): voice rows only, each with its chip.
    const voiceOnly = snapshot();
    expect(voiceOnly.rows).toBeGreaterThan(0);
    expect(voiceOnly.tags).toHaveLength(voiceOnly.rows);
    expect(new Set(voiceOnly.tags)).toEqual(new Set(["Voice"]));
    // Chat on: its rows come back beside the voice ones.
    await setSettings("channels", { voice: true, chat: true });
    const withChat = snapshot();
    expect(new Set(withChat.tags)).toEqual(new Set(["Voice", "Chat"]));
    expect(withChat.rows).toBeGreaterThanOrEqual(voiceOnly.rows);
    // Every channel on (Phase 2): every channel's rows.
    await act(async () => {
      getSettingsStore().updateMany(profileValues("phase2"));
      // Phase 2, like every built-in, has Contact History off on Home (P-HOME-1).
      showContactHistoryOnHome();
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(new Set(snapshot().tags).size).toBeGreaterThan(2);
    // Voice off, chat on, mid-session: chat rows only, on the next render.
    await setSettings("channels", { voice: false, chat: true, email: false, sms: false, whatsapp: false });
    expect(new Set(snapshot().tags)).toEqual(new Set(["Chat"]));
  });

  it("voice off hides the Dial Pad (and with it, Phase 1's whole launcher)", async () => {
    await h.show(AgentWorkspaceAdvancedPage);
    expect(launcher()).toBeTruthy();
    await setSettings("channels", { voice: false, chat: true });
    expect(launcher()).toBeUndefined();
  });

  it("Settings: one switch per channel; during a call, voice shows a note instead of its switch", async () => {
    await h.show(AgentWorkspaceAdvancedPage);
    const settings = [...h.container.querySelectorAll("aside button, aside [role=button]")].find(
      (el) => el.textContent?.trim() === "Settings",
    )!;
    await h.click(settings);
    const row = (channel: string) => h.container.querySelector(`[data-channel-row="${channel}"]`);
    const switchLabel = (label: string) =>
      [...h.container.querySelectorAll("label")].some((l) => l.textContent?.trim() === label);
    for (const label of ["Voice", "Chat", "Email", "SMS", "WhatsApp"]) expect(switchLabel(label)).toBe(true);
    expect(row("voice")).toBeNull();
    await h.goAvailable();
    const id = await h.startInbound("voice", "(312) 555-0164", "Lauren Briggs");
    await h.accept(id);
    expect(row("voice")?.textContent).toContain("A call is in progress");
    expect(switchLabel("Voice")).toBe(false);
  });
});
