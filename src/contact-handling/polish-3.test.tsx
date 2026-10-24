// @vitest-environment jsdom
// P-POLISH 3: Consult / Transfer and End call in the nav rows' hover cluster,
// the transcript toolbar (Download, Email copy), and the session-row kebab
// trimmed to Consult / Transfer.
import type React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CREATE_NEW_CUSTOMERS } from "@nicecxone/lyra-ui/customers-data";
import { SIM_DEMO_SEED } from "@/adapters/sim/sim-fixtures";
import { createWorkspaceHarness } from "@/test-utils/workspace-harness";
import { AgentWorkspaceAdvancedPage } from "@/components/AgentWorkspaceAdvancedPage";
import { SessionActionCluster } from "@/components/transcript/session-row/SessionActionCluster";
import { createSimTranscriptExportProvider } from "@/adapters/sim/sim-transcript-export-provider";
import type { InteractionId } from "@/domain";
import { MARCUS_WEBB_SCRIPT } from "@/scenarios";
import { getSettingsStore, resetSettingsStoreForTests } from "@/settings/settings-store";
import { profileValues } from "@/settings/profiles";

const h = createWorkspaceHarness({ seed: SIM_DEMO_SEED });
const MAYA = "maya-chen-refund-call";
const priya = CREATE_NEW_CUSTOMERS.find((c) => c.id === "priya-shah-history")!;

beforeEach(() => {
  localStorage.clear();
  resetSettingsStoreForTests();
  h.setUp();
});
afterEach(async () => {
  await h.tearDown();
  vi.restoreAllMocks();
});

async function setUp(settings: { displayLocation?: "inline" | "panel" | "main"; confirmClose?: boolean } = {}) {
  await act(async () => {
    const store = getSettingsStore();
    store.updateMany(profileValues("phase2"));
    store.update("channels", { voice: true, chat: true, email: true, sms: true, whatsapp: true });
    store.update("ai", { displayLocation: settings.displayLocation ?? "inline" });
    if (settings.confirmClose !== undefined) store.update("assignments", { confirmClose: settings.confirmClose });
    await vi.advanceTimersByTimeAsync(50);
  });
  await h.show(AgentWorkspaceAdvancedPage);
  await h.goAvailable();
  await h.advance(500);
}

const cardOf = (name: string) => h.navCard(name).closest<HTMLElement>("[data-slot=assignment-card]")!;
const titled = (root: ParentNode, title: string) => root.querySelector<HTMLElement>(`[title="${title}"], [aria-label="${title}"]`);
const bodyButton = (text: string) =>
  [...document.body.querySelectorAll<HTMLElement>("button")].find((b) => b.textContent?.trim() === text);

async function mayaAndChat() {
  await h.play(MAYA);
  await h.advance(3_000);
  const chat = await h.startInbound("chat", "ana@example.com", "Ana Ruiz");
  await h.accept(chat);
  await h.advance(1_000);
}

const mayasCall = async () => {
  let call;
  await act(async () => {
    const s = h.provider.getSnapshot();
    await vi.advanceTimersByTimeAsync(50);
    call = (await s).interactions.find((i) => i.channel === "voice" && i.contactName === "Maya Chen");
  });
  return call as unknown as { id: InteractionId; state: string };
};

describe("nav row actions", () => {
  it("Consult / Transfer is in the row's cluster for a voice leg and a chat; End Call only for the live voice leg", async () => {
    await setUp();
    await mayaAndChat();
    expect(titled(cardOf("Maya Chen"), "Consult / Transfer")).not.toBeNull();
    expect(titled(cardOf("Maya Chen"), "End Call")).not.toBeNull();
    expect(titled(cardOf("Ana Ruiz"), "Consult / Transfer")).not.toBeNull();
    expect(titled(cardOf("Ana Ruiz"), "End Call")).toBeNull();

    // Hung up: the leg is no longer live.
    await act(async () => {
      const call = await mayasCall();
      const ended = h.provider.end(call.id);
      await vi.advanceTimersByTimeAsync(300);
      await ended;
    });
    await h.advance(500);
    expect(titled(cardOf("Maya Chen"), "End Call")).toBeNull();
  });

  it("an async row (SMS) offers Transfer only; voice and chat rows offer Consult / Transfer", async () => {
    await setUp();
    await mayaAndChat();
    await act(async () => {
      const dialed = h.provider.dial({ channel: "sms", address: "(646) 555-0166", skillId: "general" });
      await vi.advanceTimersByTimeAsync(800);
      await dialed;
    });
    await h.advance(1_000);
    const sms = cardOf("(646) 555-0166");
    expect(titled(sms, "Transfer")).not.toBeNull();
    expect(titled(sms, "Consult / Transfer")).toBeNull();
    expect(titled(cardOf("Maya Chen"), "Consult / Transfer")).not.toBeNull();
    expect(titled(cardOf("Ana Ruiz"), "Consult / Transfer")).not.toBeNull();
    expect(titled(cardOf("Ana Ruiz"), "Transfer")).toBeNull();
  });

  it("Marcus before takeover: Transfer and End Call are disabled with the reason; enabled after", async () => {
    await setUp();
    await h.play(MARCUS_WEBB_SCRIPT.id);
    await h.click(h.navCard("Marcus Webb"));
    const row = () => cardOf("Marcus Webb");
    const transfer = () => titled(row(), "Consult / Transfer") as HTMLButtonElement;
    const endCall = () => titled(row(), "End Call") as HTMLButtonElement;
    expect(transfer().disabled).toBe(true);
    expect(endCall().disabled).toBe(true);
    expect(transfer().closest("[data-disabled-reason]")?.getAttribute("data-disabled-reason")).toBe("Take over to transfer");
    expect(endCall().closest("[data-disabled-reason]")?.getAttribute("data-disabled-reason")).toBe("Take over to end the call");

    await h.click(bodyButton("Takeover Call")!);
    await h.advance(500);
    expect(transfer().disabled).toBe(false);
    expect(endCall().disabled).toBe(false);
    expect(row().querySelector("[data-disabled-reason]")).toBeNull();
  });

  it("End Call hangs up at once with Close confirmation off", async () => {
    await setUp({ confirmClose: false });
    await mayaAndChat();
    await h.click(titled(cardOf("Maya Chen"), "End Call")!);
    await h.advance(500);
    expect(bodyButton("Close contact")).toBeUndefined();
    expect((await mayasCall()).state).not.toBe("active");
  });

  it("End Call asks the Close confirm first with Close confirmation on; confirming hangs up, Cancel leaves the call", async () => {
    await setUp({ confirmClose: true });
    await mayaAndChat();
    await h.click(titled(cardOf("Maya Chen"), "End Call")!);
    await h.advance(500);
    expect(document.body.textContent).toContain("Close this contact?");
    expect((await mayasCall()).state).toBe("active");
    await h.click(bodyButton("Cancel")!);
    await h.advance(500);
    expect((await mayasCall()).state).toBe("active");

    await h.click(titled(cardOf("Maya Chen"), "End Call")!);
    await h.advance(500);
    await h.click(bodyButton("Close contact")!);
    await h.advance(500);
    expect((await mayasCall()).state).not.toBe("active");
  });
});

describe("transcript menu", () => {
  const panel = () => h.container.querySelector<HTMLElement>("[data-slot=right-panel]")!;
  const contactDetailsButton = () =>
    [...h.container.querySelectorAll<HTMLElement>("button[aria-label]")].find(
      (b) => /Contact Details$/.test(b.getAttribute("aria-label")!) && !b.closest("[data-slot=right-panel]"),
    )!;
  const voiceBarTranscript = () =>
    [...h.container.querySelectorAll<HTMLElement>("[data-slot=voice-bar] button")].find(
      (b) => b.textContent?.trim() === "Transcript" || b.getAttribute("aria-label") === "Transcript",
    );
  const menuText = () => document.body.textContent ?? "";
  const open = async (el: HTMLElement) => {
    await act(async () => {
      for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
        el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, button: 0 }));
      }
      await vi.advanceTimersByTimeAsync(100);
    });
  };
  /** The menu row whose text starts with `label`: the smallest element that holds it, outside the voice bar's own button. */
  const menuItem = (label: string) => {
    const holders = [...document.body.querySelectorAll<HTMLElement>("div, button")].filter(
      (el) => el.textContent?.trim().startsWith(label) && !el.closest("[data-slot=voice-bar]") && !el.closest("[data-slot=transcript-tab-header]"),
    );
    // Menu rows are the elements with no holder inside them; the label text sits in a child, so click its row.
    const row = holders.filter((el) => !holders.some((other) => other !== el && el.contains(other)))[0];
    return (row?.closest("[role=menuitem], button") as HTMLElement | null) ?? row;
  };

  async function mayaCall() {
    await setUp({ displayLocation: "inline" });
    await h.play(MAYA);
    await h.advance(3_000);
    await h.click(h.navCard("Maya Chen"));
  }

  it("the voice bar's Transcript button opens the two-item menu and no longer toggles transcript visibility", async () => {
    await mayaCall();
    const hiddenBefore = h.container.querySelector("[data-main-thread]")!.textContent;
    const panelOpenBefore = panel().getAttribute("data-open");
    await open(voiceBarTranscript()!);
    expect(menuText()).toContain("Download transcript");
    expect(menuText()).toContain("Email copy to customer");
    expect(panel().getAttribute("data-open")).toBe(panelOpenBefore);
    expect(h.container.querySelector("[data-main-thread]")!.textContent).toBe(hiddenBefore);
  });

  it("Download saves the transcript as <customer>-<assignment>-<date>.txt through the seam", async () => {
    await mayaCall();
    Object.assign(URL, { createObjectURL: vi.fn(() => "blob:test"), revokeObjectURL: vi.fn() });
    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push(this.download);
    });
    await open(voiceBarTranscript()!);
    await h.click(menuItem("Download transcript")!);
    await h.advance(100);
    expect(downloads).toHaveLength(1);
    expect(downloads[0]).toMatch(/^maya-chen-.+-\d{4}-\d{2}-\d{2}\.txt$/);
  });

  it("Email copy raises \"Transcript emailed to <address>\"", async () => {
    await mayaCall();
    await open(voiceBarTranscript()!);
    await h.click(menuItem("Email copy to customer")!);
    await h.advance(500);
    expect(menuText()).toContain("Transcript emailed to maya.chen@example.com");
  });

  it("Email copy is disabled with the reason when the customer has no email on file", async () => {
    await setUp({ displayLocation: "inline" });
    await h.goAvailable();
    const id = await h.startInbound("voice", "(646) 555-0188", "Zed Quinn");
    await h.accept(id);
    await h.advance(1_000);
    await h.click(h.navCard("Zed Quinn"));
    await open(voiceBarTranscript()!);
    const email = menuItem("Email copy to customer")!;
    expect(email.textContent).toContain("No email on file");
    const disabled = email.closest("[disabled], [aria-disabled=true]") ?? email.querySelector("[disabled], [aria-disabled=true]");
    expect(disabled).not.toBeNull();
    expect(menuItem("Download transcript")).toBeDefined();
  });

  it("a digital leg has the same menu on the Transcript tab's header, and nothing in the inline transcript container", async () => {
    await setUp({ displayLocation: "panel" });
    const id = await h.startInbound("chat", priya.emailAddress!, priya.name);
    await h.accept(id);
    await h.click(h.navCard(priya.name));
    await h.advance(300);
    if (panel().getAttribute("data-open") !== "true" || panel().getAttribute("data-thread") !== "details") await h.click(contactDetailsButton());
    await h.click([...panel().querySelectorAll<HTMLElement>("[role=tab]")].find((t) => t.textContent?.trim() === "Transcript")!);
    const header = panel().querySelector<HTMLElement>("[data-slot=transcript-tab-header]")!;
    expect(header).not.toBeNull();
    await open(header.querySelector<HTMLElement>('[aria-label="Transcript options"]')!);
    expect(menuText()).toContain("Download transcript");
    expect(menuText()).toContain("Email copy to customer");
    expect(h.container.querySelector("[data-main-thread] [data-slot=transcript-tab-header]")).toBeNull();
  });
});

describe("transcript menu with both capabilities off", () => {
  const off = createSimTranscriptExportProvider({ latency: { minMs: 0, maxMs: 0 } });
  const h2 = createWorkspaceHarness({ seed: SIM_DEMO_SEED, transcriptExport: { ...off, capabilities: { download: false, emailCopy: false } } });
  beforeEach(() => {
    localStorage.clear();
    resetSettingsStoreForTests();
    h2.setUp();
  });
  afterEach(async () => {
    await h2.tearDown();
  });

  it("the voice bar's Transcript button is hidden entirely", async () => {
    await act(async () => {
      const store = getSettingsStore();
      store.updateMany(profileValues("phase2"));
      store.update("channels", { voice: true, chat: true, email: true, sms: true, whatsapp: true });
      await vi.advanceTimersByTimeAsync(50);
    });
    await h2.show(AgentWorkspaceAdvancedPage);
    await h2.goAvailable();
    await h2.play(MAYA);
    await h2.advance(3_000);
    await h2.click(h2.navCard("Maya Chen"));
    expect(h2.container.querySelector("[data-slot=voice-bar]")).not.toBeNull();
    const transcriptButton = [...h2.container.querySelectorAll<HTMLElement>("[data-slot=voice-bar] button")].find(
      (b) => b.textContent?.trim() === "Transcript" || b.getAttribute("aria-label") === "Transcript",
    );
    expect(transcriptButton).toBeUndefined();
  });
});

describe("session-row kebab", () => {
  async function renderCluster(props: { transferInKebabMenu?: boolean }) {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(
        <SessionActionCluster
          {...({
            session: { id: "s1", status: "Open" },
            isClosed: false,
            showActionCluster: true,
            showKebabMenu: true,
            transferInKebabMenu: props.transferInKebabMenu,
          } as unknown as React.ComponentProps<typeof SessionActionCluster>)}
        />,
      );
    });
    return {
      host,
      kebab: () => host.querySelector<HTMLElement>('[aria-label="More Options"]'),
      unmount: async () => {
        await act(async () => root.unmount());
        host.remove();
      },
    };
  }

  it("holds Consult / Transfer only; Send Transcript, Download Transcript and Translate Messages are gone", async () => {
    const view = await renderCluster({ transferInKebabMenu: true });
    expect(view.kebab()).not.toBeNull();
    const trigger = (view.kebab()!.closest("button") ?? view.kebab()!) as HTMLElement;
    await act(async () => {
      for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
        trigger.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, button: 0 }));
      }
    });
    expect(document.body.textContent).toContain("Consult / Transfer");
    for (const gone of ["Send Transcript", "Download Transcript", "Translate Messages"]) expect(document.body.textContent).not.toContain(gone);
    await view.unmount();
  });

  it("renders no kebab when the menu would be empty (Consult / Transfer shown as its own button)", async () => {
    const view = await renderCluster({ transferInKebabMenu: false });
    expect(view.kebab()).toBeNull();
    await view.unmount();
  });
});
