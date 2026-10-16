// White-labeling (P-AIFIRST): reading an uploaded logo into a data URL.
// An SVG is sanitized first. It also always renders through <img>, which
// never runs an SVG's scripts or loads its external references; the
// sanitizer is the second line of defense, for whoever reads the stored file.
import { LOGO_MAX_BYTES } from "./settings-schema";

export type LogoReadResult = { ok: true; dataUrl: string } | { ok: false; reason: "type" | "size" | "invalid" };

const LOGO_TYPES = ["image/png", "image/jpeg", "image/svg+xml"] as const;

const FORBIDDEN_ELEMENTS = ["script", "foreignObject", "iframe", "object", "embed", "audio", "video", "handler", "listener"];
const SAFE_HREF = /^(#|data:image\/(png|jpeg|gif|webp);)/i;

/** An SVG document without scripts, event handlers, embedded documents or
 *  external references, or null when it doesn't parse as SVG. */
export function sanitizeSvg(text: string): string | null {
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  const root = doc.documentElement;
  if (doc.getElementsByTagName("parsererror").length > 0 || root.localName !== "svg") return null;
  for (const name of FORBIDDEN_ELEMENTS) {
    for (const el of [...doc.getElementsByTagNameNS("*", name)]) el.remove();
  }
  for (const el of [root, ...root.querySelectorAll("*")]) {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim();
      if (name.startsWith("on")) el.removeAttribute(attr.name);
      else if ((name === "href" || name === "xlink:href" || name === "src") && !SAFE_HREF.test(value)) el.removeAttribute(attr.name);
      else if (/url\(\s*['"]?(?!#)/i.test(value) || /javascript:/i.test(value)) el.removeAttribute(attr.name);
    }
  }
  // Stylesheets may import or fetch: keep only ones that can't.
  for (const style of [...root.getElementsByTagNameNS("*", "style")]) {
    if (/@import|url\(\s*['"]?(?!#)/i.test(style.textContent ?? "")) style.remove();
  }
  return new XMLSerializer().serializeToString(root);
}

const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
};

/** Reads an uploaded logo: PNG, JPEG or SVG, at most 256 KB. */
export async function readLogoFile(file: File): Promise<LogoReadResult> {
  if (!(LOGO_TYPES as readonly string[]).includes(file.type)) return { ok: false, reason: "type" };
  if (file.size > LOGO_MAX_BYTES) return { ok: false, reason: "size" };
  if (file.type === "image/svg+xml") {
    const clean = sanitizeSvg(await file.text());
    if (clean === null) return { ok: false, reason: "invalid" };
    const bytes = new TextEncoder().encode(clean);
    if (bytes.length > LOGO_MAX_BYTES) return { ok: false, reason: "size" };
    return { ok: true, dataUrl: `data:image/svg+xml;base64,${toBase64(bytes)}` };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  return { ok: true, dataUrl: `data:${file.type};base64,${toBase64(bytes)}` };
}

export const LOGO_ERROR_MESSAGES: Record<Exclude<LogoReadResult, { ok: true }>["reason"], string> = {
  type: "Use a PNG, SVG or JPEG.",
  size: "The logo must be 256 KB or smaller.",
  invalid: "This SVG couldn't be read.",
};
