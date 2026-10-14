import { describe, expect, it, vi } from "vitest";
import { SIM_LATENCY_PRESETS } from "../adapters/sim/sim-latency";
import { readSimLatency } from "./provider-kind";

describe("readSimLatency", () => {
  it("defaults to realistic on the dev server and low in a production build", () => {
    expect(readSimLatency("", true)).toBe("realistic");
    expect(readSimLatency("", false)).toBe("low");
    expect(readSimLatency("?provider=sim&latency=", false)).toBe("low");
  });

  it("lets ?latency= override either default", () => {
    for (const isDev of [true, false]) {
      expect(readSimLatency("?latency=realistic", isDev)).toBe("realistic");
      expect(readSimLatency("?latency=low", isDev)).toBe("low");
      expect(readSimLatency("?provider=sim&latency=off", isDev)).toBe("off");
    }
  });

  it("falls back to the build default on an unknown value", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(readSimLatency("?latency=fast", true)).toBe("realistic");
    expect(readSimLatency("?latency=fast", false)).toBe("low");
    warn.mockRestore();
  });

  it("presets order realistic > low > off", () => {
    const { realistic, low, off } = SIM_LATENCY_PRESETS;
    expect(low.latency.maxMs).toBeLessThan(realistic.latency.minMs);
    expect(low.ring.maxMs).toBeLessThan(realistic.ring.minMs);
    expect(off.latency).toEqual({ minMs: 0, maxMs: 0 });
  });
});
