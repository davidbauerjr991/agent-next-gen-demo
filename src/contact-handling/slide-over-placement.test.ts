import { describe, expect, it } from "vitest";
import { slideOverPlacement } from "./slide-over-placement";
import type { DetailPanelContent } from "./workspace/workspace-types";

const copilot: DetailPanelContent = { kind: "copilot-result", text: "Show the order", time: "9:15 AM" };
const session: DetailPanelContent = { kind: "session" };

describe("slideOverPlacement", () => {
  it("AI display panel: always the docked panel", () => {
    expect(slideOverPlacement({ displayLocation: "panel", content: copilot })).toEqual({ mode: "panel" });
    expect(slideOverPlacement({ displayLocation: "panel", content: null })).toEqual({ mode: "panel" });
  });

  it("inline and main: the reference slot", () => {
    expect(slideOverPlacement({ displayLocation: "inline", content: copilot })).toEqual({ mode: "referenceSlot" });
    expect(slideOverPlacement({ displayLocation: "main", content: copilot })).toEqual({ mode: "referenceSlot" });
    expect(slideOverPlacement({ displayLocation: "main", content: null })).toEqual({ mode: "referenceSlot" });
  });

  it("Session Details stays in the panel", () => {
    expect(slideOverPlacement({ displayLocation: "main", content: session })).toEqual({ mode: "panel" });
    expect(slideOverPlacement({ displayLocation: "inline", content: session })).toEqual({ mode: "panel" });
  });
});
