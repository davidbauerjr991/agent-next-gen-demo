import { describe, expect, it } from "vitest";
import { DEFAULT_SLA } from "@/profiles/contact-center-profile";
import { offerRowAnswerSeverity } from "./answer-sla";
import { dockedPreviewKey } from "./docked-preview";
import { showsSessionControls } from "./session-controls";

describe("offerRowAnswerSeverity", () => {
  const sla = DEFAULT_SLA.answer;
  const voice = { type: "voice" as const, startTick: 100 };

  it("puts a ringing voice row on the answer SLA from the offer's start, selected or not", () => {
    expect(offerRowAnswerSeverity({ offered: true }, voice, 104, sla)).toBe("success");
    expect(offerRowAnswerSeverity({ offered: true }, voice, 106, sla)).toBe("warning");
    expect(offerRowAnswerSeverity({ offered: true }, voice, 111, sla)).toBe("critical");
  });

  it("leaves accepted calls and other rows alone", () => {
    expect(offerRowAnswerSeverity({ offered: false }, voice, 111, sla)).toBeUndefined();
    expect(offerRowAnswerSeverity({ offered: true }, { type: "chat", startTick: 100 }, 111, sla)).toBeUndefined();
  });
});

describe("dockedPreviewKey", () => {
  it("never previews the main column's own thread", () => {
    expect(dockedPreviewKey("chat:priya", "chat:priya")).toBeNull();
    expect(dockedPreviewKey("email:priya", "chat:priya")).toBe("email:priya");
    expect(dockedPreviewKey(null, "chat:priya")).toBeNull();
  });
});

describe("showsSessionControls", () => {
  it("hides them on a ringing offer only", () => {
    expect(showsSessionControls({ offered: true })).toBe(false);
    expect(showsSessionControls({})).toBe(true);
  });
});
