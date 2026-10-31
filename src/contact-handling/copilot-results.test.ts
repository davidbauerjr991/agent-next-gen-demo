// P-LAYOUT-F1 F: one decider for how a Copilot answer shows — a plain line, or a card (row, result card, slide-over).
import { afterEach, describe, expect, it } from "vitest";
import { copilotResultFor, registerCopilotResult, resetCopilotResults, resultPresentation, type CopilotResult } from "./copilot-results";

const plain: CopilotResult = {
  summary: "Here is what Copilot found in this contact.",
  points: ["The customer's request and its current status.", "Anything still open before you wrap up."],
};

describe("resultPresentation", () => {
  it("plain: one paragraph, at most three bullets, no actions, artifact or headings — a line", () => {
    expect(resultPresentation(plain)).toBe("line");
    expect(resultPresentation({ ...plain, points: ["a", "b", "c"] })).toBe("line");
  });

  it("has an action — a card", () => {
    expect(resultPresentation({ ...plain, actions: [{ label: "Insert in reply" }] })).toBe("card");
  });

  it("has an artifact — a card", () => {
    expect(resultPresentation({ ...plain, artifact: { kind: "panel" } })).toBe("card");
  });

  it("too long: a second paragraph, a fourth bullet, or a heading — a card", () => {
    expect(resultPresentation({ ...plain, summary: "First paragraph.\n\nSecond paragraph." })).toBe("card");
    expect(resultPresentation({ ...plain, points: ["a", "b", "c", "d"] })).toBe("card");
    expect(resultPresentation({ ...plain, headings: ["Details"] })).toBe("card");
  });
});

describe("copilotResultFor", () => {
  afterEach(() => resetCopilotResults());

  it("a registered result comes first (any case, trimmed), then the fallback, then the placeholder", () => {
    const registered = { ...plain, artifact: { kind: "panel" as const } };
    registerCopilotResult("Summarize this thread", registered);
    expect(copilotResultFor("  summarize this THREAD ")).toBe(registered);
    const kind = { summary: "The module covers returns.", points: [] };
    expect(copilotResultFor("What does it cover?", () => kind)).toBe(kind);
    expect(copilotResultFor("Suggest next steps").summary).toBe("Suggested next steps for this contact.");
  });
});
