// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { LOGO_ERROR_MESSAGES, readLogoFile, sanitizeSvg } from "./brand";
import { SECTIONS } from "./settings-schema";

const svg = (body: string, attrs = "") => `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"${attrs}>${body}</svg>`;

describe("sanitizeSvg", () => {
  it("strips scripts, event handlers, embedded documents and external references", () => {
    const dirty = svg(
      `<script>alert(1)</script><rect onclick="alert(2)" width="4" height="4" fill="url(#g)"/>` +
        `<image href="https://evil.example/x.png"/><use xlink:href="https://evil.example/s.svg#a"/>` +
        `<foreignObject><div>hi</div></foreignObject><style>@import url(https://evil.example/c.css);</style>` +
        `<a href="javascript:alert(3)"><circle r="2"/></a><linearGradient id="g"/>`,
      ` onload="alert(4)"`,
    );
    const clean = sanitizeSvg(dirty)!;
    expect(clean).not.toMatch(/script|onclick|onload|evil\.example|foreignObject|@import|javascript:/i);
    // What's harmless stays: shapes, local references.
    expect(clean).toContain("<rect");
    expect(clean).toContain('fill="url(#g)"');
    expect(clean).toContain("linearGradient");
  });

  it("refuses what isn't SVG", () => {
    expect(sanitizeSvg("<html><body/></html>")).toBeNull();
    expect(sanitizeSvg("not xml <")).toBeNull();
  });
});

describe("readLogoFile", () => {
  it("rejects a file over 256 KB, and a type other than PNG, SVG or JPEG", async () => {
    const big = new File([new Uint8Array(300 * 1024)], "logo.png", { type: "image/png" });
    expect(await readLogoFile(big)).toEqual({ ok: false, reason: "size" });
    const gif = new File([new Uint8Array(10)], "logo.gif", { type: "image/gif" });
    expect(await readLogoFile(gif)).toEqual({ ok: false, reason: "type" });
    expect(LOGO_ERROR_MESSAGES.size).toContain("256 KB");
  });

  it("reads a PNG as a data URL, and an SVG sanitized", async () => {
    const png = await readLogoFile(new File([new Uint8Array([137, 80, 78, 71])], "logo.png", { type: "image/png" }));
    expect(png).toEqual({ ok: true, dataUrl: "data:image/png;base64,iVBORw==" });
    const result = await readLogoFile(new File([svg(`<script>alert(1)</script><rect width="1" height="1"/>`)], "l.svg", { type: "image/svg+xml" }));
    expect(result.ok).toBe(true);
    const decoded = atob((result as { dataUrl: string }).dataUrl.split(",")[1]);
    expect(decoded).toContain("<rect");
    expect(decoded).not.toContain("script");
  });
});

describe("appearance.brand storage", () => {
  const read = (brand: unknown) => SECTIONS.appearance.read({ theme: "dark", brand }, SECTIONS.appearance.defaults).brand;

  it("keeps a valid logo data URL and drops anything else", () => {
    expect(read({ appName: "Acme", logo: "data:image/png;base64,AAAA" })).toMatchObject({ appName: "Acme", logo: "data:image/png;base64,AAAA" });
    expect(read({ appName: "Acme", logo: "https://evil.example/x.png" }).logo).toBeNull();
    expect(read({ appName: "Acme", logo: "data:text/html;base64,AAAA" }).logo).toBeNull();
    expect(read({ appName: "Acme", logo: `data:image/png;base64,${"A".repeat(400_000)}` }).logo).toBeNull();
  });

  it("a stored v1 appearance without a brand keeps its theme and reads the default brand", () => {
    const value = SECTIONS.appearance.read({ theme: "dark" }, SECTIONS.appearance.defaults);
    expect(value).toEqual({ theme: "dark", brand: { appName: "Agent Workspace", logo: null, colors: { primary: null, accent: null } } });
  });

  it("keeps #rrggbb colors (lowercased) and drops anything else", () => {
    expect(read({ colors: { primary: "#C2185B", accent: "red" } }).colors).toEqual({ primary: "#c2185b", accent: null });
    expect(read({ colors: { primary: "#c2185b; } body { x", accent: "#00897b" } }).colors).toEqual({ primary: null, accent: "#00897b" });
  });
});
