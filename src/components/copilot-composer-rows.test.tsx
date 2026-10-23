// @vitest-environment jsdom
// The Copilot composer ends at its last visible row (P-CANVAS browser pass,
// 2026-10-22): the chips row when there are chips, the input otherwise; no
// empty trailing element. Inline, the inactive pane takes no space.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createWorkspaceHarness } from "@/test-utils/workspace-harness";
import { InteractionComposer } from "@/components/transcript/InteractionTranscript";

const h = createWorkspaceHarness();

beforeEach(() => h.setUp());
afterEach(async () => {
  await h.tearDown();
});

const composer = () => h.container.querySelector<HTMLElement>("[data-slot=copilot-composer]")!;
const lastChild = () => composer().lastElementChild!;

describe("the Copilot composer's rows", () => {
  it("with chips: the last child is the chips row", async () => {
    await h.render(<InteractionComposer copilotOnly onSend={() => {}} copilotSuggestions={["Suggest a reply", "Summarize this conversation"]} />);
    expect(lastChild().querySelector("[data-slot=copilot-chips]")).not.toBeNull();
    expect(lastChild().querySelector("textarea")).toBeNull();
  });

  it("without chips: the last child is the input, and nothing renders after it", async () => {
    await h.render(<InteractionComposer copilotOnly onSend={() => {}} copilotSuggestions={[]} />);
    expect(lastChild().querySelector("textarea")).not.toBeNull();
    expect(composer().querySelector("[data-slot=copilot-chips]")).toBeNull();
    expect(composer().children).toHaveLength(1);
  });

  it("with Takeover: the last child is the row holding chips and Takeover; the real Takeover precedes the measuring copy", async () => {
    await h.render(
      <InteractionComposer copilotOnly onSend={() => {}} onTakeover={() => {}} copilotSuggestions={["Suggest a reply"]} />,
    );
    expect(composer().children).toHaveLength(2);
    expect(lastChild().querySelector("[data-slot=copilot-chips]")).not.toBeNull();
    const real = lastChild().querySelector("[data-slot=copilot-takeover]")!;
    const copy = lastChild().querySelector("[data-slot=copilot-row-measure]")!;
    expect(real.compareDocumentPosition(copy) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The first button with its label in the composer is the real one (tests and agents find it by its text).
    const first = [...composer().querySelectorAll("button")].find((b) => b.textContent?.trim() === real.textContent?.trim());
    expect(first).toBe(real);
  });

  it("is lyra's single-line pill", async () => {
    await h.render(<InteractionComposer copilotOnly onSend={() => {}} copilotSuggestions={[]} />);
    expect(composer().querySelector("textarea")!.closest(".rounded-full")).not.toBeNull();
  });
});

describe("inline, both panes mounted", () => {
  it("the inactive pane is hidden (takes no space), and keeps its state", async () => {
    await h.render(<InteractionComposer onSend={() => {}} copilotSuggestions={["Suggest a reply"]} />);
    const chatPane = h.container.querySelector("textarea[placeholder^='Type a message']")!.closest(".col-start-1")!;
    // Chat is the default: the Copilot pane is hidden.
    expect(composer().className).toContain("hidden");
    expect(chatPane.className).not.toContain("hidden");
  });
});
