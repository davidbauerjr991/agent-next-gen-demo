// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Interaction, Thread } from "@/components/agent-next-gen-interaction-dashboard";
import type { TranscriptMessage } from "@/components/transcript/InteractionTranscript";
import { useOmnichannelLayout, type OmnichannelLayout } from "./useOmnichannelLayout";

const thread = (type: Thread["type"]): Thread => ({ id: type, type, startTick: 0 }) as Thread;
const customer = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `m${i}`, sender: "customer" }) as TranscriptMessage);
const card = (id: string, sms: number): Interaction =>
  ({ id, threads: [thread("chat"), thread("sms")], liveMessages: { sms: customer(sms) } }) as unknown as Interaction;

let root: Root;
let container: HTMLElement;
let layout!: OmnichannelLayout;

function Probe({ active, mainKey, defaultKey }: { active: Interaction | null; mainKey: string | undefined; defaultKey?: string }) {
  layout = useOmnichannelLayout(active, mainKey, { defaultKey });
  return null;
}

async function show(active: Interaction | null, mainKey: string | null = "chat", defaultKey?: string) {
  await act(async () => root.render(<Probe active={active} mainKey={mainKey ?? undefined} defaultKey={defaultKey} />));
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

  it("placement \"panel\": the default thread shows until the agent picks; a close stays closed until a pick", async () => {
    await show(card("a", 0), null, "chat");
    expect(layout.slideOutKey).toBe("chat");
    await act(async () => layout.open("a", "sms"));
    await show(card("a", 0), null, "chat");
    expect(layout.slideOutKey).toBe("sms");
    // Toggling the showing default closes it, and closed is remembered.
    await show(card("b", 0), null, "chat");
    expect(layout.slideOutKey).toBe("chat");
    await act(async () => layout.toggle("b", "chat"));
    await show(card("b", 0), null, "chat");
    expect(layout.slideOutKey).toBeNull();
    await show(card("a", 0), null, "chat");
    await show(card("b", 0), null, "chat");
    expect(layout.slideOutKey).toBeNull();
    await act(async () => layout.toggle("b", "chat"));
    await show(card("b", 0), null, "chat");
    expect(layout.slideOutKey).toBe("chat");
  });
});
