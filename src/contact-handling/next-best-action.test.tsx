// @vitest-environment jsdom
// P-CANVAS: the Next Best Action is inline and on demand — a row in the
// conversation (every AI display) that surfaces on the agent's turn (a new
// assignment's greeting at once, a scripted agent line), on a pause (no
// customer or agent turn for Settings → AI's pause) or the agent's request
// ("What should I do next?"), never while a bot holds the chat. Using it or
// putting it aside replaces it with a compact Used/Dismissed row. An
// unscripted call's caller answers with canned lines. Chips run or fill
// (Settings → AI). A call's Hide Transcript. Plus the reference column's
// cards: any number open, the AI focusing, the Journey Summary always
// resolving, and Customer Info's identity block.
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CREATE_NEW_CUSTOMERS } from "@nicecxone/lyra-ui/customers-data";
import { SIM_DEMO_SEED } from "@/adapters/sim/sim-fixtures";
import { createWorkspaceHarness } from "@/test-utils/workspace-harness";
import { AgentWorkspaceAdvancedPage } from "@/components/AgentWorkspaceAdvancedPage";
import { DEFAULT_CANVAS_CELLS } from "@/components/workspace/canvas-cells";
import { LUCAS_THOMAS_SCRIPT } from "@/scenarios/scripts/lucas-thomas";
import { MAYA_CHEN_SCRIPT } from "@/scenarios/scripts/maya-chen";
import { MARCUS_WEBB_SCRIPT } from "@/scenarios/scripts/marcus-webb";
import { profileValues } from "@/settings/profiles";
import { getSettingsStore, resetSettingsStoreForTests } from "@/settings/settings-store";
import type { AiSettings } from "@/settings/settings-schema";
import { canvasCellDefinition, resetCanvasRegistry } from "./canvas-registry";
import { simVoiceCustomerLines } from "@/adapters/sim/sim-auto-replies";
import { NBA_CHIP } from "./next-best-action";

const h = createWorkspaceHarness({ seed: SIM_DEMO_SEED });
const priya = CREATE_NEW_CUSTOMERS.find((c) => c.id === "priya-shah-history")!;

beforeEach(() => {
  localStorage.clear();
  resetSettingsStoreForTests();
  resetCanvasRegistry();
  h.setUp();
});
afterEach(async () => {
  resetCanvasRegistry();
  await h.tearDown();
});

async function open(ai: Partial<AiSettings>) {
  await act(async () => {
    getSettingsStore().updateMany(profileValues("phase2"));
    getSettingsStore().update("ai", ai);
    await vi.advanceTimersByTimeAsync(50);
  });
  await h.show(AgentWorkspaceAdvancedPage);
  await h.goAvailable();
  await h.advance(500);
}

async function maya() {
  await h.play(MAYA_CHEN_SCRIPT.id);
  await h.click(h.navCard("Maya Chen"));
  await h.advance(300);
}

async function priyaChat() {
  const id = await h.startInbound("chat", priya.emailAddress!, priya.name);
  await h.accept(id);
  await h.click(h.navCard(priya.name));
  await h.advance(300);
}

const main = () => h.container.querySelector<HTMLElement>("[data-main-thread]")!;
const nba = () => h.container.querySelector<HTMLElement>("[data-slot=next-best-action]");
const frame = () => nba()?.getAttribute("data-frame");
const button = (label: string, scope: Element | null = nba()) =>
  [...(scope?.querySelectorAll<HTMLElement>("button") ?? [])].find((b) => b.textContent?.trim() === label);
const outcomes = () => [...h.container.querySelectorAll<HTMLElement>("[data-slot=nba-outcome]")].map((r) => `${r.dataset.outcome}: ${r.textContent}`);
const chip = () => document.body.querySelector<HTMLElement>("[data-slot=copilot-chip-pinned]");

async function sendChat(text: string) {
  const input = main().querySelector<HTMLTextAreaElement>('textarea[placeholder^="Type a message"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await vi.advanceTimersByTimeAsync(10);
  });
  await h.click(button("Send", main())!);
}

describe("the registry", () => {
  it("has no Next Best Action cell, and exactly the three reference cells for a conversation (the kind cell has its own)", () => {
    expect(canvasCellDefinition("next-best-action")).toBeUndefined();
    expect(canvasCellDefinition("autosummary")).toBeUndefined();
    const reference = (context: "conversation" | "kind") =>
      DEFAULT_CANVAS_CELLS.filter((c) => c.region === "reference" && (c.context ?? "conversation") === context)
        .sort((a, b) => a.order - b.order)
        .map((c) => c.id);
    expect(reference("conversation")).toEqual(["real-time-summary", "journey-summary", "customer-info"]);
    expect(reference("kind")).toEqual(["kind-summary", "kind-related", "kind-journey", "kind-customer"]);
  });
});

/** The beat between reaching the agent's turn and its suggestion (Settings → AI's default), plus a margin. */
const BEAT_MS = 900 + 100;
const UNKNOWN = "(161) 474-9179";

/** An outbound call to an unknown number, its card selected. The harness rings for 0ms, so the far end answers at
 *  once (that nothing surfaces while a call rings is sim-guidance.test.ts's). */
async function dialUnknown() {
  await act(async () => {
    const dialed = h.provider.dial({ channel: "voice", address: UNKNOWN, skillId: "general" });
    await vi.advanceTimersByTimeAsync(50);
    await dialed;
  });
  await h.click(h.navCard(UNKNOWN));
}

/** The caller's canned lines in the call's transcript, in order. */
const callerLines = () => simVoiceCustomerLines("general").filter((line) => main().textContent?.includes(line));

describe("the Next Best Action: the greeting on connect, then on a pause or on request", () => {
  for (const displayLocation of ["inline", "main", "panel"] as const) {
    it(`AI display ${displayLocation}: an inbound chat's greeting surfaces at once on connect (the beat, no pause), as a row in the conversation`, async () => {
      await open({ displayLocation });
      await priyaChat();
      await h.advance(BEAT_MS);
      expect(frame()).toBe("say");
      expect(nba()!.textContent).toContain("Greet Priya and say the chat is recorded");
      // In the conversation (inline) or the AI feed ("main": the main column; panel: Contact Details), not a canvas cell.
      expect(nba()!.closest(displayLocation === "panel" ? "[data-slot=right-panel] [data-slot=ai-feed]" : "[data-main-thread]")).not.toBeNull();
      expect(nba()!.closest("[data-canvas-cell]")).toBeNull();
    });
  }

  it("a dialed outbound: answered → the greeting within the beat (not before it); Said it", async () => {
    await open({ displayLocation: "inline" });
    await dialUnknown();
    expect(nba()).toBeNull();
    await h.advance(BEAT_MS);
    expect(frame()).toBe("say");
    expect(nba()!.textContent).toContain("Greet the customer and say the call is recorded");
    expect(button("Said it")).toBeDefined();
  });

  it("after the greeting, a turn before the pause resets the timer; then the reason surfaces", async () => {
    await open({ displayLocation: "inline" });
    await priyaChat();
    await h.advance(BEAT_MS);
    await h.click(button("Not now")!);
    await h.advance(4_000);
    // The agent's line (and the customer's reply 2.5s later) are turns.
    await sendChat("Hi Priya, one moment please.");
    await h.advance(5_000);
    expect(nba()).toBeNull();
    await h.advance(5_000);
    expect(frame()).toBe("ask");
  });

  it("the pause is a setting (voice: 8s by default; here 4s)", async () => {
    await open({ displayLocation: "inline", nbaPauseVoiceMs: 4000 });
    await dialUnknown();
    await h.advance(BEAT_MS);
    await h.click(button("Said it")!);
    // The caller's reply (1.5–3s) is a turn; the reason surfaces a pause (4s) after it: 5.5–7s from Said it.
    await h.advance(3_000);
    expect(callerLines()).toHaveLength(1);
    await h.advance(2_000);
    expect(nba()).toBeNull();
    await h.advance(2_100);
    expect(frame()).toBe("ask");
    expect(button("Said it")).toBeDefined();
  });

  it("the chip surfaces it at once; asked again with nothing queued, it still answers (the generic check, P-HOME-1j)", async () => {
    await open({ displayLocation: "inline" });
    await priyaChat();
    expect(chip()?.textContent).toContain(NBA_CHIP);
    // The greeting is already showing (on connect); the chip asks before the beat ends.
    await h.click(chip()!);
    await h.advance(50);
    expect(frame()).toBe("say");
    // Not now: a Dismissed row in its place; the reason is next, on request.
    await h.click(button("Not now")!);
    await h.advance(50);
    expect(nba()).toBeNull();
    expect(outcomes()).toEqual([expect.stringMatching(/^dismissed: Dismissed at .* — Greet Priya/)]);
    // The chip's spinner (1.4s) ends before it can be used again.
    await h.advance(1_500);
    await h.click(chip()!);
    await h.advance(50);
    expect(frame()).toBe("ask");
    await h.click(button("Not now")!);
    await h.advance(1_500);
    await h.click(chip()!);
    await h.advance(50);
    expect(frame()).toBe("ask");
    expect(nba()!.textContent).toContain("Check whether Priya needs anything else");
  });

  it("every default chip on a seeded contact with no script (Ethan's SMS) answers: a row and its result for each; the Next Best Action chip every time it's asked", async () => {
    await open({ displayLocation: "inline" });
    await h.click(h.navCard("Ethan Zhang"));
    await h.advance(500);
    const composer = () => document.body.querySelector<HTMLElement>("[data-slot=copilot-composer]")!;
    const result = () => document.querySelector<HTMLElement>("[data-slot=copilot-result]");
    const rowFor = (text: string) =>
      [...h.container.querySelectorAll<HTMLElement>("button")].find((b) => b.textContent?.startsWith(text) && b.textContent.includes("John Smith"));
    for (const text of ["Suggest a reply", "Summarize this conversation", "What is the customer's history?"]) {
      const chipButton = () =>
        [...composer().querySelectorAll<HTMLElement>("[data-slot=copilot-chips] [role=button]")].find((c) => c.textContent?.trim() === text);
      if (!chipButton()) await h.click(composer().querySelector("[data-slot=copilot-chips-refresh] button")!);
      await h.click(chipButton()!);
      await h.advance(100);
      expect(main().textContent).toContain("AI agent is performing this now…");
      // Once Copilot "finishes": the row, and its result open by itself.
      await h.advance(2_000);
      expect(rowFor(text), text).toBeTruthy();
      expect(result()?.textContent, text).toContain(text);
      expect(rowFor(text)!.getAttribute("aria-current")).toBe("true");
    }
    // What should I do next?: the greeting, the reason, then the generic check — never nothing.
    for (const title of ["Greet Ethan", "Ask what Ethan is contacting us about", "Check whether Ethan needs anything else"]) {
      await h.click(chip()!);
      await h.advance(50);
      expect(nba()?.textContent, title).toContain(title);
      await h.click(button("Not now")!);
      await h.advance(1_500);
    }
  });

  it("asking Copilot what to do next surfaces it too", async () => {
    await open({ displayLocation: "inline" });
    await priyaChat();
    const composer = document.body.querySelector<HTMLElement>("[data-slot=copilot-composer]")!;
    const input = composer.querySelector<HTMLTextAreaElement>("textarea")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(input, "What should I do next?");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await vi.advanceTimersByTimeAsync(10);
    });
    await h.click(composer.querySelector('button[aria-label="Submit"]')!);
    await h.advance(50);
    expect(frame()).toBe("say");
  });

  it("Insert into reply fills the chat composer and leaves a Used row", async () => {
    await open({ displayLocation: "inline" });
    await priyaChat();
    await h.click(chip()!);
    await h.advance(50);
    const text = nba()!.querySelector("[role=note]")!.textContent!;
    await h.click(button("Insert into reply")!);
    await h.advance(300);
    const textarea = [...main().querySelectorAll<HTMLTextAreaElement>("textarea")].find((el) => el.value);
    expect(textarea?.value).toBe(text);
    expect(nba()).toBeNull();
    expect(outcomes()).toEqual([expect.stringMatching(/^used: Used at .* — Greet Priya/)]);
  });

  it("Hide AI Actions hides its row like the other AI rows", async () => {
    await open({ displayLocation: "inline" });
    await priyaChat();
    await h.click(chip()!);
    await h.advance(50);
    expect(nba()!.closest("[aria-hidden=true]")).toBeNull();
    const label = [...document.body.querySelectorAll<HTMLElement>("label")].find((l) => l.textContent?.trim() === "Hide AI Actions")!;
    const toggle = label.querySelector<HTMLElement>("[role=switch], button") ?? label.parentElement!.querySelector<HTMLElement>("[role=switch], button")!;
    await h.click(toggle);
    expect(nba()!.closest("[aria-hidden=true]")).not.toBeNull();
  });

  it("while the bot holds the chat (Lucas before takeover), nothing surfaces, on a pause or on request; after takeover the greeting does at once", async () => {
    await open({ displayLocation: "inline" });
    await h.play(LUCAS_THOMAS_SCRIPT.id);
    await h.click(h.navCard("Lucas Thomas"));
    await h.advance(20_000);
    expect(nba()).toBeNull();
    if (chip()) {
      await h.click(chip()!);
      await h.advance(50);
    }
    expect(nba()).toBeNull();
    await h.click(button("Takeover Chat", document.body)!);
    // The bot's handoff, then John's greeting is the agent's turn: its suggestion after the beat.
    await h.advance(2_000);
    expect(frame()).toBe("say");
    expect(nba()!.textContent).toContain("Greet Lucas");
  });
});

describe("an unscripted call's caller answers with canned lines", () => {
  it("each answered suggestion gets the next line from the skill's pool (1.5–3s), and so does a pause with nothing queued; once the pool is used up the caller goes quiet", async () => {
    // A 4s pause, so each line (1.5–3s) lands before the pause it restarts.
    await open({ displayLocation: "inline", nbaPauseVoiceMs: 4000 });
    await dialUnknown();
    await h.advance(BEAT_MS);
    // Said it on the greeting: the first line, not before 1.5s, by 3s.
    await h.click(button("Said it")!);
    await h.advance(1_400);
    expect(callerLines()).toHaveLength(0);
    await h.advance(1_600);
    expect(callerLines()).toEqual(simVoiceCustomerLines("general").slice(0, 1));
    // The reason a pause after that line; Not now answers it too.
    await h.advance(4_100);
    expect(frame()).toBe("ask");
    await h.click(button("Not now")!);
    await h.advance(3_000);
    expect(callerLines()).toHaveLength(2);
    // Nothing queued now: each pause (4s) is the caller's next line (1.5–3s later), until the pool runs out.
    await h.advance(16_000);
    expect(callerLines()).toEqual([...simVoiceCustomerLines("general")]);
    await h.advance(30_000);
    expect(callerLines()).toHaveLength(simVoiceCustomerLines("general").length);
    expect(nba()).toBeNull();
  });
});

describe("Settings → AI: chip behaviour", () => {
  const firstChip = () => document.body.querySelector<HTMLElement>("[data-slot=copilot-chips] [role=button]")!;
  const askInput = () => document.body.querySelector<HTMLTextAreaElement>("[data-slot=copilot-composer] textarea")!;
  const resultRow = (text: string) =>
    [...main().querySelectorAll<HTMLElement>("button")].find((b) => b.textContent?.startsWith(text) && b.textContent.includes("John Smith"));

  it("run (the default): a chip posts its question on the click, with no send", async () => {
    expect(getSettingsStore().getState().values.ai.chipBehavior).toBe("run");
    await open({ displayLocation: "inline" });
    await priyaChat();
    const text = firstChip().textContent!.trim();
    await h.click(firstChip());
    await h.advance(2_500);
    expect(resultRow(text)).toBeDefined();
    expect(askInput().value).toBe("");
  });

  it("fill: a chip fills the Ask Copilot input and doesn't post", async () => {
    await open({ displayLocation: "inline", chipBehavior: "fill" });
    await priyaChat();
    const text = firstChip().textContent!.trim();
    await h.click(firstChip());
    await h.advance(2_500);
    expect(askInput().value).toBe(text);
    expect(resultRow(text)).toBeUndefined();
  });

  it("run: the Next Best Action chip surfaces it at once in panel mode too", async () => {
    await open({ displayLocation: "panel" });
    await priyaChat();
    await h.advance(BEAT_MS);
    await h.click(button("Not now")!);
    await h.advance(50);
    await h.click(chip()!);
    await h.advance(50);
    expect(frame()).toBe("ask");
  });
});

describe("Hide Transcript (a call under AI display inline)", () => {
  const toggle = (label: string) => {
    const el = [...document.body.querySelectorAll<HTMLElement>("label")].find((l) => l.textContent?.trim() === label);
    return el && (el.querySelector<HTMLElement>("[role=switch], button") ?? el.parentElement!.querySelector<HTMLElement>("[role=switch], button")!);
  };
  // Contact Details is the reference slide-over (P-HOME-1n).
  const contactDetailsTabs = () =>
    [...document.body.querySelectorAll("[data-slot=reference-slide-over] [data-slot=contact-details-tabs] [role=tab]")].map((t) => t.textContent?.trim());
  async function showContactDetails() {
    if (document.body.querySelector("[data-slot=reference-slide-over] [data-slot=contact-details-tabs]")) return;
    await h.click(document.body.querySelector<HTMLElement>("button[data-contact-details]")!);
    await h.advance(100);
  }

  it("on: the utterances leave the main column and only the AI rows stay; the Transcript tab appears; off restores both; kept per card", async () => {
    await open({ displayLocation: "inline" });
    await dialUnknown();
    await h.advance(BEAT_MS);
    await h.click(button("Said it")!);
    await h.advance(3_000);
    expect(callerLines()).toHaveLength(1);
    await showContactDetails();
    expect(contactDetailsTabs()).not.toContain("Transcript");

    await h.click(toggle("Hide Transcript")!);
    expect(callerLines()).toHaveLength(0);
    expect(outcomes()).toEqual([expect.stringMatching(/^used: Used at .* — Greet the customer/)]);
    expect(contactDetailsTabs()).toContain("Transcript");

    // Another card and back: still hidden. A chat has no toggle.
    await priyaChat();
    expect(toggle("Hide Transcript")).toBeUndefined();
    await h.click(h.navCard(UNKNOWN));
    await h.advance(300);
    expect(callerLines()).toHaveLength(0);
    expect(toggle("Hide Transcript")!.getAttribute("aria-checked") ?? toggle("Hide Transcript")!.getAttribute("data-state")).toMatch(/true|checked/);

    await h.click(toggle("Hide Transcript")!);
    expect(callerLines()).toHaveLength(1);
    await showContactDetails();
    expect(contactDetailsTabs()).not.toContain("Transcript");
  });

  for (const displayLocation of ["main", "panel"] as const) {
    it(`no toggle under AI display ${displayLocation}`, async () => {
      await open({ displayLocation });
      await dialUnknown();
      await h.advance(BEAT_MS);
      expect(toggle("Hide Transcript")).toBeUndefined();
    });
  }
});

describe("scripted cases: the Next Best Action gates the agent's turn", () => {
  const step = (id: string) => MAYA_CHEN_SCRIPT.steps.find((s) => s.id === id)! as { text: string; nba?: { text?: string } };
  const has = (text: string) => main().textContent!.includes(text);

  it("Maya: about 1s after her first line the suggestion shows and John hasn't spoken; Said it plays the script's line, not the suggestion; her next line follows; then the Ask", async () => {
    await open({ displayLocation: "inline" });
    await maya();
    // Her first line at 1.2s; John's turn at 1.4s; its suggestion 0.9s later.
    await h.advance(1_500);
    expect(nba()).toBeNull();
    await h.advance(1_000);
    expect(frame()).toBe("say");
    expect(has(step("mcc-2").text)).toBe(false);
    expect(button("Said it")).toBeDefined();
    // Nothing plays while it waits.
    await h.advance(10_000);
    expect(has(step("mcc-3").text)).toBe(false);
    await h.click(button("Said it")!);
    await h.advance(100);
    expect(has(step("mcc-2").text)).toBe(true);
    expect(has(step("mcc-2").nba!.text!)).toBe(false);
    await h.advance(3_700);
    expect(has(step("mcc-3").text)).toBe(true);
    // The Ask: her line, then John's turn waits again.
    await h.advance(1_300);
    expect(frame()).toBe("ask");
    expect(has(step("mcc-ask").text)).toBe(false);
    await h.click(button("Said it")!);
    await h.advance(100);
    expect(has(step("mcc-ask").text)).toBe(true);
  });

  it("Not now plays the scripted line after the beat; her next line still follows", async () => {
    await open({ displayLocation: "inline" });
    await maya();
    await h.advance(2_500);
    await h.click(button("Not now")!);
    await h.advance(500);
    expect(has(step("mcc-2").text)).toBe(false);
    await h.advance(500);
    expect(has(step("mcc-2").text)).toBe(true);
    await h.advance(3_700);
    expect(has(step("mcc-3").text)).toBe(true);
  });

  it("the Do: Run it runs its branch (the refund) and opens its panel, then John's line plays", async () => {
    await open({ displayLocation: "inline" });
    await maya();
    for (const id of ["mcc-2", "mcc-ask"]) {
      await h.advance(5_000);
      expect(nba()).not.toBeNull();
      await h.click(button("Said it")!);
      await h.advance(100);
      expect(has(step(id).text)).toBe(true);
    }
    await h.advance(5_000);
    expect(frame()).toBe("do");
    await h.click(button("Run it")!);
    await h.advance(600);
    expect(h.container.querySelector("[data-slot=reference-slide-over]")).not.toBeNull();
    expect(has(step("mcc-do").text)).toBe(true);
    expect(h.container.textContent).toContain("Refund of $412.00 to Visa 4417 issued");
  });

  it("a chat (Lucas after takeover): Insert into reply, then send — the sent text is the turn, the script's line never plays, and his reply follows", async () => {
    await open({ displayLocation: "inline" });
    await h.play(LUCAS_THOMAS_SCRIPT.id);
    await h.click(h.navCard("Lucas Thomas"));
    await h.advance(14_000);
    await h.click(button("Takeover Chat", document.body)!);
    await h.advance(2_000);
    expect(frame()).toBe("say");
    const greeting = LUCAS_THOMAS_SCRIPT.steps.find((s) => s.id === "lt-greet") as { text: string; nba: { text: string } };
    await h.click(button("Insert into reply")!);
    await h.advance(300);
    const input = [...main().querySelectorAll<HTMLTextAreaElement>("textarea")].find((el) => el.value)!;
    expect(input.value).toBe(greeting.nba.text);
    // Not sent yet: the script waits.
    await h.advance(5_000);
    expect(has("Ok, sounds good")).toBe(false);
    await h.click(button("Send", main())!);
    await h.advance(100);
    expect(has(greeting.nba.text)).toBe(true);
    expect(has(greeting.text)).toBe(false);
    await h.advance(3_000);
    expect(has("Ok, sounds good")).toBe(true);
    expect(has(greeting.text)).toBe(false);
  });

  it("Marcus Webb's decision is a Next Best Action in his transcript while the bot holds the call; a rejection's reason reaches the Used row (P-SHRINK)", async () => {
    await open({ displayLocation: "inline" });
    await h.play(MARCUS_WEBB_SCRIPT.id);
    await h.click(h.navCard("Marcus Webb"));
    await h.advance(6000);
    expect(h.container.querySelector("[data-canvas-cell=marcus-card]")).toBeNull();
    expect(main().textContent).toContain("Approval request");
    expect(nba()?.getAttribute("data-frame")).toBe("do");
    expect(nba()!.textContent).toContain("Approve the refund");
    const reject = [...nba()!.querySelectorAll("li")].find((li) => li.textContent?.includes("Reject the refund"))!;
    await h.click([...reject.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Use")!);
    const field = nba()!.querySelector("[data-slot=nba-alternative-note]")!;
    const reason = field.querySelector("textarea")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(reason, "Needs photos first");
      reason.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await h.click([...field.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Run it")!);
    await h.advance(2000);
    expect(outcomes()).toEqual([expect.stringMatching(/^used: Used at .* — Reject the refund · reason: Needs photos first$/)]);
    expect(main().textContent).toContain("Refund rejected");
  });

  it("the hook trims the typed note: padding is dropped from the Used row", async () => {
    await open({ displayLocation: "inline" });
    await h.play(MARCUS_WEBB_SCRIPT.id);
    await h.click(h.navCard("Marcus Webb"));
    await h.advance(6000);
    const reject = [...nba()!.querySelectorAll("li")].find((li) => li.textContent?.includes("Reject the refund"))!;
    await h.click([...reject.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Use")!);
    const field = nba()!.querySelector("[data-slot=nba-alternative-note]")!;
    const reason = field.querySelector("textarea")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(reason, " Needs photos first ");
      reason.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await h.click([...field.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Run it")!);
    await h.advance(2000);
    expect(outcomes()).toEqual([expect.stringMatching(/^used: Used at .* — Reject the refund · reason: Needs photos first$/)]);
  });

  it.each(["", "  "])("an optional note left blank (%j) leaves no label fragment in the Used row (P-SHRINK follow-up)", async (blank) => {
    // Make Marcus's rejection reason optional for this case, restoring it after.
    const reasons: { required?: boolean }[] = [];
    const walk = (node: unknown) => {
      if (!node || typeof node !== "object") return;
      const note = (node as { note?: { label?: string; required?: boolean } }).note;
      if (note?.label === "Reason") reasons.push(note);
      Object.values(node).forEach(walk);
    };
    walk(MARCUS_WEBB_SCRIPT);
    expect(reasons.length).toBeGreaterThan(0);
    const before = reasons.map((n) => n.required);
    reasons.forEach((n) => (n.required = false));
    try {
      await open({ displayLocation: "inline" });
      await h.play(MARCUS_WEBB_SCRIPT.id);
      await h.click(h.navCard("Marcus Webb"));
      await h.advance(6000);
      const reject = [...nba()!.querySelectorAll("li")].find((li) => li.textContent?.includes("Reject the refund"))!;
      await h.click([...reject.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Use")!);
      const field = nba()!.querySelector("[data-slot=nba-alternative-note]")!;
      const reason = field.querySelector("textarea")!;
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(reason, blank);
        reason.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await h.click([...field.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Run it")!);
      await h.advance(2000);
      expect(outcomes()).toEqual([expect.stringMatching(/^used: Used at .* — Reject the refund$/)]);
    } finally {
      reasons.forEach((n, i) => (n.required = before[i]));
    }
  });
});

describe("the reference column", () => {
  const expanded = () =>
    ["real-time-summary", "journey-summary", "customer-info-card"].filter(
      (slot) => h.container.querySelector(`[data-slot=${slot}] [aria-expanded]`)?.getAttribute("aria-expanded") === "true",
    );
  const header = (slot: string) => h.container.querySelector<HTMLElement>(`[data-slot=${slot}] [aria-expanded]`)!;
  const highlighted = () => [...h.container.querySelectorAll("[data-highlighted] [data-slot]")].map((el) => el.getAttribute("data-slot"));

  it("any number open: every card collapsed at first (P-HOME-1g); manual opens add, closes remove", async () => {
    await open({ displayLocation: "inline" });
    await maya();
    expect(expanded()).toEqual([]);
    await h.click(header("real-time-summary"));
    await h.click(header("journey-summary"));
    expect(expanded()).toEqual(["real-time-summary", "journey-summary"]);
    await h.click(header("customer-info-card"));
    expect(expanded()).toEqual(["real-time-summary", "journey-summary", "customer-info-card"]);
    await h.click(header("real-time-summary"));
    expect(expanded()).toEqual(["journey-summary", "customer-info-card"]);
  });

  it("what the agent opened stays open per assignment: away to another and back, it's still open; the other starts collapsed", async () => {
    await open({ displayLocation: "inline" });
    await maya();
    await h.click(header("real-time-summary"));
    expect(expanded()).toEqual(["real-time-summary"]);
    // (Noah's journey lookup brings his Journey Summary forward: the AI's open, not the agent's.)
    await h.click(h.navCard("Noah Patel"));
    expect(expanded()).not.toContain("real-time-summary");
    await h.click(h.navCard("Maya Chen"));
    expect(expanded()).toContain("real-time-summary");
  });

  /** Answers John's waiting turn (Said it), once its suggestion shows. */
  const sayIt = async () => {
    await h.advance(2_500);
    await h.click([...h.container.querySelectorAll<HTMLElement>("[data-slot=next-best-action] button")].find((b) => b.textContent?.trim() === "Said it")!);
    await h.advance(100);
  };

  it("Maya's card-on-file turn expands Customer Info (highlighted), collapsing the AI-opened summary, not the agent's Journey Summary", async () => {
    await open({ displayLocation: "inline" });
    await maya();
    await h.click(header("journey-summary"));
    await sayIt();
    // Her card-on-file line, 3.6s after John's.
    await h.advance(3_700);
    expect(expanded()).toEqual(["journey-summary", "customer-info-card"]);
    expect(highlighted()).toContain("customer-info-card");
    await h.advance(1_500);
    expect(highlighted()).toEqual([]);
  });

  it("a summary refresh never takes focus", async () => {
    await open({ displayLocation: "inline" });
    await maya();
    await sayIt();
    await h.advance(3_700);
    expect(expanded()).toEqual(["customer-info-card"]);
    const words = () => h.container.querySelector("[data-slot=real-time-summary]")!.getAttribute("data-words");
    const before = words();
    // John's Ask, then her answer (a customer turn) refreshes the summary.
    await sayIt();
    await h.advance(3_500);
    expect(words()).not.toBe(before);
    expect(expanded()).toEqual(["customer-info-card"]);
  });

  it("a known customer's sim contact: the journey lookup brings the Journey Summary forward", async () => {
    await open({ displayLocation: "main" });
    await act(async () => {
      const dialed = h.provider.dial({ channel: "whatsapp", address: "(200) 200-1000", skillId: "general", entityId: "customer-1" as never, contactName: "Alex Miller" });
      await vi.advanceTimersByTimeAsync(300);
      await dialed;
    });
    await h.click(h.navCard("Alex Miller"));
    expect(expanded()).toEqual([]);
    await h.advance(1_000);
    expect(expanded()).toEqual(["journey-summary"]);
  });

  const journeyFrame = () => h.container.querySelector("[data-slot=journey-summary]")?.getAttribute("data-frame");
  const CASES = {
    maya,
    lucas: async () => {
      await h.play(LUCAS_THOMAS_SCRIPT.id);
      await h.click(h.navCard("Lucas Thomas"));
    },
    tom: async () => {
      await h.play("tom-lewis-void-call");
      await h.click(h.navCard("Tom Lewis"));
    },
    noah: async () => h.click(h.navCard("Noah Patel")),
    simChat: priyaChat,
    dialed: async () => {
      await act(async () => {
        const dialed = h.provider.dial({ channel: "voice", address: "(161) 474-9179", skillId: "general" });
        await vi.advanceTimersByTimeAsync(500);
        await dialed;
      });
      await h.click(h.navCard("(161) 474-9179"));
    },
  };
  for (const [name, run] of Object.entries(CASES)) {
    it(`${name}: the Journey Summary looks up, then resolves after 800ms`, async () => {
      await open({ displayLocation: "inline" });
      await run();
      await h.advance(1_000);
      expect(journeyFrame()).not.toBe("looking-up");
      expect(["found", "none"]).toContain(journeyFrame());
      if (name === "maya" || name === "lucas" || name === "tom") expect(journeyFrame()).toBe("found");
    });
  }

  it("Customer Info is the identity block: avatar, name, subline and chips from the record, no narrative", async () => {
    await open({ displayLocation: "inline" });
    await maya();
    await h.click(header("customer-info-card"));
    const card = h.container.querySelector<HTMLElement>("[data-slot=customer-info-card]")!;
    const overview = MAYA_CHEN_SCRIPT.content.overview!;
    expect(card.querySelector("[data-slot=customer-identity]")!.textContent).toContain("Maya Chen");
    expect(card.querySelector("[data-slot=customer-identity]")!.textContent).toContain(overview.subtitle);
    // lyra's conversational story: the subline at lyra-body-md, the block a gap-3 column.
    expect(card.querySelector("[data-slot=customer-subline]")!.className).toContain("lyra-body-md");
    expect(card.querySelector("[data-slot=customer-block]")!.className).toContain("gap-3");
    const chips = [...card.querySelectorAll("[data-slot=customer-chips] > *")].map((el) => el.textContent?.trim());
    expect(chips).toEqual([expect.stringContaining("Disappointed"), ...overview.tags]);
    expect(card.textContent).toContain("View customer info");
    for (const paragraph of overview.detailedSummary) expect(card.textContent).not.toContain(paragraph.slice(0, 40));
  });
});
