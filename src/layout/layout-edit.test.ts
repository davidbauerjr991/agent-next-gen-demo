// P-LAYOUT: Settings → Layout's edits. A move or a reorder writes one part's order key between its new neighbours
// and keeps every other key (so Home's sections and the interaction's parts, which share `main`, never disturb each
// other); neighbours sharing a key renumber the list. canPlace says why a slot refuses a part.
import { describe, expect, it } from "vitest";
import { defaultSettings } from "@/settings/settings-schema";
import { withDerivedLayout } from "@/settings/settle";
import { canPlace, lockedBy, movePatch, partsOnPage, reorderPatch, slotsOnPage } from "./layout-edit";
import { patchParts, type LayoutParts } from "./layout-section";

const values = () => withDerivedLayout(defaultSettings());

describe("layout edits (P-LAYOUT)", () => {
  it("each page lists its own slots, never the overlay", () => {
    expect(slotsOnPage("home")).toEqual(["left-nav", "interior-panel", "home-top", "main", "main-trailing", "docked-panel", "dock-bottom", "header"]);
    expect(slotsOnPage("interaction")).toEqual(["left-nav", "interior-panel", "main", "reference", "docked-panel", "dock-bottom", "header"]);
  });

  it("main lists Home's parts on Home and the interaction's on an interaction", () => {
    const { parts } = values().layout;
    // Ask Copilot's key is its registry position (presets set its slot only); the composer mounts in its host either way.
    expect(partsOnPage(parts, "main", "interaction")).toEqual(["copilotInput", "conversation", "aiFeed"]);
    expect(partsOnPage(parts, "main", "home")).toContain("activityFeed");
    expect(partsOnPage(parts, "main", "home")).not.toContain("conversation");
  });

  it("a move lands between its new neighbours and keeps every other key", () => {
    const { parts } = values().layout;
    const cells = (p: LayoutParts) => partsOnPage(p, "main", "interaction");
    // Customer Info into main between the conversation and the AI feed.
    const patch = movePatch(parts, "customerInfo", "main", 2, "interaction");
    expect(Object.keys(patch)).toEqual(["customerInfo"]);
    const next = patchParts(parts, patch);
    expect(cells(next)).toEqual(["copilotInput", "conversation", "customerInfo", "aiFeed"]);
    for (const p of ["copilotInput", "conversation", "aiFeed"] as const) expect(next[p]).toBe(parts[p]);
    // To the start, and past the end.
    expect(cells(patchParts(parts, movePatch(parts, "customerInfo", "main", 0, "interaction")))[0]).toBe("customerInfo");
    const atEnd = cells(patchParts(parts, movePatch(parts, "customerInfo", "main", Infinity, "interaction")));
    expect(atEnd[atEnd.length - 1]).toBe("customerInfo");
  });

  it("neighbours sharing a key renumber the list instead of tying", () => {
    const { parts } = values().layout;
    const tied = patchParts(parts, { conversation: { order: 5 }, aiFeed: { order: 5 }, copilotInput: { order: 5 } });
    // Tied, the list reads in registry order: conversation, aiFeed, copilotInput.
    expect(partsOnPage(tied, "main", "interaction")).toEqual(["conversation", "aiFeed", "copilotInput"]);
    const next = patchParts(tied, movePatch(tied, "customerInfo", "main", 1, "interaction"));
    expect(partsOnPage(next, "main", "interaction")).toEqual(["conversation", "customerInfo", "aiFeed", "copilotInput"]);
  });

  it("a reorder moves the one part that moved", () => {
    const { parts } = values().layout;
    const before = partsOnPage(parts, "main", "interaction");
    const next = patchParts(parts, reorderPatch(parts, "main", "interaction", [before[1], before[0], before[2]]));
    expect(partsOnPage(next, "main", "interaction")).toEqual([before[1], before[0], before[2]]);
    expect(reorderPatch(parts, "main", "interaction", before)).toEqual({});
  });

  it("lockedBy names a lock on a section the write would reach, as the store would drop it", () => {
    const v = values();
    // The voice bar's slot is Voice's controls location.
    expect(lockedBy(v, { voiceBar: { slot: "left-nav" } }, ["voice"])).toBe("Set by your team profile");
    expect(lockedBy(v, { voiceBar: { slot: "left-nav" } }, ["home"])).toBeNull();
    expect(lockedBy(v, { voiceBar: { slot: "left-nav" } }, [])).toBeNull();
    // A custom arrangement reproduces no value, so it reaches nothing: Home's lock doesn't stop it.
    expect(lockedBy(v, { queue: { slot: "main-trailing" } }, ["home"])).toBeNull();
  });

  it("canPlace refuses a slot the part doesn't allow, and one a rule keeps it out of", () => {
    const v = values();
    expect(canPlace(v, "voiceBar", "left-nav")).toBe(true);
    expect(canPlace(v, "contactHistory", "main-trailing")).toBe("Contact history can't go in the Cards column");
    // The queue chip follows the assignments: on Home while they're in the left nav.
    expect(canPlace(v, "queueChip", "header")).toBe("On Home while assignments are in a panel");
    expect(canPlace(v, "queueChip", "home-top")).toBe(true);
  });
});
