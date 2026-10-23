// @vitest-environment jsdom
// The scenario hotkeys (a/b/c/l) are on whenever the URL asks for the sim
// (`?provider=sim`), in any build, through the factory the app boots with;
// without the flag (the sim is still the default provider) they're off. In a
// production build there's still no `__simCustomer` global.
import { afterEach, describe, expect, it, vi } from "vitest";
import { PLACEHOLDER_DATABASE } from "../../data/database-handle";
import { PLACEHOLDER_PROFILE } from "../../profiles/contact-center-profile";
import { PROVIDER_FACTORIES } from "../../provider-context/factories";
import type { ProviderSet } from "../../providers";

let set: ProviderSet | undefined;

afterEach(async () => {
  await set?.interaction.dispose();
  set = undefined;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});

/** Boots the sim the way the app does at `url`, in a production build; returns how many keydown listeners it added. */
function bootProduction(url: string): number {
  vi.stubEnv("DEV", false);
  vi.stubEnv("PROD", true);
  window.history.replaceState(null, "", url);
  const add = vi.spyOn(window, "addEventListener");
  set = PROVIDER_FACTORIES.sim({ profile: PLACEHOLDER_PROFILE, database: PLACEHOLDER_DATABASE, simLatency: "off" });
  return add.mock.calls.filter(([type]) => type === "keydown").length;
}

describe("the scenario hotkeys follow ?provider=sim, not the build", () => {
  it("production build with ?provider=sim: the hotkeys are registered; no __simCustomer global", () => {
    expect(import.meta.env.DEV).toBe(true);
    expect(bootProduction("/?provider=sim#/agent-advanced")).toBe(1);
    expect(import.meta.env.DEV).toBe(false);
    expect(window.__simCustomer).toBeUndefined();
  });

  it("production build without the flag (the sim by default): not registered", () => {
    expect(bootProduction("/#/agent-advanced")).toBe(0);
    expect(window.__simCustomer).toBeUndefined();
  });

  it("another provider's flag: not registered", () => {
    expect(bootProduction("/?provider=twilio#/agent-advanced")).toBe(0);
  });

  it("disposing the set removes them", async () => {
    bootProduction("/?provider=sim#/agent-advanced");
    const remove = vi.spyOn(window, "removeEventListener");
    await set!.interaction.dispose();
    set = undefined;
    expect(remove.mock.calls.filter(([type]) => type === "keydown")).toHaveLength(1);
  });
});
