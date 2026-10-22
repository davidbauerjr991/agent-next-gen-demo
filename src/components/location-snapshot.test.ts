// The Customer Snapshot's location lines for an unknown caller. Honolulu's
// zone once read "America/Honolulu" (not an IANA zone); an unknown caller
// whose randomUUID-seeded pool pick landed on it threw inside the workspace
// controller's render — the intermittent copilot-result-rows failure
// (2026-10-22). Every zone is pinned here, and the line never throws.
import { afterEach, describe, expect, it, vi } from "vitest";
import { AREA_CODE_LOCATIONS, buildLocationSnapshotLines, type CustomerLocation } from "./agent-next-gen-shared-utils";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("buildLocationSnapshotLines", () => {
  it("every area-code location has a zone Intl accepts, so each gets its local time", () => {
    for (const location of Object.values(AREA_CODE_LOCATIONS)) {
      expect(() => new Intl.DateTimeFormat("en-US", { timeZone: location.timeZone }), location.timeZone).not.toThrow();
      expect(buildLocationSnapshotLines(location)[1], location.timeZone).toMatch(/^Local time there is currently .+\.$/);
    }
  });

  it("drops the local-time line, without throwing, for a zone Intl rejects", () => {
    const lines = buildLocationSnapshotLines({ city: "Nowhere", region: "XX", timeZone: "Not/A_Zone" });
    expect(lines).toEqual(["Likely located near Nowhere, XX, based on the phone number's area code."]);
  });

  it("a failed formatter isn't cached: the next call tries again", () => {
    // A zone outside the table, so no earlier call has cached its formatter.
    const zone: CustomerLocation = { city: "Lisbon", region: "PT", timeZone: "Europe/Lisbon" };
    const Real = Intl.DateTimeFormat;
    const spy = vi.spyOn(Intl, "DateTimeFormat").mockImplementationOnce(() => {
      throw new RangeError(`Invalid time zone specified: ${zone.timeZone}`);
    });
    expect(buildLocationSnapshotLines(zone)).toHaveLength(1);
    spy.mockImplementation((...args) => new Real(...args));
    expect(buildLocationSnapshotLines(zone)).toHaveLength(2);
  });
});
