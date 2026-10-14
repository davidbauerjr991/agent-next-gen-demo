import { SIM_LATENCY_PRESET_NAMES, type SimLatencyPreset } from "../adapters/sim/sim-latency";

export type { SimLatencyPreset };

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

/** Reads `?latency=realistic|low|off` (P0.5b.2). Missing → "realistic" on
 *  the dev server, "low" in a production build (so the deployed demo is
 *  snappy with no flag); unknown → that default plus a dev warning. Read
 *  once at boot, like `?provider=`. */
export function readSimLatency(search: string, isDev: boolean): SimLatencyPreset {
  const fallback: SimLatencyPreset = isDev ? "realistic" : "low";
  const value = new URLSearchParams(search).get("latency");
  if (value === null || value === "") return fallback;
  if ((SIM_LATENCY_PRESET_NAMES as readonly string[]).includes(value)) return value as SimLatencyPreset;
  if (import.meta.env.DEV) {
    console.warn(`[providers] unknown ?latency=${value}; using "${fallback}" (expected ${SIM_LATENCY_PRESET_NAMES.join("|")})`);
  }
  return fallback;
}
