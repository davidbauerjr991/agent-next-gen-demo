import { describe, expect, it } from "vitest";
import { slideOverPlacement } from "./slide-over-placement";
import type { DetailPanelContent } from "./workspace/workspace-types";

const copilot: DetailPanelContent = { kind: "copilot-result", text: "Show the order", time: "9:15 AM" };
const session: DetailPanelContent = { kind: "session" };

describe("slideOverPlacement", () => {
  it("AI display panel: the docked panel, but for the parts with a slot of their own", () => {
    expect(slideOverPlacement({ displayLocation: "panel", content: copilot })).toEqual({ mode: "panel" });
    expect(slideOverPlacement({ displayLocation: "panel", content: null })).toEqual({ mode: "panel" });
  });

  it("inline and main: the reference slot", () => {
    expect(slideOverPlacement({ displayLocation: "inline", content: copilot })).toEqual({ mode: "referenceSlot" });
    expect(slideOverPlacement({ displayLocation: "main", content: copilot })).toEqual({ mode: "referenceSlot" });
    expect(slideOverPlacement({ displayLocation: "main", content: null })).toEqual({ mode: "referenceSlot" });
  });

  it("Session Details and Contact Details: the reference slot under every AI display (P-HOME-1n, their parts' slot)", () => {
    for (const displayLocation of ["inline", "panel", "main"] as const) {
      expect(slideOverPlacement({ displayLocation, content: session })).toEqual({ mode: "referenceSlot" });
      expect(slideOverPlacement({ displayLocation, content: { kind: "contactDetails" } })).toEqual({ mode: "referenceSlot" });
    }
  });
});
