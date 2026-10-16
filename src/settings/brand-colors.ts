// Brand colors (P-AIFIRST): a picked primary and accent become overrides on
// lyra's CSS custom properties, never component changes. Each family
// (hover, pressed, subtle backgrounds, on-color text, links, focus) is
// derived in OKLCH, separately for light and dark, with on-color text and
// text-on-surface shades chosen for WCAG contrast.

export type Theme = "light" | "dark";
export interface BrandColors {
  primary: string | null;
  accent: string | null;
}

/** lyra's page backgrounds (`--lyra-color-bg-surface-base`). */
export const SURFACE: Record<Theme, string> = { light: "#ffffff", dark: "#1f1f1e" };
const DARK_TEXT = "#0b0f14";

// ── Color math ──

type Rgb = [number, number, number]; // 0..1, sRGB
interface Oklch {
  l: number;
  c: number;
  h: number;
}

export function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function rgbToHex([r, g, b]: Rgb): string {
  const to = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const fromLinear = (v: number) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);

export function rgbToOklch(rgb: Rgb): Oklch {
  const [r, g, b] = rgb.map(toLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { l: L, c: Math.hypot(A, B), h: (Math.atan2(B, A) * 180) / Math.PI };
}

function oklchToLinear({ l: L, c, h }: Oklch): Rgb {
  const A = c * Math.cos((h * Math.PI) / 180);
  const B = c * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** Back to sRGB; out-of-gamut colors keep their lightness and hue and lose chroma. */
export function oklchToRgb(color: Oklch): Rgb {
  const l = Math.min(1, Math.max(0, color.l));
  let c = color.c;
  for (let i = 0; i < 40; i++) {
    const lin = oklchToLinear({ l, c, h: color.h });
    if (lin.every((v) => v >= -0.0005 && v <= 1.0005)) return lin.map(fromLinear) as Rgb;
    c *= 0.9;
  }
  return oklchToLinear({ l, c: 0, h: color.h }).map(fromLinear) as Rgb;
}

const luminance = (hex: string) => {
  const [r, g, b] = hexToRgb(hex).map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** WCAG 2 contrast ratio. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const shade = (hex: string, change: (c: Oklch) => Partial<Oklch>): string => {
  const base = rgbToOklch(hexToRgb(hex));
  return rgbToHex(oklchToRgb({ ...base, ...change(base) }));
};
const withLightness = (hex: string, l: number, chroma = 1) => shade(hex, (c) => ({ l, c: c.c * chroma }));
const lighter = (hex: string, by: number) => shade(hex, (c) => ({ l: c.l + by }));
const alpha = (hex: string, a: number) => {
  const [r, g, b] = hexToRgb(hex).map((v) => Math.round(v * 255));
  return `rgb(${r} ${g} ${b} / ${a})`;
};

/** `hex` moved in lightness (darker on light, lighter on dark) until it
 *  reaches `ratio` against `against`. */
function readableOn(hex: string, against: string, ratio: number, theme: Theme): string {
  const base = rgbToOklch(hexToRgb(hex));
  for (let step = 0; step <= 50; step++) {
    const l = base.l + (theme === "light" ? -1 : 1) * step * 0.02;
    const candidate = rgbToHex(oklchToRgb({ ...base, l }));
    if (contrast(candidate, against) >= ratio) return candidate;
  }
  return theme === "light" ? "#000000" : "#ffffff";
}

/** White or near-black, whichever reads better on `hex`. */
export const onColor = (hex: string) => (contrast("#ffffff", hex) >= contrast(DARK_TEXT, hex) ? "#ffffff" : DARK_TEXT);

// ── Token families ──

type Tokens = Record<string, string>;

function primaryTokens(p: string, theme: Theme): Tokens {
  const base: Tokens = {
    "bg-primary": p,
    "state-bg-hover-primary": lighter(p, -0.06),
    "state-bg-pressed-primary": lighter(p, -0.12),
    "fg-on-primary": onColor(p),
  };
  if (theme === "light") {
    const text = readableOn(p, SURFACE.light, 4.5, "light");
    return {
      ...base,
      "bg-active-strong": p,
      "fg-active-strong": text,
      "fg-link": text,
      "border-active": text,
      "border-focus-default": text,
      "state-bg-hover-active-strong": lighter(text, -0.06),
      "state-bg-pressed-active-strong": lighter(text, -0.12),
      "bg-active-moderate": withLightness(p, 0.9, 0.35),
      "bg-active-subtle": withLightness(p, 0.97, 0.15),
      "state-bg-hover-active-subtle": withLightness(p, 0.94, 0.25),
      "state-bg-pressed-active-subtle": withLightness(p, 0.9, 0.35),
      "fg-active-subtle": withLightness(p, 0.98, 0.1),
    };
  }
  // Dark: lyra keeps the filled primary as is and lightens what sits on the
  // dark surface (active fills, text, links). The dark focus ring stays
  // lyra's yellow.
  const strong = shade(p, (c) => ({ l: Math.max(c.l, 0.68) }));
  const text = readableOn(withLightness(p, Math.max(rgbToOklch(hexToRgb(p)).l, 0.82)), SURFACE.dark, 4.5, "dark");
  return {
    ...base,
    "bg-active-strong": strong,
    "border-active": strong,
    "fg-active-strong": text,
    "fg-link": text,
    "state-bg-hover-active-strong": lighter(text, 0.04),
    "state-bg-pressed-active-strong": lighter(text, 0.08),
    "bg-active-moderate": alpha(strong, 0.2),
    "bg-active-subtle": alpha(strong, 0.12),
    "state-bg-hover-active-subtle": alpha(strong, 0.18),
    "state-bg-pressed-active-subtle": alpha(strong, 0.24),
    "fg-active-subtle": withLightness(p, 0.25, 0.6),
  };
}

function accentTokens(a: string, theme: Theme): Tokens {
  if (theme === "light") {
    const soft = withLightness(a, 0.92, 0.4);
    const strong = readableOn(a, soft, 4.5, "light");
    return {
      "bg-accent": a,
      "fg-on-accent": onColor(a),
      "accent-purple-soft": soft,
      "accent-purple-strong": strong,
      "border-field-ai": strong,
      "bg-ai": alpha(a, 0.04),
    };
  }
  const soft = withLightness(a, 0.42, 0.7);
  return {
    "bg-accent": a,
    "fg-on-accent": onColor(a),
    "accent-purple-soft": soft,
    "accent-purple-soft-header": withLightness(a, 0.34, 0.7),
    "accent-purple-strong": readableOn(withLightness(a, 0.86, 0.35), soft, 4.5, "dark"),
    "border-field-ai": withLightness(a, 0.72, 0.6),
    "bg-ai": alpha(a, 0.08),
  };
}

/** Every lyra token a brand overrides in `theme`, as `--lyra-color-*` values. */
export function brandTokens(colors: BrandColors, theme: Theme): Tokens {
  return {
    ...(colors.primary ? primaryTokens(colors.primary, theme) : {}),
    ...(colors.accent ? accentTokens(colors.accent, theme) : {}),
  };
}

/** The override stylesheet, or "" with no brand colors (lyra's defaults).
 *  The attribute-qualified `:root` selectors outrank lyra's own `:root` and
 *  `[data-theme="dark"]` blocks, whatever the load order. */
export function brandStylesheet(colors: BrandColors): string {
  if (!colors.primary && !colors.accent) return "";
  const block = (selector: string, theme: Theme) =>
    `${selector} {\n${Object.entries(brandTokens(colors, theme))
      .map(([name, value]) => `  --lyra-color-${name}: ${value};`)
      .join("\n")}\n}`;
  return `${block(':root:not([data-theme="dark"])', "light")}\n${block(':root[data-theme="dark"]', "dark")}\n`;
}

/** The themes in which `primary` fails WCAG AA: as a filled control against
 *  the page (3:1, non-text) or under its own on-color text (4.5:1). */
export function primaryContrastFailures(primary: string): Theme[] {
  return (["light", "dark"] as const).filter(
    (theme) => contrast(primary, SURFACE[theme]) < 3 || contrast(onColor(primary), primary) < 4.5,
  );
}

const STYLE_ID = "brand-overrides";

/** Writes (or removes) the override `<style>` at the end of `<head>`. */
export function applyBrandColors(colors: BrandColors, doc: Document = document) {
  const css = brandStylesheet(colors);
  let style = doc.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!css) {
    style?.remove();
    return;
  }
  if (!style) {
    style = doc.createElement("style");
    style.id = STYLE_ID;
  }
  doc.head.appendChild(style); // last, after lyra's CSS
  if (style.textContent !== css) style.textContent = css;
}
