// @vitest-environment jsdom
// The sim is the default provider in every build (no `?provider=`), and its
// scenario hotkeys (a/b/c/l) come with it, in dev and in production — no URL
// flag. `?provider=<other>` selects another provider, without them.
// `__simCustomer` stays a dev-only global.
import { afterEach, describe, expect, it, vi } from "vitest";
import { PLACEHOLDER_DATABASE } from "../../data/database-handle";
import { PLACEHOLDER_PROFILE } from "../../profiles/contact-center-profile";
import { PROVIDER_FACTORIES } from "../../provider-context/factories";
import { readProviderKind } from "../../provider-context/provider-kind";
import type { AssistEvents, ProviderSet } from "../../providers";
import { simCopilotAnswer } from "./sim-copilot-answers";

let set: ProviderSet | undefined;

afterEach(async () => {
  await set?.interaction.dispose();
  set = undefined;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});

/** Boots at `url` the way main.tsx does (the provider from the URL), in a dev or production build. */
function boot(url: string, build: "dev" | "prod") {
  if (build === "prod") {
    vi.stubEnv("DEV", false);
    vi.stubEnv("PROD", true);
  }
  window.history.replaceState(null, "", url);
  const add = vi.spyOn(window, "addEventListener");
  const kind = readProviderKind(window.location.search);
  set = PROVIDER_FACTORIES[kind]({ profile: PLACEHOLDER_PROFILE, database: PLACEHOLDER_DATABASE, simLatency: "off" });
  return { kind, hotkeys: add.mock.calls.filter(([type]) => type === "keydown").length };
}

describe("the sim is the default provider, and its scenario hotkeys come with it", () => {
  for (const build of ["dev", "prod"] as const) {
    it(`${build}: no ?provider= → the sim, hotkeys registered`, () => {
      expect(boot("/#/agent-advanced", build)).toEqual({ kind: "sim", hotkeys: 1 });
      expect(import.meta.env.DEV).toBe(build === "dev");
      // The devtools handle only on the dev server.
      expect(window.__simCustomer !== undefined).toBe(build === "dev");
    });

    it(`${build}: ?provider=sim → the same`, () => {
      expect(boot("/?provider=sim#/agent-advanced", build)).toEqual({ kind: "sim", hotkeys: 1 });
    });

    it(`${build}: ?provider=<other> → that provider, no hotkeys`, () => {
      expect(boot("/?provider=twilio#/agent-advanced", build)).toEqual({ kind: "twilio", hotkeys: 0 });
      expect(boot("/?provider=cxone#/agent-advanced", build)).toEqual({ kind: "cxone", hotkeys: 0 });
    });
  }

  it("disposing the sim's set removes them", async () => {
    boot("/#/agent-advanced", "prod");
    const remove = vi.spyOn(window, "removeEventListener");
    await set!.interaction.dispose();
    set = undefined;
    expect(remove.mock.calls.filter(([type]) => type === "keydown")).toHaveLength(1);
  });
});

describe("Ask Copilot through the assist provider (P-LAYOUT-F2 5b)", () => {
  it("the sim answers an ask with an answer card: the question as asked and its placeholder answer", async () => {
    boot("/#/agent-advanced", "dev");
    const cards: AssistEvents["card"][] = [];
    set!.assist.on("card", (event) => cards.push(event));
    const id = window.__simCustomer!.startInbound({ channel: "chat", address: "ask@example.com", displayName: "Ask Test" });
    await vi.waitFor(async () => expect((await set!.interaction.getSnapshot()).interactions.some((i) => i.id === id)).toBe(true));
    await set!.assist.suggest({ interactionId: id, trigger: { kind: "ask", text: "Draft a reply" } });
    await vi.waitFor(() => expect(cards.some((c) => c.card.kind === "answer")).toBe(true));
    const answer = cards.find((c) => c.card.kind === "answer")!;
    expect(answer.interactionId).toBe(id);
    expect(answer.card).toMatchObject({ kind: "answer", question: "Draft a reply", answer: simCopilotAnswer("Draft a reply"), status: "complete" });
  });
});
