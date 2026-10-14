import { DEFAULT_SIM_TIMINGS, type SimTimings } from "./sim-fixtures";
import { DEFAULT_LATENCY, type LatencyRange } from "./sim-transport";

/** How much delay the sim injects (P0.5b.2). Nothing is optimistic, so a
 *  card appears one bus round trip after the command that creates it:
 *  "realistic" catches non-optimistic bugs while building; "low" keeps demos
 *  snappy; "off" is for scripted walkthroughs. */
export type SimLatencyPreset = "realistic" | "low" | "off";

export const SIM_LATENCY_PRESETS: Record<SimLatencyPreset, { latency: LatencyRange; ring: SimTimings["ring"] }> = {
  realistic: { latency: DEFAULT_LATENCY, ring: DEFAULT_SIM_TIMINGS.ring },
  low: { latency: { minMs: 20, maxMs: 60 }, ring: { minMs: 400, maxMs: 800 } },
  off: { latency: { minMs: 0, maxMs: 0 }, ring: { minMs: 0, maxMs: 0 } },
};

export const SIM_LATENCY_PRESET_NAMES = Object.keys(SIM_LATENCY_PRESETS) as SimLatencyPreset[];
