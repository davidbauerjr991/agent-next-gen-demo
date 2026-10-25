// The scenario hotkeys (P0.5c) and the demo moments (P-HOME-1): a moment's
// key starts each of its scripts at its offset; disposing clears what's pending.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SCENARIO_MOMENTS, SCENARIOS } from "../../scenarios";
import { installScenarioHotkeys } from "./sim-scenario-hotkeys";

function fakeWindow() {
  let handler: ((e: KeyboardEvent) => void) | null = null;
  return {
    location: { hash: "#/agent-advanced" } as Location,
    addEventListener: (_: string, h: EventListener) => (handler = h as (e: KeyboardEvent) => void),
    removeEventListener: () => (handler = null),
    press: (key: string) => handler?.({ key, metaKey: false, ctrlKey: false, altKey: false, repeat: false, target: null } as unknown as KeyboardEvent),
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("scenario hotkeys", () => {
  it("M plays Maya now and Lucas 3s later", () => {
    const played: string[] = [];
    const target = fakeWindow();
    installScenarioHotkeys({ playScenario: (id) => (played.push(id), "x" as never) }, SCENARIOS, target, SCENARIO_MOMENTS);
    target.press("m");
    vi.advanceTimersByTime(0);
    expect(played).toEqual(["maya-chen-refund-call"]);
    vi.advanceTimersByTime(3_000);
    expect(played).toEqual(["maya-chen-refund-call", "lucas-thomas"]);
  });

  it("a script's own key still plays just that script; disposing cancels a pending moment play", () => {
    const played: string[] = [];
    const target = fakeWindow();
    const remove = installScenarioHotkeys({ playScenario: (id) => (played.push(id), "x" as never) }, SCENARIOS, target, SCENARIO_MOMENTS);
    target.press("a");
    expect(played).toEqual(["lucas-thomas"]);
    target.press("m");
    vi.advanceTimersByTime(0);
    remove();
    vi.advanceTimersByTime(5_000);
    expect(played).toEqual(["lucas-thomas", "maya-chen-refund-call"]);
  });
});
