import { describe, expect, it } from "vitest";
import { defaultSettings, type SettingsState } from "@/settings/settings-schema";
import { withDerivedLayout } from "@/settings/settle";
import { slideOverPlacement } from "./slide-over-placement";
import type { DetailPanelContent } from "./workspace/workspace-types";

const copilot: DetailPanelContent = { kind: "copilot-result", text: "Show the order", time: "9:15 AM" };
const session: DetailPanelContent = { kind: "session" };

/** The layout map under an AI display (P-LAYOUT: the placement reads the parts' slots). */
const partsUnder = (displayLocation: SettingsState["ai"]["displayLocation"]) =>
  withDerivedLayout({ ...defaultSettings(), ai: { ...defaultSettings().ai, displayLocation } }).layout.parts;

describe("slideOverPlacement", () => {
  it("AI display panel: the docked panel, but for the parts with a slot of their own", () => {
    expect(slideOverPlacement({ parts: partsUnder("panel"), content: copilot })).toEqual({ mode: "panel" });
    expect(slideOverPlacement({ parts: partsUnder("panel"), content: null })).toEqual({ mode: "panel" });
  });

  it("inline and main: the reference slot", () => {
    expect(slideOverPlacement({ parts: partsUnder("inline"), content: copilot })).toEqual({ mode: "referenceSlot" });
    expect(slideOverPlacement({ parts: partsUnder("main"), content: copilot })).toEqual({ mode: "referenceSlot" });
    expect(slideOverPlacement({ parts: partsUnder("main"), content: null })).toEqual({ mode: "referenceSlot" });
  });

  it("Session Details and Contact Details: the reference slot under every AI display (P-HOME-1n, their parts' slot)", () => {
    for (const displayLocation of ["inline", "panel", "main"] as const) {
      expect(slideOverPlacement({ parts: partsUnder(displayLocation), content: session })).toEqual({ mode: "referenceSlot" });
      expect(slideOverPlacement({ parts: partsUnder(displayLocation), content: { kind: "contactDetails" } })).toEqual({ mode: "referenceSlot" });
    }
  });

  it("a detail part the map puts in the docked panel opens there (P-LAYOUT)", () => {
    const parts = partsUnder("inline");
    const docked = { ...parts, contactDetails: { ...parts.contactDetails, slot: "docked-panel" as const } };
    expect(slideOverPlacement({ parts: docked, content: { kind: "contactDetails" } })).toEqual({ mode: "panel" });
    expect(slideOverPlacement({ parts: docked, content: session })).toEqual({ mode: "referenceSlot" });
  });
});
