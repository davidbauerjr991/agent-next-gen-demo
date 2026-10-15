import { describe, expect, it } from "vitest";
import advancedSource from "@/components/AgentWorkspaceAdvancedPage.tsx?raw";
import deskSource from "@/components/AgentWorkspace2WithDeskPage.tsx?raw";

// P0.5c's done criterion, as a source check: the workspace pages run no
// scenario timers and build no scenario cards. Scripted cases come from the
// sim engine's scenario player and reach the pages only as provider events.

const PAGES: [string, string][] = [
  ["AgentWorkspaceAdvancedPage.tsx", advancedSource],
  ["AgentWorkspace2WithDeskPage.tsx", deskSource],
];

describe("no scenario timers or hotkey-built cards in the pages", () => {
  it.each(PAGES)("%s", (_name, source) => {
    // The legacy page-side scenario modules and their timelines.
    expect(source).not.toMatch(/-(lucas-thomas|tom-lewis-void-call|maya-chen-refund-call|marcus-webb)-scenario"/);
    expect(source).not.toMatch(/scenarios\/legacy/);
    expect(source).not.toMatch(/LIVE_LINES|REALTIME_STEPS|DECISION_FOLLOWUPS|CHAT_TRANSCRIPT|CALL_TRANSCRIPT/);
    expect(source).not.toMatch(/build(LucasThomas|TomLewisCall|MayaChenCall)Interaction/);
    // No scenario hotkeys: no keydown handler matching a bare scenario letter.
    expect(source).not.toMatch(/e\.key\.toLowerCase\(\) !== "[lacb]"/);
    // No timer appends a scripted case's messages.
    for (const timer of source.matchAll(/setTimeout\(([\s\S]{0,600})/g)) {
      expect(timer[1], "a timer touching a scripted case").not.toMatch(/LUCAS_THOMAS_ID|MARCUS_WEBB_ID|TOM_LEWIS_CALL_ID|MAYA_CHEN_CALL_ID/);
    }
  });
});
