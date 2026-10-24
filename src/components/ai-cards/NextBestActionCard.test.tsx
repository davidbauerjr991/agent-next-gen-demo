// @vitest-environment jsdom
// P-SHRINK: a Do Next Best Action (and an alternative) can ask for a note — a
// reason, an amount — shown under its action line; Run it waits for a
// required note (an amount above zero), and what was typed travels on the
// answer and shows in the Used row.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextBestActionSuggestion } from "@/providers";
import { NbaOutcomeRow } from "@/components/transcript/ai-rows/NbaOutcomeRow";
import { NextBestActionCard } from "./NextBestActionCard";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const SUGGESTION: NextBestActionSuggestion = {
  type: "do",
  title: "Issue store credit",
  why: "He's irate.",
  action: "Issues store credit to his account",
  note: { label: "Credit amount", placeholder: "200", required: true, kind: "amount" },
  alt: [
    { type: "do", text: "Reject the refund", note: { label: "Reason", placeholder: "Why not?", required: true } },
    { type: "do", text: "Send a 20% discount code" },
  ],
  at: 0,
};

const render = (el: React.ReactElement) => act(() => root.render(el));
const button = (label: string) => [...host.querySelectorAll("button")].filter((b) => b.textContent?.trim() === label);
const click = (el: Element) => act(() => (el as HTMLElement).click());
function type(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value")!.set!;
  act(() => {
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("a Do suggestion's note", () => {
  it("shows under the action line; Run it waits for an amount above zero, then passes what was typed", () => {
    const onUse = vi.fn();
    render(<NextBestActionCard suggestion={SUGGESTION} onUse={onUse} />);
    const amount = host.querySelector<HTMLInputElement>("input[placeholder='200']")!;
    expect(amount).not.toBeNull();
    const [run] = button("Run it");
    expect(run.disabled).toBe(true);
    type(amount, "0");
    expect(run.disabled).toBe(true);
    type(amount, " 150 ");
    expect(run.disabled).toBe(false);
    click(run);
    expect(onUse).toHaveBeenCalledWith("150");
  });

  it("an alternative with a note opens its own field and Run it; one without is used at once", () => {
    const onUseAlternative = vi.fn();
    render(<NextBestActionCard suggestion={SUGGESTION} onUseAlternative={onUseAlternative} />);
    const uses = button("Use");
    expect(uses).toHaveLength(2);
    click(uses[1]);
    expect(onUseAlternative).toHaveBeenLastCalledWith(1);
    click(uses[0]);
    expect(onUseAlternative).toHaveBeenCalledTimes(1);
    const field = host.querySelector("[data-slot=nba-alternative-note]")!;
    expect(field.textContent).toContain("Reject the refund");
    const reason = field.querySelector<HTMLTextAreaElement>("textarea")!;
    const run = [...field.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Run it")!;
    expect(run.disabled).toBe(true);
    type(reason, "Needs photos first");
    click(run);
    expect(onUseAlternative).toHaveBeenLastCalledWith(0, "Needs photos first");
  });

  it("a suggestion without a note runs with none", () => {
    const onUse = vi.fn();
    render(<NextBestActionCard suggestion={{ ...SUGGESTION, note: undefined }} onUse={onUse} />);
    click(button("Run it")[0]);
    expect(onUse).toHaveBeenCalledWith(undefined);
  });

  it("an optional note left blank (or spaces) is passed as none", () => {
    const onUse = vi.fn();
    const onUseAlternative = vi.fn();
    const optional: NextBestActionSuggestion = {
      ...SUGGESTION,
      note: { label: "Credit amount", placeholder: "200", kind: "amount" },
      alt: [{ type: "do", text: "Reject the refund", note: { label: "Reason", placeholder: "Why not?" } }],
    };
    render(<NextBestActionCard suggestion={optional} onUse={onUse} onUseAlternative={onUseAlternative} />);
    type(host.querySelector<HTMLInputElement>("input[placeholder='200']")!, "  ");
    click(button("Run it")[0]);
    expect(onUse).toHaveBeenCalledWith(undefined);
    click(button("Use")[0]);
    const field = host.querySelector("[data-slot=nba-alternative-note]")!;
    type(field.querySelector<HTMLTextAreaElement>("textarea")!, "  ");
    click([...field.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Run it")!);
    expect(onUseAlternative).toHaveBeenCalledWith(0, undefined);
  });
});

describe("the Used row", () => {
  it("carries the note: Used at hh:mm — title · label: value", () => {
    render(<NbaOutcomeRow outcome={{ outcome: "used", title: "Reject the refund", at: "2:41 PM", note: { label: "Reason", value: "Needs photos first" } }} />);
    expect(host.textContent).toBe("Used at 2:41 PM — Reject the refund · reason: Needs photos first");
    render(<NbaOutcomeRow outcome={{ outcome: "used", title: "Approve the refund", at: "2:41 PM" }} />);
    expect(host.textContent).toBe("Used at 2:41 PM — Approve the refund");
  });
});
