// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Interaction, Thread } from "@/components/agent-next-gen-interaction-dashboard";
import type { TranscriptMessage } from "@/components/agent-next-gen-transcript";
import { useOmnichannelLayout, type OmnichannelLayout } from "./useOmnichannelLayout";

const thread = (type: Thread["type"]): Thread => ({ id: type, type, startTick: 0 }) as Thread;
const customer = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `m${i}`, sender: "customer" }) as TranscriptMessage);
const card = (id: string, sms: number): Interaction =>
  ({ id, threads: [thread("chat"), thread("sms")], liveMessages: { sms: customer(sms) } }) as unknown as Interaction;

let root: Root;
let container: HTMLElement;
let layout!: OmnichannelLayout;

function Probe({ active, mainKey }: { active: Interaction | null; mainKey: string | undefined }) {
  layout = useOmnichannelLayout(active, mainKey);
  return null;
}

async function show(active: Interaction | null, mainKey = "chat") {
  await act(async () => root.render(<Probe active={active} mainKey={mainKey} />));
}

beforeEach(() => {
  container = document.createElement("div");
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
});

describe("useOmnichannelLayout", () => {
  it("counts customer messages that arrive while the thread isn't showing, and clears them once it shows", async () => {
    await show(card("a", 0));
    await show(card("a", 2));
    expect(layout.unread("a", "sms", customer(2))).toBe(2);
    await act(async () => layout.open("a", "sms"));
    await show(card("a", 2));
    expect(layout.slideOutKey).toBe("sms");
    expect(layout.unread("a", "sms", customer(2))).toBe(0);
    // Seen while showing; a new one after closing counts again.
    await act(async () => layout.close("a"));
    await show(card("a", 3));
    expect(layout.unread("a", "sms", customer(3))).toBe(1);
  });

  it("keeps the slide-out per card and never shows the main thread in it", async () => {
    await show(card("a", 0));
    await act(async () => layout.open("a", "sms"));
    await show(card("b", 0));
    expect(layout.slideOutKey).toBeNull();
    await show(card("a", 0));
    expect(layout.slideOutKey).toBe("sms");
    await show(card("a", 0), "sms");
    expect(layout.slideOutKey).toBeNull();
    await act(async () => layout.toggle("a", "sms"));
    await show(card("a", 0));
    expect(layout.slideOutKey).toBeNull();
  });
});
