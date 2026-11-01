import { describe, expect, it } from "vitest";
import type { SectionSource } from "./layers";
import { resolvedRows, valueText } from "./resolved-rows";
import { profileFieldKeys, sectionInProfiles } from "./scope";
import { SECTIONS, defaultSettings, type SectionKey } from "./settings-schema";
import { withDerivedLayout } from "./settle";

const values = withDerivedLayout(defaultSettings());
const keys = Object.keys(SECTIONS) as SectionKey[];
const sourcesWith = (overrides: Partial<Record<SectionKey, SectionSource>>) =>
  Object.fromEntries(keys.map((k) => [k, overrides[k] ?? { from: null, lockedBy: null }])) as Record<SectionKey, SectionSource>;

describe("resolvedRows", () => {
  it("lists every agent-scope top-level field once, from the schema, and no personal or admin one", () => {
    const rows = resolvedRows(values, sourcesWith({}));
    const expected = keys.filter((k) => sectionInProfiles(k)).flatMap((k) => profileFieldKeys(k).map((f) => `${k}.${f}`));
    expect(rows.map((r) => `${r.section}.${r.field}`)).toEqual(expected);
    expect(rows.some((r) => r.section === "phone" || r.field === "tabOrder")).toBe(false);
  });

  it("names each value's source: the lock first, an org layer, the agent's own, else the default", () => {
    const rows = resolvedRows(
      values,
      sourcesWith({
        notifications: { from: { level: "team", profileName: "Supervisors", primary: true }, lockedBy: { level: "team", profileName: "Supervisors", primary: true } },
        voice: { from: { level: "contactCenter", profileName: "Northwind Care" }, lockedBy: null },
        channels: { from: { level: "agent" }, lockedBy: null },
      }),
    );
    const row = (section: SectionKey) => rows.find((r) => r.section === section)!;
    expect([row("notifications").source, row("notifications").locked]).toEqual(["Locked by: Supervisors team profile", true]);
    expect([row("voice").source, row("voice").locked]).toEqual(["Set by: Northwind Care contact center profile", false]);
    expect(row("channels").source).toBe("Yours");
    expect(row("ai").source).toBe("Default");
  });

  it("summarises values: a declared label, On/Off, the switches that are on, else short JSON", () => {
    const rows = resolvedRows(values, sourcesWith({}));
    expect(rows.find((r) => r.section === "voice" && r.field === "controlsLocation")).toMatchObject({ value: "bottom" });
    expect(rows.find((r) => r.section === "home" && r.field === "layout")?.label).toBe("Home layout");
    expect(valueText(true)).toBe("On");
    expect(valueText({ voice: true, chat: false, sms: true })).toBe("voice, sms");
    expect(valueText({ voice: false })).toBe("None");
    expect(valueText({ a: { b: "x".repeat(200) } }).length).toBe(80);
    // An array of objects (Home's sections) is capped as a whole.
    expect(rows.find((r) => r.section === "home" && r.field === "sections")!.value.length).toBeLessThanOrEqual(80);
    expect(rows.find((r) => r.section === "channels" && r.field === "sms")?.label).toBe("SMS");
  });
});
