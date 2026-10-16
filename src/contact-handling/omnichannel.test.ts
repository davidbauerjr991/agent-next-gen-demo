import { describe, expect, it } from "vitest";
import type { Thread } from "@/components/agent-next-gen-interaction-dashboard";
import { channelTempo, customerMessageCount, mainThreadKey, omnichannelMainKey, panelDefaultKey, routeChannel } from "./omnichannel";

const thread = (type: Thread["type"]): Thread => ({ id: type, type, startTick: 0 }) as Thread;

describe("omnichannel routing", () => {
  it("voice and chat are sync; email, SMS and WhatsApp are async", () => {
    expect(["voice", "chat"].map((t) => channelTempo(t as Thread["type"]))).toEqual(["sync", "sync"]);
    expect(["email", "sms", "whatsapp"].map((t) => channelTempo(t as Thread["type"]))).toEqual(["async", "async", "async"]);
  });

  it("main thread: the chat, else the call, else the first async thread", () => {
    expect(mainThreadKey([thread("email"), thread("voice"), thread("chat")])).toBe("chat");
    expect(mainThreadKey([thread("email"), thread("voice")])).toBe("voice");
    expect(mainThreadKey([thread("sms"), thread("email")])).toBe("sms");
    expect(mainThreadKey([])).toBeUndefined();
  });

  it("voice has no content view next to a chat; async goes to the slide-out next to a sync channel", () => {
    const card = [thread("voice"), thread("chat"), thread("email")];
    expect(routeChannel(card, "chat")).toBe("main");
    expect(routeChannel(card, "voice")).toBe("bar");
    expect(routeChannel(card, "email")).toBe("slideout");
    expect(routeChannel([thread("voice"), thread("email")], "voice")).toBe("main");
    expect(routeChannel([thread("voice"), thread("email")], "email")).toBe("slideout");
    // No sync channel: an async thread fills the main column.
    expect(routeChannel([thread("email"), thread("sms")], "sms")).toBe("main");
  });

  it("the main column never keeps a thread that belongs elsewhere", () => {
    const card = [thread("voice"), thread("chat"), thread("email")];
    expect(omnichannelMainKey(card, "email")).toBe("chat");
    expect(omnichannelMainKey(card, "voice")).toBe("chat");
    expect(omnichannelMainKey(card, "chat")).toBe("chat");
    expect(omnichannelMainKey([thread("voice"), thread("email")], undefined)).toBe("voice");
  });

  it("placement \"panel\" (AI display \"main\"): voice is the bar, every other thread (chat included) the panel", () => {
    const card = [thread("voice"), thread("chat"), thread("email")];
    expect(routeChannel(card, "chat", "panel")).toBe("slideout");
    expect(routeChannel(card, "email", "panel")).toBe("slideout");
    expect(routeChannel(card, "voice", "panel")).toBe("bar");
    expect(routeChannel([thread("chat")], "chat", "panel")).toBe("slideout");
    expect(routeChannel([thread("voice")], "voice", "panel")).toBe("bar");
  });

  it("the panel's default thread: the chat, else the first thread that isn't voice", () => {
    expect(panelDefaultKey([thread("voice"), thread("email"), thread("chat")])).toBe("chat");
    expect(panelDefaultKey([thread("voice"), thread("sms"), thread("email")])).toBe("sms");
    expect(panelDefaultKey([thread("voice")])).toBeUndefined();
  });

  it("counts only customer messages", () => {
    expect(
      customerMessageCount([
        { sender: "customer" },
        { sender: "agent" },
        { sender: "customer" },
      ] as never)
    ).toBe(2);
    expect(customerMessageCount(undefined)).toBe(0);
  });
});
