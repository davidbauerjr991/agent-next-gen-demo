import { describe, expect, it } from "vitest";
import type { TranscriptMessage } from "@/components/transcript/transcript-types";
import { aiCardKindOf, isAiActionMessage, isOnDemandAiMessage, isPushedAiMessage } from "./ai-card-kinds";

const base: TranscriptMessage = { id: "m", sender: "agent", name: "John Smith", initials: "JS", timestamp: "9:00 AM", text: "" };
const instruction = { title: "t", by: "John Smith", link: "l" };

describe("AI card kinds: pushed or on demand (P-LAYOUT-F4 8)", () => {
  it("what the AI shows on its own is pushed", () => {
    const pushed: Partial<TranscriptMessage>[] = [
      { instruction },
      { summary: {} as TranscriptMessage["summary"] },
      { wrapUp: {} as TranscriptMessage["wrapUp"] },
      { saveAddress: {} as TranscriptMessage["saveAddress"] },
      { nbaOutcome: { outcome: "used", title: "t", at: "9:00 AM" } },
      { nba: { contactId: "c", stepId: "s" } },
    ];
    for (const part of pushed) {
      const m = { ...base, ...part };
      expect(isPushedAiMessage(m), JSON.stringify(Object.keys(part))).toBe(true);
      expect(isOnDemandAiMessage(m)).toBe(false);
    }
  });

  it("what the agent asked for is on demand: a Copilot question's or chip's row, and a plain answer's line", () => {
    const ask = { ...base, instruction, copilotAsk: true as const };
    const line = { ...base, event: true, eventContext: "the question" };
    expect(aiCardKindOf(ask)?.id).toBe("copilot-result");
    expect(aiCardKindOf(line)?.id).toBe("copilot-line");
    for (const m of [ask, line]) {
      expect(isOnDemandAiMessage(m)).toBe(true);
      expect(isPushedAiMessage(m)).toBe(false);
    }
  });

  it("the conversation record is no AI card", () => {
    expect(isAiActionMessage({ ...base, text: "Hello" })).toBe(false);
    expect(isAiActionMessage({ ...base, event: true, text: "Chat started" })).toBe(false);
  });
});
