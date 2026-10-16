// @vitest-environment jsdom
// Settings → New Outbound (CXone's Directory App and Outbound Calling) and
// the two Assignments flags (Allow Unassign & Dismiss, Confirm before
// closing). A behavior that's off hides its control, never greys it.
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CreateNewOutboundConfig } from "@nicecxone/lyra-ui";
import { createWorkspaceHarness } from "@/test-utils/workspace-harness";
import { AgentWorkspaceAdvancedPage } from "@/components/AgentWorkspaceAdvancedPage";
import { ApprovalDecision } from "@/components/agent-next-gen-transcript";
import { OUTBOUND_GROUPS } from "@/components/agent-next-gen-outbound-data";
import { addressBookGroup, ADDRESS_BOOKS } from "@/contact-handling/address-books";
import { launcherGroups } from "@/contact-handling/launcher-groups";
import { getSettingsStore, resetSettingsStoreForTests } from "./settings-store";
import { PROFILES } from "./profiles";
import { LAUNCHER_TABS, type LauncherTab, type SectionKey, type SettingsState } from "./settings-schema";

const h = createWorkspaceHarness();

beforeEach(() => {
  localStorage.clear();
  resetSettingsStoreForTests();
  h.setUp();
});

afterEach(async () => {
  await h.tearDown();
});

const store = () => getSettingsStore();

async function setSettings<K extends SectionKey>(section: K, patch: Partial<SettingsState[K]>) {
  await act(async () => {
    store().update(section, patch);
    await vi.advanceTimersByTimeAsync(50);
  });
}

const tabs = (...on: LauncherTab[]) =>
  Object.fromEntries(LAUNCHER_TABS.map((t) => [t, on.includes(t)])) as Record<LauncherTab, boolean>;
const groupsFor = (on: Record<LauncherTab, boolean>, adHoc = true) =>
  launcherGroups(OUTBOUND_GROUPS as CreateNewOutboundConfig["groups"], on, adHoc, addressBookGroup(ADDRESS_BOOKS, "", () => {})).map(
    (g) => g.label,
  );

describe("Directory App (outbound.launcher)", () => {
  it("each live tab adds its group; Search, Agents, Skills and Teams stay inert", () => {
    expect(groupsFor(tabs("dialpad"))).toEqual(["Dial Pad"]);
    expect(groupsFor(tabs("dialpad", "all", "favorites", "addressBook"))).toEqual(["Dial Pad", "All", "Favorites", "Address Book"]);
    expect(groupsFor(tabs("search", "agents", "skills", "teams"))).toEqual([]);
  });

  it("Ad-hoc off hides the Dial Pad", () => {
    expect(groupsFor(tabs("dialpad", "favorites"), false)).toEqual(["Favorites"]);
  });

  it("the Address Book group lists every address book with its entry count", () => {
    const group = addressBookGroup(ADDRESS_BOOKS, "", () => {});
    expect(group.subFilter?.options.map((o) => o.label)).toEqual([
      "Partner Network (0)",
      "Vendor Directory (0)",
      "Regional Offices (0)",
    ]);
    const uploaded = [...ADDRESS_BOOKS, { id: "mine", name: "My uploads", source: "uploaded" as const, entries: [] }];
    expect(addressBookGroup(uploaded, "mine", () => {}).emptyMessage).toBe("No My uploads contacts yet");
  });

  it("Phase 1: the launcher shows; with no live tab (Ad-hoc off) it's hidden", async () => {
    await h.show(AgentWorkspaceAdvancedPage);
    const launcher = () => [...h.container.querySelectorAll("aside button")].find((b) => b.textContent?.includes("New Outbound"));
    expect(launcher()).toBeTruthy();
    await setSettings("outbound", { calling: { ...store().getState().values.outbound.calling, adHoc: false } });
    expect(launcher()).toBeUndefined();
  });

  it("Phase 2 turns every tab and behavior on", () => {
    const outbound = PROFILES.phase2.outbound;
    expect(Object.values(outbound.launcher).every(Boolean)).toBe(true);
    expect(Object.values(outbound.calling).every(Boolean)).toBe(true);
  });
});

describe("Outbound Calling (outbound.calling)", () => {
  it("Redial off hides Contact History's Redial button", async () => {
    await h.show(AgentWorkspaceAdvancedPage);
    const nathan = [...h.container.querySelectorAll('[role="button"]')].find((el) => el.textContent?.includes("Nathan Cole"))!;
    await h.click(nathan);
    expect(h.buttonByText("Redial")).toBeTruthy();
    await setSettings("outbound", { calling: { ...store().getState().values.outbound.calling, redial: false } });
    expect(h.buttonByText("Redial")).toBeUndefined();
  });

  describe("Save and Redial (lyra's Outcome footer, showSaveAndRedial)", () => {
    /** An inbound call that has ended: the wrap-up card's footer is up. */
    async function endedCall() {
      await h.show(AgentWorkspaceAdvancedPage);
      await h.goAvailable();
      const id = await h.startInbound("voice", "(312) 555-0164", "Lauren Briggs");
      await h.accept(id);
      await h.click(h.navCard("Lauren Briggs"));
      await act(async () => {
        h.customer.hangUp({ interactionId: id });
        await vi.advanceTimersByTimeAsync(300);
      });
    }
    const saveAndRedial = () => h.buttonByText("Save & Redial");

    it("on: the footer offers Save & Redial and Save & Dismiss", async () => {
      await endedCall();
      expect(h.buttonByText("Save & Dismiss")).toBeTruthy();
      expect(saveAndRedial()).toBeTruthy();
    });

    it("off: only Save & Dismiss", async () => {
      await endedCall();
      await setSettings("outbound", { calling: { ...store().getState().values.outbound.calling, saveAndRedial: false } });
      expect(h.buttonByText("Save & Dismiss")).toBeTruthy();
      expect(saveAndRedial()).toBeUndefined();
    });

    it("voice channel off: Save & Redial is hidden too", async () => {
      await endedCall();
      await setSettings("channels", { voice: false });
      expect(h.buttonByText("Save & Dismiss")).toBeTruthy();
      expect(saveAndRedial()).toBeUndefined();
    });
  });

  it("Elevation off: an approval card offers no Call now (no call handler)", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const decisions = [
      { value: "approve", title: "Approve", result: "Approved" },
      { value: "upset-call", title: "Call now", callRequest: true, result: "Calling" },
    ];
    const titles = () => [...container.querySelectorAll('[role="radio"]')].map((r) => r.textContent?.trim());
    await act(async () => root.render(<ApprovalDecision decisions={decisions} onCallRequest={() => {}} />));
    expect(titles()).toEqual(["Approve", "Call now"]);
    await act(async () => root.render(<ApprovalDecision decisions={decisions} />));
    expect(titles()).toEqual(["Approve"]);
    await act(async () => root.unmount());
  });
});

describe("Assignments: Unassign & Dismiss", () => {
  const navDismissIcons = () =>
    h.container.querySelectorAll('aside [title="Unassign & Dismiss"], aside [aria-label="Unassign & Dismiss"]');

  async function endedChat() {
    await h.show(AgentWorkspaceAdvancedPage);
    await h.goAvailable();
    await setSettings("channels", { chat: true });
    const id = await h.startInbound("chat", "priya.shah@example.com", "Priya Shah");
    await h.accept(id);
    await h.click(h.navCard("Priya Shah"));
    await act(async () => {
      h.customer.hangUp({ interactionId: id });
      await vi.advanceTimersByTimeAsync(200);
    });
  }

  it("Allow Unassign & Dismiss off hides the icon even once the contact has ended", async () => {
    await endedChat();
    expect(navDismissIcons()).toHaveLength(1);
    await setSettings("assignments", { allowUnassignDismiss: false });
    expect(navDismissIcons()).toHaveLength(0);
  });

  it("Confirm before closing: dismissing asks first; Cancel keeps the card, Close contact removes it", async () => {
    await endedChat();
    await setSettings("assignments", { confirmClose: true });
    await h.click(navDismissIcons()[0]);
    expect(document.body.textContent).toContain("Close this contact?");
    expect(() => h.navCard("Priya Shah")).not.toThrow();
    await h.click(h.buttonByText("Cancel")!);
    expect(document.body.textContent).not.toContain("Close this contact?");
    expect(() => h.navCard("Priya Shah")).not.toThrow();
    await h.click(navDismissIcons()[0]);
    await h.click(h.buttonByText("Close contact")!);
    await h.advance(500);
    expect(() => h.navCard("Priya Shah")).toThrow();
  });

  it("off by default: dismissing doesn't ask", async () => {
    await endedChat();
    await h.click(navDismissIcons()[0]);
    expect(document.body.textContent).not.toContain("Close this contact?");
  });
});
