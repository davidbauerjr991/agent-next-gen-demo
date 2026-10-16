import { describe, expect, it } from "vitest";
import {
  SURFACE,
  brandStylesheet,
  brandTokens,
  contrast,
  hexToRgb,
  oklchToRgb,
  onColor,
  primaryContrastFailures,
  rgbToHex,
  rgbToOklch,
} from "./brand-colors";

describe("brand colors (OKLCH-derived lyra overrides)", () => {
  it("hex → OKLCH → hex round-trips", () => {
    for (const hex of ["#166cca", "#6149c1", "#c2185b", "#ffee58", "#000000", "#ffffff", "#00897b"]) {
      expect(rgbToHex(oklchToRgb(rgbToOklch(hexToRgb(hex))))).toBe(hex);
    }
  });

  it("on-color text passes AA (4.5:1) on a light and on a dark primary", () => {
    for (const primary of ["#ffd400", "#1a237e", "#166cca", "#c2185b"]) {
      for (const theme of ["light", "dark"] as const) {
        const tokens = brandTokens({ primary, accent: null }, theme);
        expect(contrast(tokens["fg-on-primary"], primary)).toBeGreaterThanOrEqual(4.5);
      }
    }
    expect(onColor("#ffd400")).not.toBe("#ffffff");
    expect(onColor("#1a237e")).toBe("#ffffff");
  });

  it("links and active text are readable on the page in both themes, whatever the primary", () => {
    for (const primary of ["#ffee58", "#1a237e", "#c2185b"]) {
      for (const theme of ["light", "dark"] as const) {
        const tokens = brandTokens({ primary, accent: null }, theme);
        expect(contrast(tokens["fg-link"], SURFACE[theme])).toBeGreaterThanOrEqual(4.5);
        expect(contrast(tokens["fg-active-strong"], SURFACE[theme])).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("warns when a primary fails AA against the page, and names the theme", () => {
    expect(primaryContrastFailures("#ffff00")).toContain("light");
    expect(primaryContrastFailures("#166cca")).toEqual([]);
    expect(primaryContrastFailures("#1a1a1a")).toContain("dark");
  });

  it("emits a light and a dark block that outrank lyra's own; nothing with no colors", () => {
    const css = brandStylesheet({ primary: "#c2185b", accent: "#00897b" });
    expect(css).toContain(':root:not([data-theme="dark"]) {');
    expect(css).toContain(':root[data-theme="dark"] {');
    expect(css).toContain("--lyra-color-accent-purple-soft-header:");
    expect(brandStylesheet({ primary: null, accent: null })).toBe("");
  });

  it("the dark focus ring stays lyra's (not overridden in dark)", () => {
    expect(brandTokens({ primary: "#c2185b", accent: null }, "light")["border-focus-default"]).toBeDefined();
    expect(brandTokens({ primary: "#c2185b", accent: null }, "dark")["border-focus-default"]).toBeUndefined();
  });
});
