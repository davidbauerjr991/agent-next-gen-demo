// @vitest-environment jsdom
// P-LAYOUT-F3 8: an unidentified contact (`isIdentifiedContact`) has no Contact Details — its record header keeps
// Session Details — and an unknown caller arrives with no name fields: the card reads as its number, never a name
// copied from it. A known caller (Maya, scripted) keeps Contact Details.
import { act } from "react";
import { createRoot } from "react-dom/client";
import { useCustomerRecordDraft } from "@/components/customer-info";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SIM_DEMO_SEED } from "@/adapters/sim/sim-fixtures";
import { createWorkspaceHarness } from "@/test-utils/workspace-harness";
import { AgentWorkspaceAdvancedPage } from "@/components/AgentWorkspaceAdvancedPage";
import { MAYA_CHEN_SCRIPT } from "@/scenarios/scripts/maya-chen";
import { profileValues } from "@/settings/profiles";
import { getSettingsStore, resetSettingsStoreForTests } from "@/settings/settings-store";

const h = createWorkspaceHarness({ seed: SIM_DEMO_SEED });
beforeEach(() => {
  localStorage.clear();
  resetSettingsStoreForTests();
  h.setUp();
});
afterEach(async () => {
  await h.tearDown();
});

const UNKNOWN = "(415) 555-0199";
const contactDetailsButton = () =>
  [...h.container.querySelectorAll<HTMLElement>("button[aria-label]")].find(
    (b) => /Contact Details$/.test(b.getAttribute("aria-label")!) && !b.closest("[data-slot=right-panel]"),
  );
// The session row's button: "{n} Messages | # case · date" then "Session Details".
const sessionDetails = () => [...h.container.querySelectorAll<HTMLElement>("button")].find((b) => b.textContent?.includes("Session Details"));

async function open() {
  await act(async () => {
    getSettingsStore().updateMany(profileValues("phase2"));
    getSettingsStore().update("ai", { displayLocation: "inline", canvasLayout: "twoColumn" });
    await vi.advanceTimersByTimeAsync(50);
  });
  await h.show(AgentWorkspaceAdvancedPage);
  await h.goAvailable();
}

describe("an unlinked contact has no Contact Details (P-LAYOUT-F3 8)", () => {
  it("an unknown caller: no name fields, Session Details only", async () => {
    await open();
    const id = await h.startInbound("chat", UNKNOWN);
    await h.accept(id);
    const snapshot = await act(async () => {
      const s = h.provider.getSnapshot();
      await vi.advanceTimersByTimeAsync(50);
      return s;
    });
    expect(snapshot.interactions.find((i) => i.id === id)?.contactName).toBeUndefined();
    await h.click(h.navCard(UNKNOWN));
    await h.advance(50);
    expect(contactDetailsButton()).toBeUndefined();
    expect(sessionDetails()).toBeTruthy();
  });

  it("a record draft with no name on file starts with empty First and Last Name (never the number or 'Customer')", async () => {
    const drafts: { firstName: string; lastName: string }[] = [];
    function Probe({ name }: { name?: string }) {
      drafts.push(useCustomerRecordDraft([], name, "rec-1").draft);
      return null;
    }
    const el = document.createElement("div");
    const root = createRoot(el);
    await act(async () => root.render(<Probe />));
    expect(drafts[drafts.length - 1]).toMatchObject({ firstName: "", lastName: "" });
    await act(async () => root.render(<Probe key="named" name="Maya Chen" />));
    expect(drafts[drafts.length - 1]).toMatchObject({ firstName: "Maya", lastName: "Chen" });
    await act(async () => root.unmount());
  });

  it("a known caller keeps Contact Details", async () => {
    await open();
    await h.play(MAYA_CHEN_SCRIPT.id);
    await h.click(h.navCard("Maya Chen"));
    await h.advance(200);
    expect(contactDetailsButton()).toBeTruthy();
  });
});
