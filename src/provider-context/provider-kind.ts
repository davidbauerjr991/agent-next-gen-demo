/** Which backend the workspace runs on, from the `?provider=` URL flag. */
export type ProviderKind = "sim" | "twilio" | "cxone";

const KINDS: readonly ProviderKind[] = ["sim", "twilio", "cxone"];

/** Reads `?provider=sim|twilio|cxone` from a `location.search` string.
 *  Missing → "sim"; anything else → "sim" with a dev warning. Read once at
 *  boot — changing the flag takes a reload. */
export function readProviderKind(search: string): ProviderKind {
  const value = new URLSearchParams(search).get("provider");
  if (value === null || value === "") return "sim";
  if ((KINDS as readonly string[]).includes(value)) return value as ProviderKind;
  if (import.meta.env.DEV) {
    console.warn(`[providers] unknown ?provider=${value}; falling back to "sim" (expected ${KINDS.join("|")})`);
  }
  return "sim";
}
